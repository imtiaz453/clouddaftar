// Saudi ZATCA TLV QR code encoding.
// Phase 1 requires tags 1-5. Phase 2 adds cryptographic tags 6-9.

import { renderQrDataUri, type QrOptions } from "./qr-service";

export const ZATCA_TLV_TAGS = {
  SELLER_NAME: 1,
  VAT_NUMBER: 2,
  INVOICE_TIMESTAMP: 3,
  INVOICE_TOTAL: 4,
  VAT_TOTAL: 5,
  INVOICE_HASH: 6,
  ECDSA_SIGNATURE: 7,
  PUBLIC_KEY: 8,
  CRYPTO_STAMP: 9,
} as const;

export type ZatcaPhase = "phase1" | "phase2";

export interface ZatcaPhase2Fields {
  invoiceHash: string;
  ecdsaSignature: string;
  publicKey: string;
  cryptographicStamp: string;
}

export interface ZatcaQrInput {
  sellerName: string;
  vatRegistrationNumber: string;
  invoiceTimestamp: string;
  invoiceTotal: number | string;
  vatTotal: number | string;
  phase?: ZatcaPhase;
  phase2?: ZatcaPhase2Fields;
}

export interface ZatcaDecodedField {
  tag: number;
  name: string;
  length: number;
  value: string;
}

export interface ZatcaQrResult {
  tlvBytes: Uint8Array;
  rawTlvHex: string;
  base64: string;
  qrImageDataUri: string;
  decodedFields: ZatcaDecodedField[];
}

