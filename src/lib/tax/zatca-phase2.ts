import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  randomUUID,
  X509Certificate,
} from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { buildZatcaPhase2Payload, formatZatcaTimestamp, formatZatcaTotal } from "./zatca-qr";
import { ZATCA_PRODUCTION_ENDPOINTS, ZATCA_SIMULATION_ENDPOINTS } from "./zatca-endpoints";

type ZatcaLineItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  taxAmount: number;
};

export type ZatcaInvoiceKind = "simplified" | "standard";

export type ZatcaPhase2Settings = {
  sellerName: string;
  vatRegNo: string;
  crNo?: string;
  address?: string;
  privateKeyPem?: string;
  certificatePem?: string;
  cryptographicStamp?: string;
  complianceCsid?: string;
  complianceCsidSecret?: string;
  productionCsid?: string;
  productionCsidSecret?: string;
  reportingEndpoint?: string;
  clearanceEndpoint?: string;
  autoSubmitSimulation?: string | boolean;
  environment?: "SIMULATION" | "PRODUCTION";
  previousInvoiceHash?: string;
  invoiceCounter?: string | number;
};

export type ZatcaPhase2InvoiceInput = {
  saleId: string;
  invoiceNumber: string;
  uuid?: string;
  issuedAt: Date;
  seller: {
    name: string;
    vatNumber: string;
    crNumber?: string;
    address?: string;
  };
  buyer?: {
    name?: string | null;
    vatNumber?: string | null;
    address?: string | null;
  };
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
  lines: ZatcaLineItem[];
  privateKeyPem: string;
  certificatePem?: string;
  cryptographicStamp?: string;
  previousInvoiceHash?: string;
  invoiceCounter?: number;
};

export type ZatcaSignedInvoice = {
  uuid: string;
  invoiceHash: string;
  ecdsaSignature: string;
  publicKey: string;
  cryptographicStamp: string;
  qrPayload: string;
  unsignedXml: string;
  signedXml: string;
  xmlBase64: string;
};

export type ZatcaSubmissionResult = {
  status: "SKIPPED" | "REPORTED" | "CLEARED" | "FAILED";
  endpoint?: string;
  response?: unknown;
  error?: string;
};

