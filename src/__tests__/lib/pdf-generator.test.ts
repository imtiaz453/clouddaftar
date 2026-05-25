import { describe, expect, it } from "vitest";
import { generateDocumentPdf, pdfFilename } from "@/lib/pdf-generator";
import { getDefaultOptions, type RenderData } from "@/lib/template-registry";

const data: RenderData = {
  company: {
    name: "Cloud Daftar Demo",
    phone: "555-0100",
    email: "hello@example.com",
  },
  customer: {
    name: "Sample Customer",
  },
  document: {
    number: "INV-00001",
    date: new Date("2026-05-14T00:00:00.000Z"),
    dueDate: null,
    status: "COMPLETED",
    notes: "Paid at counter",
    terms: null,
    createdByName: "Admin",
    paymentMethod: "CASH",
    subtotal: 100,
    discount: 0,
    tax: 10,
    total: 110,
    paid: 110,
    due: 0,
  },
  items: [
    {
      name: "Product A",
      sku: "SKU-1",
      quantity: 1,
      price: 100,
      discount: 0,
      tax: 10,
      subtotal: 110,
      unit: "pcs",
    },
  ],
  type: "invoice",
};

describe("generateDocumentPdf", () => {
  it("creates a real PDF payload", () => {
    const pdf = generateDocumentPdf(data, getDefaultOptions({ paperSize: "A4" }), {
      type: "invoice",
      title: "Invoice INV-00001",
    });
    const text = Buffer.from(pdf).toString("latin1");

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("draws tax QR payloads directly into generated PDFs", () => {
    const pdf = generateDocumentPdf(
      {
        ...data,
        document: {
          ...data.document,
          taxComplianceMode: "ZATCA",
          taxComplianceStatus: "NOT_VERIFIED",
        },
        taxInfo: {
          qrPayload: "AQxDbG91ZCBEYWZ0YXICDzMwMTEyMTk3MTUwMDAwMwMUMjAyNi0wNS0xNVQxMDoyMDozMFoEBjExNS4wMAUFMTUuMDA=",
        },
      },
      getDefaultOptions({
        paperSize: "A4",
        showQR: true,
        taxComplianceMode: "ZATCA",
        taxComplianceStatus: "NOT_VERIFIED",
      }),
      {
        type: "invoice",
        title: "Invoice INV-00001",
      },
    );
    const text = Buffer.from(pdf).toString("latin1");

    expect(text).toContain("ZATCA QR");
    expect(text).toContain(" re f");
    expect(pdf.length).toBeGreaterThan(5000);
  });

  it("keeps wide item totals separated from the tax column", () => {
    const pdf = generateDocumentPdf(
      {
        ...data,
        document: {
          ...data.document,
          subtotal: 1234567.89,
          tax: 209876.54,
          total: 1444444.43,
          paid: 1444444.43,
        },
        items: [
          {
            ...data.items[0],
            name: "Long retail product name that still leaves room for numeric columns",
            price: 1234567.89,
            subtotal: 1444444.43,
            tax: 17,
          },
        ],
      },
      getDefaultOptions({ paperSize: "A4", currencySymbol: "PKR" }),
      {
        type: "invoice",
        title: "Invoice INV-00001",
      },
    );
    const text = Buffer.from(pdf).toString("latin1");

    expect(text).toContain("458.74");
    expect(text).toContain("474.56");
    expect(text.indexOf("(17%)")).toBeLessThan(text.indexOf("(PKR 1,444,444.43)"));
  });

  it("creates safe pdf filenames", () => {
    expect(pdfFilename("invoice", "INV/00001")).toBe("invoice-INV-00001.pdf");
  });
});