export class ZatcaQrValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid ZATCA QR data: ${issues.join("; ")}`);
    this.name = "ZatcaQrValidationError";
    this.issues = issues;
  }
}

const TAG_NAMES: Record<number, string> = {
  [ZATCA_TLV_TAGS.SELLER_NAME]: "Seller Name",
  [ZATCA_TLV_TAGS.VAT_NUMBER]: "Seller VAT Registration Number",
  [ZATCA_TLV_TAGS.INVOICE_TIMESTAMP]: "Invoice Timestamp",
  [ZATCA_TLV_TAGS.INVOICE_TOTAL]: "Invoice Total Amount including VAT",
  [ZATCA_TLV_TAGS.VAT_TOTAL]: "VAT Amount",
  [ZATCA_TLV_TAGS.INVOICE_HASH]: "Invoice Hash",
  [ZATCA_TLV_TAGS.ECDSA_SIGNATURE]: "ECDSA Signature",
  [ZATCA_TLV_TAGS.PUBLIC_KEY]: "Public Key",
  [ZATCA_TLV_TAGS.CRYPTO_STAMP]: "Cryptographic Stamp",
};

const ISO_8601_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function normalizeAmount(value: number | string, fieldName: string): string | null {
  const raw = typeof value === "number" ? String(value) : value.trim();
  if (!raw || !/^-?\d+(?:\.\d+)?$/.test(raw)) return null;

  const amount = Number(raw);
  if (!Number.isFinite(amount)) return null;
  if (fieldName === "invoiceTotal" && amount <= 0) return null;
  if (fieldName === "vatTotal" && amount < 0) return null;

  return amount.toFixed(2);
}

function validateIsoUtcTimestamp(value: string): boolean {
  if (!ISO_8601_UTC_RE.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value.replace(/Z$/, ""));
}

function validateNonEmpty(value: string | undefined, label: string, issues: string[]) {
  if (!value || value.trim().length === 0) issues.push(`${label} is required`);
}

export function validateZatcaQrInput(input: ZatcaQrInput): void {
  const issues: string[] = [];

  validateNonEmpty(input.sellerName, "Seller name", issues);

  if (!/^\d{15}$/.test(input.vatRegistrationNumber || "")) {
    issues.push("Seller VAT registration number must be exactly 15 digits");
  }

  if (!validateIsoUtcTimestamp(input.invoiceTimestamp || "")) {
    issues.push("Invoice timestamp must be a valid ISO 8601 UTC value such as 2026-05-20T11:18:05Z");
  }

  if (normalizeAmount(input.invoiceTotal, "invoiceTotal") == null) {
    issues.push("Invoice total amount including VAT must be numeric and greater than zero");
  }

  if (normalizeAmount(input.vatTotal, "vatTotal") == null) {
    issues.push("VAT amount must be numeric and cannot be negative");
  }

  if (input.phase === "phase2") {
    validateNonEmpty(input.phase2?.invoiceHash, "Invoice hash", issues);
    validateNonEmpty(input.phase2?.ecdsaSignature, "ECDSA signature", issues);
    validateNonEmpty(input.phase2?.publicKey, "Public key", issues);
    validateNonEmpty(input.phase2?.cryptographicStamp, "Cryptographic stamp", issues);
  }

  if (issues.length > 0) throw new ZatcaQrValidationError(issues);
}

function encodeTlvField(tag: number, value: string): Uint8Array {
  const valueBytes = new TextEncoder().encode(value);
  if (valueBytes.length > 255) {
    throw new ZatcaQrValidationError([
      `${TAG_NAMES[tag] || `Tag ${tag}`} exceeds the 255 byte TLV length limit`,
    ]);
  }

  const bytes = new Uint8Array(2 + valueBytes.length);
  bytes[0] = tag;
  bytes[1] = valueBytes.length;
  bytes.set(valueBytes, 2);
  return bytes;
}

function concatBytes(fields: Uint8Array[]): Uint8Array {
  const totalLength = fields.reduce((sum, field) => sum + field.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const field of fields) {
    combined.set(field, offset);
    offset += field.length;
  }
  return combined;
}

function normalizedFields(input: ZatcaQrInput): Array<{ tag: number; value: string }> {
  validateZatcaQrInput(input);

  const fields: Array<{ tag: number; value: string }> = [
    { tag: ZATCA_TLV_TAGS.SELLER_NAME, value: input.sellerName.trim() },
    { tag: ZATCA_TLV_TAGS.VAT_NUMBER, value: input.vatRegistrationNumber.trim() },
    { tag: ZATCA_TLV_TAGS.INVOICE_TIMESTAMP, value: input.invoiceTimestamp.trim() },
    {
      tag: ZATCA_TLV_TAGS.INVOICE_TOTAL,
      value: normalizeAmount(input.invoiceTotal, "invoiceTotal")!,
    },
    { tag: ZATCA_TLV_TAGS.VAT_TOTAL, value: normalizeAmount(input.vatTotal, "vatTotal")! },
  ];

  if (input.phase === "phase2" && input.phase2) {
    fields.push(
      { tag: ZATCA_TLV_TAGS.INVOICE_HASH, value: input.phase2.invoiceHash.trim() },
      { tag: ZATCA_TLV_TAGS.ECDSA_SIGNATURE, value: input.phase2.ecdsaSignature.trim() },
      { tag: ZATCA_TLV_TAGS.PUBLIC_KEY, value: input.phase2.publicKey.trim() },
      { tag: ZATCA_TLV_TAGS.CRYPTO_STAMP, value: input.phase2.cryptographicStamp.trim() },
    );
  }

  return fields;
}

export function generateZatcaTlvBytes(input: ZatcaQrInput): Uint8Array {
  return concatBytes(normalizedFields(input).map((field) => encodeTlvField(field.tag, field.value)));
}

export function encodeZatcaTlvToBase64(tlvBytes: Uint8Array): string {
  return Buffer.from(tlvBytes).toString("base64");
}

export function decodeZatcaTlvBytes(tlvBytes: Uint8Array): ZatcaDecodedField[] {
  const decoder = new TextDecoder("utf-8");
  const fields: ZatcaDecodedField[] = [];
  let offset = 0;

  while (offset < tlvBytes.length) {
    const tag = tlvBytes[offset];
    const length = tlvBytes[offset + 1];
    if (tag == null || length == null || offset + 2 + length > tlvBytes.length) {
      throw new Error("Invalid ZATCA TLV bytes");
    }

    const valueBytes = tlvBytes.subarray(offset + 2, offset + 2 + length);
    fields.push({
      tag,
      name: TAG_NAMES[tag] || `Tag ${tag}`,
      length,
      value: decoder.decode(valueBytes),
    });
    offset += 2 + length;
  }

  return fields;
}

export function tlvBytesToHex(tlvBytes: Uint8Array): string {
  return Buffer.from(tlvBytes).toString("hex").toUpperCase();
}

export async function generateZatcaQrImage(
  input: ZatcaQrInput,
  opts?: QrOptions,
): Promise<string> {
  const base64 = encodeZatcaTlvToBase64(generateZatcaTlvBytes(input));
  return renderQrDataUri(base64, opts);
}

export async function generateZatcaQrCode(
  input: ZatcaQrInput,
  opts?: QrOptions,
): Promise<ZatcaQrResult> {
  const tlvBytes = generateZatcaTlvBytes(input);
  const base64 = encodeZatcaTlvToBase64(tlvBytes);

  return {
    tlvBytes,
    rawTlvHex: tlvBytesToHex(tlvBytes),
    base64,
    qrImageDataUri: await renderQrDataUri(base64, opts),
    decodedFields: decodeZatcaTlvBytes(tlvBytes),
  };
}

export function buildZatcaPhase1Payload(
  sellerName: string,
  vatNumber: string,
  invoiceTimestamp: string,
  invoiceTotal: string,
  vatTotal: string,
): string {
  return encodeZatcaTlvToBase64(
    generateZatcaTlvBytes({
      sellerName,
      vatRegistrationNumber: vatNumber,
      invoiceTimestamp,
      invoiceTotal,
      vatTotal,
      phase: "phase1",
    }),
  );
}

export function buildZatcaPhase2Payload(
  sellerName: string,
  vatNumber: string,
  invoiceTimestamp: string,
  invoiceTotal: string,
  vatTotal: string,
  invoiceHash: string,
  ecdsaSignature: string,
  publicKey: string,
  cryptoStamp: string,
): string {
  return encodeZatcaTlvToBase64(
    generateZatcaTlvBytes({
      sellerName,
      vatRegistrationNumber: vatNumber,
      invoiceTimestamp,
      invoiceTotal,
      vatTotal,
      phase: "phase2",
      phase2: {
        invoiceHash,
        ecdsaSignature,
        publicKey,
        cryptographicStamp: cryptoStamp,
      },
    }),
  );
}

export function formatZatcaTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function formatZatcaTotal(amount: number): string {
  return amount.toFixed(2);
}
