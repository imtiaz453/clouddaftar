import type { ZatcaInvoiceInput } from "./config";

export function validateLocalInvoice(input: ZatcaInvoiceInput, xml: string) {
  const issues: string[] = [];
  if (!input.seller.sellerName.trim()) issues.push("Seller name is required");
  if (!/^\d{15}$/.test(input.seller.sellerVatNumber)) {
    issues.push("Seller VAT number must be 15 digits");
  }
  if (!input.lines.length) issues.push("At least one invoice line is required");
  if (!xml.includes("<cbc:UUID>")) issues.push("Generated XML is missing UUID");

  // TODO: Run official SDK/portal validation before treating local XML as ZATCA production-ready.
  return { ok: issues.length === 0, issues };
}
