import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "crypto";
import { saleCreateSchema } from "@/lib/validations";
import {
  buildZatcaPhase1Payload,
  buildZatcaPhase2Payload,
  decodeZatcaTlvBytes,
  generateZatcaQrCode,
  generateZatcaTlvBytes,
  formatZatcaTimestamp,
  formatZatcaTotal,
  tlvBytesToHex,
  validateZatcaQrInput,
  ZatcaQrValidationError,
} from "@/lib/tax/zatca-qr";
import { signZatcaPhase2Invoice } from "@/lib/tax/zatca-phase2";
import { generateZatcaCsr } from "@/lib/tax/zatca-csr";
import { generateInvoiceHash } from "@/lib/zatca/hash";
import { generateLocalQr } from "@/lib/zatca/qr-generator";
import { generateZatcaXml } from "@/lib/zatca/xml-generator";
import { buildFbrQrPayload } from "@/lib/tax/fbr-qr";

function decodeTlv(base64: string): Array<{ tag: number; value: string }> {
  const bytes = Buffer.from(base64, "base64");
  const decoder = new TextDecoder();
  const fields: Array<{ tag: number; value: string }> = [];
  let offset = 0;

  while (offset < bytes.length) {
    const tag = bytes[offset];
    const length = bytes[offset + 1];
    const value = decoder.decode(bytes.subarray(offset + 2, offset + 2 + length));
    fields.push({ tag, value });
    offset += 2 + length;
  }

  return fields;
}

