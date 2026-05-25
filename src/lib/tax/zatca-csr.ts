import { createSign, generateKeyPairSync, randomUUID } from "crypto";

export type ZatcaCsrEnvironment = "SIMULATION" | "PRODUCTION";

export type ZatcaCsrInput = {
  sellerName: string;
  vatNumber: string;
  commonName?: string;
  serialNumber?: string;
  branchName?: string;
  location?: string;
  industry?: string;
  invoiceType?: string;
  environment: ZatcaCsrEnvironment;
};

type DerValue = Buffer;

const OIDS = {
  commonName: "2.5.4.3",
  serialNumber: "2.5.4.5",
  countryName: "2.5.4.6",
  organizationName: "2.5.4.10",
  organizationUnitName: "2.5.4.11",
  organizationIdentifier: "2.5.4.97",
  extensionRequest: "1.2.840.113549.1.9.14",
  subjectAltName: "2.5.29.17",
  certificateTemplateName: "1.3.6.1.4.1.311.20.2",
  sha256WithEcdsa: "1.2.840.10045.4.3.2",
  title: "2.5.4.12",
  businessCategory: "2.5.4.15",
  registeredAddress: "2.5.4.26",
  userId: "0.9.2342.19200300.100.1.1",
} as const;

function len(value: number): Buffer {
  if (value < 0x80) return Buffer.from([value]);
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0) {
    bytes.unshift(rest & 0xff);
    rest >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag: number, ...values: DerValue[]): DerValue {
  const value = Buffer.concat(values);
  return Buffer.concat([Buffer.from([tag]), len(value.length), value]);
}

function seq(...values: DerValue[]) {
  return der(0x30, ...values);
}

function set(...values: DerValue[]) {
  return der(0x31, ...values);
}

function utf8(value: string) {
  return der(0x0c, Buffer.from(value, "utf8"));
}

function printable(value: string) {
  return der(0x13, Buffer.from(value, "ascii"));
}

function octets(value: DerValue) {
  return der(0x04, value);
}

function bitString(value: DerValue) {
  return der(0x03, Buffer.from([0]), value);
}

function context(tag: number, value: DerValue) {
  return der(0xa0 + tag, value);
}

function oid(value: string): DerValue {
  const parts = value.split(".").map(Number);
  const bytes = [parts[0] * 40 + parts[1]];
  for (const part of parts.slice(2)) {
    const encoded: number[] = [part & 0x7f];
    let rest = Math.floor(part / 128);
    while (rest > 0) {
      encoded.unshift((rest & 0x7f) | 0x80);
      rest = Math.floor(rest / 128);
    }
    bytes.push(...encoded);
  }
  return der(0x06, Buffer.from(bytes));
}

function attribute(type: string, value: DerValue) {
  return set(seq(oid(type), value));
}

function altName(type: string, value: string) {
  return set(seq(oid(type), utf8(value)));
}

function pem(label: string, body: Buffer) {
  const encoded = body.toString("base64").match(/.{1,64}/g)?.join("\n") || "";
  return `-----BEGIN ${label}-----\n${encoded}\n-----END ${label}-----`;
}

function buildSubject(input: Required<Pick<ZatcaCsrInput, "sellerName" | "vatNumber">> & {
  commonName: string;
  serialNumber: string;
  branchName: string;
}) {
  return seq(
    attribute(OIDS.commonName, utf8(input.commonName)),
    attribute(OIDS.serialNumber, printable(input.serialNumber)),
    attribute(OIDS.organizationIdentifier, printable(input.vatNumber)),
    attribute(OIDS.organizationUnitName, utf8(input.branchName)),
    attribute(OIDS.organizationName, utf8(input.sellerName)),
    attribute(OIDS.countryName, printable("SA")),
  );
}

function buildRequestedExtensions(input: {
  vatNumber: string;
  serialNumber: string;
  branchName: string;
  location: string;
  industry: string;
  invoiceType: string;
  environment: ZatcaCsrEnvironment;
}) {
  const directoryName = seq(
    altName(OIDS.serialNumber, input.serialNumber),
    altName(OIDS.userId, input.vatNumber),
    altName(OIDS.title, input.invoiceType),
    altName(OIDS.registeredAddress, input.location),
    altName(OIDS.businessCategory, input.industry),
  );
  const san = seq(context(4, directoryName));
  const template =
    input.environment === "SIMULATION" ? "PREZATCA-Code-Signing" : "ZATCA-Code-Signing";

  const extensions = seq(
    seq(oid(OIDS.certificateTemplateName), octets(printable(template))),
    seq(oid(OIDS.subjectAltName), octets(san)),
  );

  return context(0, seq(oid(OIDS.extensionRequest), set(extensions)));
}

function defaultSerial() {
  return `1-CLOUDDAFTAR|2-CLOUDDAFTAR|3-${randomUUID()}`;
}

export function generateZatcaCsr(input: ZatcaCsrInput) {
  const serialNumber = input.serialNumber?.trim() || defaultSerial();
  const commonName =
    input.commonName?.trim() ||
    `${input.environment === "SIMULATION" ? "TST" : "CD"}-${input.vatNumber}`;
  const branchName = input.branchName?.trim() || "Cloud Daftar";
  const location = input.location?.trim() || "Cloud Daftar";
  const industry = input.industry?.trim() || "Invoicing";
  const invoiceType = input.invoiceType?.trim() || "1100";

  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "secp256k1" });
  const privateKeyPem = privateKey.export({ type: "sec1", format: "pem" }).toString();
  const subjectPublicKeyInfo = publicKey.export({ type: "spki", format: "der" });
  const requestInfo = seq(
    der(0x02, Buffer.from([0])),
    buildSubject({
      sellerName: input.sellerName,
      vatNumber: input.vatNumber,
      commonName,
      serialNumber,
      branchName,
    }),
    subjectPublicKeyInfo,
    buildRequestedExtensions({
      vatNumber: input.vatNumber,
      serialNumber,
      branchName,
      location,
      industry,
      invoiceType,
      environment: input.environment,
    }),
  );

  const signer = createSign("SHA256");
  signer.update(requestInfo);
  signer.end();
  const csr = seq(requestInfo, seq(oid(OIDS.sha256WithEcdsa)), bitString(signer.sign(privateKey)));

  return {
    commonName,
    serialNumber,
    privateKeyPem,
    csrPem: pem("CERTIFICATE REQUEST", csr),
  };
}

export function certificateTokenToPem(token?: string | null) {
  if (!token?.trim()) return null;
  const trimmed = token.trim();
  if (trimmed.includes("BEGIN CERTIFICATE")) return trimmed;
  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  if (decoded.includes("BEGIN CERTIFICATE")) return decoded;
  return pem("CERTIFICATE", Buffer.from(trimmed, "base64"));
}
