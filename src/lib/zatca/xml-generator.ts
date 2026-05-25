import { randomUUID } from "crypto";
import type { ZatcaInvoiceInput, ZatcaInvoiceKind, ZatcaLine } from "./config";
import { firstPreviousInvoiceHash } from "./hash";

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function lineXml(line: ZatcaLine) {
  return `<cac:InvoiceLine>
    <cbc:ID>${esc(line.id)}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="SAR">${money(line.lineTotal)}</cbc:LineExtensionAmount>
    <cac:TaxTotal><cbc:TaxAmount currencyID="SAR">${money(line.taxAmount)}</cbc:TaxAmount></cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${esc(line.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${money(line.taxRate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="SAR">${money(line.unitPrice)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;
}

export function inferInvoiceKind(buyerVatNumber?: string | null): ZatcaInvoiceKind {
  return buyerVatNumber?.trim() ? "standard" : "simplified";
}

export function generateZatcaXml(input: ZatcaInvoiceInput, kind = inferInvoiceKind(input.buyer?.vatNumber)) {
  const uuid = randomUUID();
  const issueDate = input.issuedAt.toISOString().slice(0, 10);
  const issueTime = input.issuedAt.toISOString().slice(11, 19);
  const taxableAmount = Math.max(0, input.totals.subtotal - input.totals.discount);
  const pih = input.previousInvoiceHash || firstPreviousInvoiceHash();
  const invoiceTypeName = kind === "standard" ? "0100000" : "0200000";
  const invoiceCounter = input.invoiceCounter || 1;

  return {
    uuid,
    previousInvoiceHash: pih,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions/>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(input.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${invoiceTypeName}">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference><cbc:ID>ICV</cbc:ID><cbc:UUID>${invoiceCounter}</cbc:UUID></cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference><cbc:ID>PIH</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(pih)}</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="CRN">${esc(input.seller.crNumber || input.seller.sellerVatNumber)}</cbc:ID></cac:PartyIdentification>
    <cac:PostalAddress><cbc:StreetName>${esc(input.seller.address || input.seller.branchName || "Saudi Arabia")}</cbc:StreetName><cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    <cac:PartyTaxScheme><cbc:CompanyID>${esc(input.seller.sellerVatNumber)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    <cac:PartyLegalEntity><cbc:RegistrationName>${esc(input.seller.sellerName)}</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    ${input.buyer?.vatNumber ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(input.buyer.vatNumber)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}
    <cac:PartyLegalEntity><cbc:RegistrationName>${esc(input.buyer?.name || "Walk-in Customer")}</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="SAR">${money(input.totals.tax)}</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${money(input.totals.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${money(taxableAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${money(input.totals.total)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">${money(input.totals.discount)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="SAR">${money(input.totals.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${input.lines.map(lineXml).join("")}
</Invoice>`,
  };
}