describe("tax QR payloads", () => {
  it("builds a ZATCA Phase 1 TLV payload with the mandatory fields", () => {
    const payload = buildZatcaPhase1Payload(
      "Cloud Daftar",
      "301121971500003",
      formatZatcaTimestamp(new Date("2026-05-15T10:20:30.000Z")),
      formatZatcaTotal(115),
      formatZatcaTotal(15),
    );

    expect(decodeTlv(payload)).toEqual([
      { tag: 1, value: "Cloud Daftar" },
      { tag: 2, value: "301121971500003" },
      { tag: 3, value: "2026-05-15T10:20:30Z" },
      { tag: 4, value: "115.00" },
      { tag: 5, value: "15.00" },
    ]);
  });

  it("returns raw hex and decoded fields for debugging", async () => {
    const input = {
      sellerName: "Alabar Medical Company",
      vatRegistrationNumber: "312345678900003",
      invoiceTimestamp: "2026-05-20T11:18:05Z",
      invoiceTotal: "2000.00",
      vatTotal: "300.00",
    };

    const tlv = generateZatcaTlvBytes(input);
    const result = await generateZatcaQrCode(input, { width: 160 });

    expect(tlvBytesToHex(tlv)).toBe(
      "0116416C61626172204D65646963616C20436F6D70616E79020F3331323334353637383930303030330314323032362D30352D32305431313A31383A30355A0407323030302E303005063330302E3030",
    );
    expect(result.rawTlvHex).toBe(tlvBytesToHex(tlv));
    expect(result.base64).toBe(Buffer.from(tlv).toString("base64"));
    expect(result.qrImageDataUri).toMatch(/^data:image\/png;base64,/);
    expect(result.decodedFields).toEqual(decodeZatcaTlvBytes(tlv));
  });

  it("rejects non-compliant ZATCA QR input", () => {
    expect(() =>
      validateZatcaQrInput({
        sellerName: "",
        vatRegistrationNumber: "123",
        invoiceTimestamp: "2026-05-20 11:18:05",
        invoiceTotal: "0",
        vatTotal: "-1",
      }),
    ).toThrow(ZatcaQrValidationError);
  });

  it("supports zero-rated invoices with 0.00 VAT", () => {
    const payload = buildZatcaPhase1Payload(
      "Cloud Daftar",
      "301121971500003",
      "2026-05-15T10:20:30Z",
      "115.00",
      "0.00",
    );

    expect(decodeTlv(payload).at(-1)).toEqual({ tag: 5, value: "0.00" });
  });

  it("builds Phase 2 TLV fields when cryptographic values are supplied", () => {
    const payload = buildZatcaPhase2Payload(
      "Cloud Daftar",
      "301121971500003",
      "2026-05-15T10:20:30Z",
      "115.00",
      "15.00",
      "hash-value",
      "signature-value",
      "public-key-value",
      "stamp-value",
    );

    expect(decodeTlv(payload).map((field) => field.tag)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("signs a Phase 2 invoice and embeds a 9-tag QR payload", () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "secp256k1" });
    const privateKeyPem = privateKey.export({ type: "sec1", format: "pem" }).toString();

    const signed = signZatcaPhase2Invoice({
      saleId: "sale-1",
      invoiceNumber: "INV-00001",
      issuedAt: new Date("2026-05-15T10:20:30.000Z"),
      seller: {
        name: "Cloud Daftar",
        vatNumber: "301121971500003",
        crNumber: "1010000000",
        address: "Riyadh",
      },
      buyer: { name: "Walk-in Customer" },
      totals: { subtotal: 100, discount: 0, tax: 15, total: 115 },
      lines: [
        {
          id: "1",
          name: "Consulting",
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          taxRate: 15,
          lineTotal: 100,
          taxAmount: 15,
        },
      ],
      privateKeyPem,
      cryptographicStamp: "stamp-value",
    });

    expect(signed.invoiceHash).toBeTruthy();
    expect(signed.ecdsaSignature).toBeTruthy();
    expect(signed.signedXml).toContain("<SignatureValue>");
    expect(signed.signedXml).toContain("<cbc:ID>QR</cbc:ID>");
    expect(decodeTlv(signed.qrPayload).map((field) => field.tag)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("generates a real UUID for Phase 2 invoices instead of reusing a sale id", () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "secp256k1" });
    const privateKeyPem = privateKey.export({ type: "sec1", format: "pem" }).toString();

    const signed = signZatcaPhase2Invoice({
      saleId: "sale-1",
      invoiceNumber: "INV-00002",
      issuedAt: new Date("2026-05-15T10:20:30.000Z"),
      seller: {
        name: "Cloud Daftar",
        vatNumber: "301121971500003",
      },
      totals: { subtotal: 100, discount: 0, tax: 15, total: 115 },
      lines: [
        {
          id: "1",
          name: "Consulting",
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          taxRate: 15,
          lineTotal: 100,
          taxAmount: 15,
        },
      ],
      privateKeyPem,
      cryptographicStamp: "stamp-value",
    });

    expect(signed.uuid).not.toBe("sale-1");
    expect(signed.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(signed.signedXml).toContain(`<cbc:UUID>${signed.uuid}</cbc:UUID>`);
  });

  it("generates a simulation CSR and its matching private key material", () => {
    const generated = generateZatcaCsr({
      environment: "SIMULATION",
      sellerName: "Cloud Daftar Saudi",
      vatNumber: "399999999900003",
      branchName: "Riyadh Branch",
      location: "Riyadh",
      industry: "Retail",
      invoiceType: "1100",
    });

    expect(generated.commonName).toContain("TST");
    expect(generated.serialNumber).toContain("CLOUDDAFTAR");
    expect(generated.csrPem).toContain("BEGIN CERTIFICATE REQUEST");
    expect(generated.privateKeyPem).toContain("BEGIN EC PRIVATE KEY");
  });

  it("generates local ZATCA XML, invoice hash, and Phase 2 QR data without credentials", () => {
    const input = {
      saleId: "local-sale",
      invoiceNumber: "INV-LOCAL-1",
      issuedAt: new Date("2026-05-15T10:20:30.000Z"),
      seller: {
        sellerName: "Cloud Daftar Saudi",
        sellerVatNumber: "399999999900003",
      },
      totals: { subtotal: 100, discount: 0, tax: 15, total: 115 },
      lines: [
        {
          id: "1",
          name: "Local invoice item",
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          taxRate: 15,
          lineTotal: 100,
          taxAmount: 15,
        },
      ],
    };

    const generated = generateZatcaXml(input);
    expect(generated.xml).toContain("<cbc:ID>INV-LOCAL-1</cbc:ID>");
    expect(generateInvoiceHash(generated.xml)).toBeTruthy();
    expect(decodeTlv(generateLocalQr(input)).map((field) => field.tag)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("keeps FBR QR payload data available for invoice rendering", () => {
    const payload = buildFbrQrPayload({
      supplierName: "Cloud Daftar",
      supplierNtn: "1234567",
      buyerName: "Walk-in Customer",
      invoiceNumber: "INV-00001",
      invoiceDate: "2026-05-15",
      invoiceTime: "10:20:30",
      totalAmount: "115.00",
      salesTaxAmount: "15.00",
      fbrInvoiceNumber: "",
    });

    expect(payload).toContain("INV=INV-00001");
    expect(payload).toContain("AMT=115.00");
    expect(payload).toContain("TX=15.00");
  });

  it("allows compliance data through the sale API schema", () => {
    const parsed = saleCreateSchema.parse({
      items: [{ productId: "p1", quantity: 1, price: 100, tax: 15 }],
      taxComplianceMode: "ZATCA",
      buyerTaxNumber: "300000000000003",
    });

    expect(parsed.taxComplianceMode).toBe("ZATCA");
    expect(parsed.buyerTaxNumber).toBe("300000000000003");
  });
});
