import { describe, expect, it } from "vitest";
import { buildRenderDataFromSale, renderDocument } from "@/components/templates/renderer";
import { getDefaultOptions, type RenderData } from "@/lib/template-registry";

const quotationData: RenderData = {
  company: {
    name: "Cloud Daftar Demo",
    address: "123 Market Road",
    phone: "555-0100",
    email: "hello@example.com",
  },
  customer: {
    name: "Sample Customer",
    phone: "555-0110",
  },
  document: {
    number: "QT-00001",
    date: new Date("2026-05-14T00:00:00.000Z"),
    dueDate: new Date("2026-05-21T00:00:00.000Z"),
    status: "SENT",
    notes: "Prepared for approval",
    terms: null,
    createdByName: "Admin",
    paymentMethod: null,
    subtotal: 100,
    discount: 0,
    tax: 10,
    total: 110,
    paid: 0,
    due: 110,
  },
  items: [
    {
      name: "Consulting",
      sku: "SERV-1",
      quantity: 1,
      price: 100,
      discount: 0,
      tax: 10,
      subtotal: 110,
      unit: "hour",
    },
  ],
  type: "quotation",
};

describe("quotation template rendering", () => {
  it("places quotation markup in the body for all A4 quotation templates", () => {
    const templates = [
      "quotation-modern-minimal",
      "quotation-corporate",
      "quotation-clean-accounting",
      "quotation-bold-commercial",
      "quotation-premium-business",
    ];

    for (const templateId of templates) {
      const html = renderDocument(
        templateId,
        quotationData,
        getDefaultOptions({ paperSize: "A4" }),
      );
      const body = html.slice(html.indexOf("<body>"));

      expect(body).toContain("QUOTATION");
      expect(body).toContain("QT-00001");
      expect(body).not.toMatch(/<body>\s*table\.items/);
    }
  });

  it("uses the selected company currency in quotation rows and totals", () => {
    const html = renderDocument(
      "quotation-modern-minimal",
      quotationData,
      getDefaultOptions({ paperSize: "A4", currencySymbol: "SAR" }),
    );

    expect(html).toContain("SAR 100.00");
    expect(html).toContain("SAR 110.00");
    expect(html).not.toContain("PKR 100.00");
  });
});

describe("sale render data", () => {
  it("shows the sale due date in the default invoice template", () => {
    const data = buildRenderDataFromSale({
      invoiceNumber: "INV-00001",
      createdAt: new Date("2026-05-20T00:00:00.000Z"),
      dueDate: new Date("2026-05-30T00:00:00.000Z"),
      status: "COMPLETED",
      paymentMethod: "BANK_TRANSFER",
      subtotal: 100,
      discount: 0,
      tax: 10,
      total: 110,
      paid: 50,
      due: 60,
      company: { name: "Due Date Seller" },
      customer: { name: "Due Date Buyer" },
      items: [
        {
          product: { name: "Consulting", sku: "SERV-1" },
          quantity: 1,
          price: 100,
          discount: 0,
          tax: 10,
          subtotal: 110,
        },
      ],
    });

    const html = renderDocument(
      "invoice-modern-minimal",
      data,
      getDefaultOptions({ paperSize: "A4" }),
    );

    expect(data.document.dueDate).toEqual(new Date("2026-05-30T00:00:00.000Z"));
    expect(html).toContain("Due Date");
    expect(html).toContain("30 May 2026");
  });

  it("builds a fallback QR payload for older compliant sales without stored payloads", () => {
    const data = buildRenderDataFromSale({
      invoiceNumber: "INV-00002",
      createdAt: new Date("2026-05-15T10:20:30.000Z"),
      dueDate: null,
      status: "COMPLETED",
      subtotal: 100,
      discount: 0,
      tax: 15,
      total: 115,
      paid: 115,
      due: 0,
      taxComplianceMode: "ZATCA",
      taxComplianceStatus: "NOT_VERIFIED",
      company: {
        name: "Fallback Seller",
        taxId: "301121971500003",
        settings: {
          zatcaSettings: {
            sellerName: "Configured Seller",
            vatRegNo: "301121971500003",
          },
        },
      },
      customer: null,
      items: [],
    });

    expect(data.taxInfo?.qrPayload).toBeTruthy();
    expect(Buffer.from(data.taxInfo?.qrPayload || "", "base64")[0]).toBe(1);
  });

  it("uses company compliance settings for older sales saved with NONE mode", () => {
    const data = buildRenderDataFromSale({
      invoiceNumber: "INV-00003",
      createdAt: new Date("2026-05-15T10:20:30.000Z"),
      status: "COMPLETED",
      subtotal: 100,
      discount: 0,
      tax: 15,
      total: 115,
      paid: 115,
      due: 0,
      taxComplianceMode: "NONE",
      company: {
        name: "Configured Seller",
        taxId: "301121971500003",
        settings: {
          taxComplianceMode: "ZATCA",
          zatcaSettings: {
            sellerName: "Configured Seller",
            vatRegNo: "301121971500003",
          },
        },
      },
      customer: null,
      items: [],
    });

    expect(data.document.taxComplianceMode).toBe("ZATCA");
    expect(data.taxInfo?.qrPayload).toBeTruthy();
  });

  it("uses Saudi/ZATCA address and VAT details in render data", () => {
    const data = buildRenderDataFromSale({
      invoiceNumber: "INV-00004",
      createdAt: new Date("2026-05-15T10:20:30.000Z"),
      status: "COMPLETED",
      subtotal: 100,
      discount: 0,
      tax: 15,
      total: 115,
      paid: 115,
      due: 0,
      taxComplianceMode: "NONE",
      company: {
        name: "Saudi Seller",
        country: "SA",
        settings: {
          taxComplianceMode: "ZATCA",
          zatcaSettings: {
            address: "Riyadh Business District",
            vatRegNo: "301121971500003",
          },
        },
      },
      customer: null,
      items: [],
    });

    expect(data.company.country).toBe("Saudi Arabia");
    expect(data.company.address).toBe("Riyadh Business District");
    expect(data.company.taxId).toBe("301121971500003");
  });
});
