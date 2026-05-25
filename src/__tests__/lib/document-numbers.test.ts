import { describe, expect, it } from "vitest";
import {
  documentKindForSaleStatus,
  formatDocumentNumber,
  getPrefixForKind,
  isLegacyDraftDocumentNumber,
  normalizeDocumentPrefix,
} from "@/lib/document-numbers";

describe("document-numbers", () => {
  it("normalizes prefix without trailing separators", () => {
    expect(normalizeDocumentPrefix("INV")).toBe("INV");
    expect(normalizeDocumentPrefix("QUOT-")).toBe("QUOT");
  });

  it("formats dated padded sequential numbers", () => {
    const date = new Date("2026-05-21T10:00:00");

    expect(formatDocumentNumber("INV-", 42, 5, null, date)).toBe("INV/2026/05/00042");
    expect(formatDocumentNumber("PO", 1, 5, null, date)).toBe("PO/2026/05/00001");
    expect(formatDocumentNumber("QUOT-", 1, 5, null, date)).toBe("QUOT/2026/05/00001");
  });

  it("uses settings prefixes per kind", () => {
    expect(
      getPrefixForKind("quotation", {
        invoicePrefix: "INV-",
        salesOrderPrefix: "SORD-",
        proformaInvoicePrefix: "PI-",
        quotationPrefix: "QUOT-",
        purchaseOrderPrefix: "PO-",
        invoiceSuffix: null,
        invoiceNumberLength: 5,
      }),
    ).toBe("QUOT");
  });

  it("maps sale status to document kind", () => {
    expect(documentKindForSaleStatus("DRAFT")).toBe("sales_order");
    expect(documentKindForSaleStatus("CONFIRMED")).toBe("sales_order");
    expect(documentKindForSaleStatus("PROFORMA")).toBe("proforma_invoice");
    expect(documentKindForSaleStatus("COMPLETED")).toBe("invoice");
  });

  it("detects legacy draft numbers", () => {
    expect(isLegacyDraftDocumentNumber("DRAFT-173000")).toBe(true);
    expect(isLegacyDraftDocumentNumber("SORD/2026/05/00001")).toBe(false);
  });
});