export type ZatcaApiResult = {
  ok: boolean;
  endpoint: string;
  status: number;
  response: unknown;
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function amount(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function canonicalizeXml(xml: string): string {
  return xml.replace(/>\s+</g, "><").trim();
}

function sha256Base64(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("base64");
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function getPublicKeyBase64(privateKeyPem: string, certificatePem?: string): string {
  if (certificatePem?.trim()) {
    const cert = new X509Certificate(normalizePem(certificatePem));
    return cert.publicKey.export({ type: "spki", format: "der" }).toString("base64");
  }

  const publicKey = createPublicKey(createPrivateKey(normalizePem(privateKeyPem)));
  return publicKey.export({ type: "spki", format: "der" }).toString("base64");
}

function getCryptographicStamp(certificatePem?: string, configuredStamp?: string): string {
  if (configuredStamp?.trim()) return configuredStamp.trim();
  if (!certificatePem?.trim()) return "";

  const cert = new X509Certificate(normalizePem(certificatePem));
  return Buffer.from(cert.fingerprint256.replace(/:/g, ""), "hex").toString("base64");
}

function signInvoiceHash(invoiceHash: string, privateKeyPem: string): string {
  const signer = createSign("SHA256");
  signer.update(invoiceHash);
  signer.end();
  return signer.sign(normalizePem(privateKeyPem)).toString("base64");
}

function invoiceTypeCode(kind: ZatcaInvoiceKind): string {
  return kind === "standard" ? "388" : "388";
}

function invoiceTypeName(kind: ZatcaInvoiceKind): string {
  return kind === "standard" ? "0100000" : "0200000";
}

function buildLineXml(line: ZatcaLineItem): string {
  return `
    <cac:InvoiceLine>
      <cbc:ID>${esc(line.id)}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${line.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${amount(line.lineTotal)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${amount(line.taxAmount)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="SAR">${amount(line.lineTotal + line.taxAmount)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${esc(line.name)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${amount(line.taxRate)}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${amount(line.unitPrice)}</cbc:PriceAmount>
        <cbc:BaseQuantity unitCode="PCE">1</cbc:BaseQuantity>
      </cac:Price>
    </cac:InvoiceLine>`;
}

function buildZatcaInvoiceXml(
  input: ZatcaPhase2InvoiceInput,
  kind: ZatcaInvoiceKind,
  qrPayload?: string,
  signatureBlock?: string,
): string {
  const issueDate = input.issuedAt.toISOString().slice(0, 10);
  const issueTime = input.issuedAt.toISOString().slice(11, 19);
  const taxableAmount = Math.max(0, input.totals.subtotal - input.totals.discount);
  const pih = input.previousInvoiceHash || sha256Base64("0");
  const icv = input.invoiceCounter || 1;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  ${signatureBlock || "<ext:UBLExtensions/>"}
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(input.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${esc(input.uuid || input.saleId)}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${invoiceTypeName(kind)}">${invoiceTypeCode(kind)}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${icv}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(pih)}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  ${
    qrPayload
      ? `<cac:AdditionalDocumentReference>
    <cbc:ID>QR</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(qrPayload)}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>`
      : ""
  }
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="CRN">${esc(input.seller.crNumber || input.seller.vatNumber)}</cbc:ID></cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(input.seller.address || "Saudi Arabia")}</cbc:StreetName>
        <cbc:CityName>Riyadh</cbc:CityName>
        <cbc:CountrySubentity>Riyadh</cbc:CountrySubentity>
        <cbc:PostalZone>00000</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(input.seller.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${esc(input.seller.name)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(input.buyer?.address || "Saudi Arabia")}</cbc:StreetName>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${
        input.buyer?.vatNumber
          ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(input.buyer.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ""
      }
      <cac:PartyLegalEntity><cbc:RegistrationName>${esc(input.buyer?.name || "Walk-in Customer")}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:Delivery><cbc:ActualDeliveryDate>${issueDate}</cbc:ActualDeliveryDate></cac:Delivery>
  <cac:PaymentMeans><cbc:PaymentMeansCode>10</cbc:PaymentMeansCode></cac:PaymentMeans>
  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="SAR">${amount(input.totals.discount)}</cbc:Amount>
  </cac:AllowanceCharge>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${amount(input.totals.tax)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${amount(taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${amount(input.totals.tax)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${amount(input.lines[0]?.taxRate || 15)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${amount(input.totals.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${amount(taxableAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${amount(input.totals.total)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">${amount(input.totals.discount)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="SAR">${amount(input.totals.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${input.lines.map(buildLineXml).join("")}
</Invoice>`;
}

function buildSignatureBlock(signed: {
  invoiceHash: string;
  ecdsaSignature: string;
  publicKey: string;
  certificatePem?: string;
}): string {
  const certificate = signed.certificatePem
    ? normalizePem(signed.certificatePem)
        .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, "")
    : "";

  return `<ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
          <SignedInfo>
            <CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
            <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
            <Reference URI="">
              <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
              <DigestValue>${esc(signed.invoiceHash)}</DigestValue>
            </Reference>
          </SignedInfo>
          <SignatureValue>${esc(signed.ecdsaSignature)}</SignatureValue>
          <KeyInfo>
            <KeyValue>${esc(signed.publicKey)}</KeyValue>
            ${certificate ? `<X509Data><X509Certificate>${certificate}</X509Certificate></X509Data>` : ""}
          </KeyInfo>
        </Signature>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>`;
}

export function inferZatcaInvoiceKind(buyerVatNumber?: string | null): ZatcaInvoiceKind {
  return buyerVatNumber?.trim() ? "standard" : "simplified";
}

export function signZatcaPhase2Invoice(
  input: ZatcaPhase2InvoiceInput,
  kind: ZatcaInvoiceKind = inferZatcaInvoiceKind(input.buyer?.vatNumber),
): ZatcaSignedInvoice {
  if (!input.privateKeyPem?.trim()) {
    throw new Error("ZATCA Phase 2 private key is required");
  }

  const uuid = input.uuid || randomUUID();
  const unsignedXml = buildZatcaInvoiceXml({ ...input, uuid }, kind);
  const invoiceHash = sha256Base64(canonicalizeXml(unsignedXml));
  const ecdsaSignature = signInvoiceHash(invoiceHash, input.privateKeyPem);
  const publicKey = getPublicKeyBase64(input.privateKeyPem, input.certificatePem);
  const cryptographicStamp = getCryptographicStamp(input.certificatePem, input.cryptographicStamp);

  const qrPayload = buildZatcaPhase2Payload(
    input.seller.name,
    input.seller.vatNumber,
    formatZatcaTimestamp(input.issuedAt),
    formatZatcaTotal(input.totals.total),
    formatZatcaTotal(input.totals.tax),
    invoiceHash,
    ecdsaSignature,
    publicKey,
    cryptographicStamp,
  );

  const signatureBlock = buildSignatureBlock({
    invoiceHash,
    ecdsaSignature,
    publicKey,
    certificatePem: input.certificatePem,
  });
  const signedXml = buildZatcaInvoiceXml({ ...input, uuid }, kind, qrPayload, signatureBlock);

  return {
    uuid,
    invoiceHash,
    ecdsaSignature,
    publicKey,
    cryptographicStamp,
    qrPayload,
    unsignedXml,
    signedXml,
    xmlBase64: Buffer.from(signedXml, "utf8").toString("base64"),
  };
}

export async function writeZatcaInvoiceXml(
  companyId: string,
  saleId: string,
  signedXml: string,
): Promise<string> {
  const dir = path.join(process.cwd(), "storage", "zatca", companyId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${saleId}.xml`);
  await writeFile(filePath, signedXml, "utf8");
  return filePath;
}

export async function submitZatcaSimulationInvoice(args: {
  signedInvoice: ZatcaSignedInvoice;
  settings: ZatcaPhase2Settings;
  kind: ZatcaInvoiceKind;
}): Promise<ZatcaSubmissionResult> {
  const secret =
    args.kind === "standard"
      ? args.settings.productionCsidSecret || args.settings.complianceCsidSecret
      : args.settings.complianceCsidSecret || args.settings.productionCsidSecret;
  const csid =
    args.kind === "standard"
      ? args.settings.productionCsid || args.settings.complianceCsid
      : args.settings.complianceCsid || args.settings.productionCsid;

  if (!csid || !secret) {
    return { status: "SKIPPED", error: "Missing ZATCA CSID or CSID secret" };
  }

  const endpoint =
    args.kind === "standard"
      ? args.settings.clearanceEndpoint ||
        (args.settings.environment === "PRODUCTION"
          ? ZATCA_PRODUCTION_ENDPOINTS.clearanceSingle
          : ZATCA_SIMULATION_ENDPOINTS.clearanceSingle)
      : args.settings.reportingEndpoint ||
        (args.settings.environment === "PRODUCTION"
          ? ZATCA_PRODUCTION_ENDPOINTS.reportingSingle
          : ZATCA_SIMULATION_ENDPOINTS.reportingSingle);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": "en",
        "Accept-Version": "V2",
        Authorization: `Basic ${Buffer.from(`${csid}:${secret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        invoiceHash: args.signedInvoice.invoiceHash,
        uuid: args.signedInvoice.uuid,
        invoice: args.signedInvoice.xmlBase64,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        status: "FAILED",
        endpoint,
        response: payload,
        error: `ZATCA API returned HTTP ${response.status}`,
      };
    }

    return {
      status: args.kind === "standard" ? "CLEARED" : "REPORTED",
      endpoint,
      response: payload,
    };
  } catch (error) {
    return {
      status: "FAILED",
      endpoint,
      error: error instanceof Error ? error.message : "ZATCA submission failed",
    };
  }
}

async function parseZatcaResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => "");
}

export async function requestZatcaSimulationComplianceCsid(args: {
  otp: string;
  csrPem: string;
  endpoint?: string;
}): Promise<ZatcaApiResult> {
  const endpoint = args.endpoint || ZATCA_SIMULATION_ENDPOINTS.compliance;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Language": "en",
      "Accept-Version": "V2",
      OTP: args.otp,
    },
    body: JSON.stringify({
      csr: normalizePem(args.csrPem)
        .replace(/-----BEGIN CERTIFICATE REQUEST-----|-----END CERTIFICATE REQUEST-----|\s/g, ""),
    }),
  });

  return {
    ok: response.ok,
    endpoint,
    status: response.status,
    response: await parseZatcaResponse(response),
  };
}

export async function runZatcaSimulationComplianceCheck(args: {
  signedInvoice: ZatcaSignedInvoice;
  complianceCsid: string;
  complianceCsidSecret: string;
  endpoint?: string;
}): Promise<ZatcaApiResult> {
  const endpoint = args.endpoint || ZATCA_SIMULATION_ENDPOINTS.complianceInvoices;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Language": "en",
      "Accept-Version": "V2",
      Authorization: `Basic ${Buffer.from(
        `${args.complianceCsid}:${args.complianceCsidSecret}`,
      ).toString("base64")}`,
    },
    body: JSON.stringify({
      invoiceHash: args.signedInvoice.invoiceHash,
      uuid: args.signedInvoice.uuid,
      invoice: args.signedInvoice.xmlBase64,
    }),
  });

  return {
    ok: response.ok,
    endpoint,
    status: response.status,
    response: await parseZatcaResponse(response),
  };
}

export async function requestZatcaSimulationProductionCsid(args: {
  complianceCsid: string;
  complianceCsidSecret: string;
  complianceRequestId?: string;
  endpoint?: string;
}): Promise<ZatcaApiResult> {
  const endpoint = args.endpoint || ZATCA_SIMULATION_ENDPOINTS.productionCsids;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Language": "en",
      "Accept-Version": "V2",
      Authorization: `Basic ${Buffer.from(
        `${args.complianceCsid}:${args.complianceCsidSecret}`,
      ).toString("base64")}`,
    },
    body: JSON.stringify(
      args.complianceRequestId ? { compliance_request_id: args.complianceRequestId } : {},
    ),
  });

  return {
    ok: response.ok,
    endpoint,
    status: response.status,
    response: await parseZatcaResponse(response),
  };
}
