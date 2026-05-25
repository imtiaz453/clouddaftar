import { createHash } from "crypto";

export function canonicalizeZatcaXml(xml: string) {
  return xml.replace(/>\s+</g, "><").trim();
}

export function generateInvoiceHash(xml: string) {
  return createHash("sha256").update(canonicalizeZatcaXml(xml)).digest("base64");
}

export function firstPreviousInvoiceHash() {
  return createHash("sha256").update("0").digest("base64");
}
