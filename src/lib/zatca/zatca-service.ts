import { prisma } from "@/lib/prisma";
import type { ZatcaClientResult, ZatcaInvoiceInput, ZatcaMode } from "./config";
import { generateZatcaCsr } from "./csr-generator";
import { validateLocalInvoice } from "./local-validator";
import { productionClient } from "./production-client";
import { generateLocalCryptographicStamp } from "./qr-generator";
import { signZatcaInvoice } from "./signer";
import { simulationClient } from "./simulation-client";
import { inferInvoiceKind } from "./xml-generator";

export type ZatcaProcessResult = {
  mode: ZatcaMode;
  uuid: string;
  invoiceHash: string;
  previousInvoiceHash: string | null;
  qrPayload: string | null;
  xml: string;
  status: string;
  response: unknown;
};

function responseJson(response: unknown) {
  return response === undefined ? undefined : (response as any);
}

export async function processZatcaInvoice(args: {
  companyId: string;
  input: ZatcaInvoiceInput;
}): Promise<ZatcaProcessResult | null> {
  const setting = await prisma.zatcaSetting.findUnique({ where: { companyId: args.companyId } });
  if (!setting?.enabled) return null;

  const kind = inferInvoiceKind(args.input.buyer?.vatNumber);
  const input = {
    ...args.input,
    previousInvoiceHash: setting.previousInvoiceHash,
    invoiceCounter: setting.invoiceCounter,
  };
  const mode = setting.mode as ZatcaMode;
  let uuid: string;
  let invoiceHash: string;
  let qrPayload: string | null;
  let xml: string;
  let result: ZatcaClientResult;
  let generatedLocalSigningMaterial:
    | {
        privateKeyPem: string;
        csrPem: string;
      }
    | undefined;

  if (mode === "LOCAL") {
    if (!setting.privateKeyPem) {
      const generated = generateZatcaCsr({
        environment: "SIMULATION",
        sellerName: input.seller.sellerName,
        vatNumber: input.seller.sellerVatNumber,
        branchName: input.seller.branchName || setting.deviceName || "Cloud Daftar",
        location: input.seller.address || input.seller.branchName || "Cloud Daftar",
        industry: "Invoicing",
        invoiceType: "1100",
      });
      generatedLocalSigningMaterial = {
        privateKeyPem: generated.privateKeyPem,
        csrPem: generated.csrPem,
      };
    }
    const privateKeyPem = setting.privateKeyPem || generatedLocalSigningMaterial!.privateKeyPem;
    const signed = signZatcaInvoice({
      input,
      kind,
      privateKeyPem,
      cryptographicStamp: generateLocalCryptographicStamp(privateKeyPem),
    });
    uuid = signed.uuid;
    xml = signed.signedXml;
    invoiceHash = signed.invoiceHash;
    qrPayload = signed.qrPayload;
    const validation = validateLocalInvoice(input, xml);
    result = {
      status: validation.ok ? "LOCAL_STORED" : "FAILED",
      response: {
        ...validation,
        localSigning: generatedLocalSigningMaterial ? "GENERATED" : "REUSED",
      },
      error: validation.ok ? undefined : validation.issues.join("; "),
    };
  } else {
    if (!setting.privateKeyPem) {
      throw new Error(`ZATCA ${mode.toLowerCase()} signing key is missing`);
    }
    const signed = signZatcaInvoice({
      input,
      kind,
      privateKeyPem: setting.privateKeyPem,
      certificatePem: setting.certificatePem,
    });
    uuid = signed.uuid;
    xml = signed.signedXml;
    invoiceHash = signed.invoiceHash;
    qrPayload = signed.qrPayload;
    const document = {
      kind,
      uuid,
      invoiceHash,
      xmlBase64: signed.xmlBase64,
    };
    result =
      mode === "SIMULATION"
        ? await simulationClient.submitDocument(document, {
            csid: setting.productionCsid || setting.complianceCsid,
            secret: setting.productionSecret || setting.complianceSecret,
          })
        : await productionClient.submitDocument(document, {
            csid: setting.productionCsid,
            secret: setting.productionSecret,
          });
  }

  await prisma.$transaction([
    prisma.zatcaInvoiceLog.create({
      data: {
        companyId: args.companyId,
        saleId: args.input.saleId,
        mode,
        uuid,
        invoiceHash,
        previousInvoiceHash: setting.previousInvoiceHash,
        qrPayload,
        xml,
        status: result.status,
        responseJson: responseJson(result),
      },
    }),
    prisma.zatcaSetting.update({
      where: { id: setting.id },
      data: {
        previousInvoiceHash: invoiceHash,
        invoiceCounter: { increment: 1 },
        status: result.status === "FAILED" ? "FAILED" : setting.status,
        ...(generatedLocalSigningMaterial
          ? {
              privateKeyPem: generatedLocalSigningMaterial.privateKeyPem,
              csrPem: generatedLocalSigningMaterial.csrPem,
            }
          : {}),
      },
    }),
  ]);

  return {
    mode,
    uuid,
    invoiceHash,
    previousInvoiceHash: setting.previousInvoiceHash,
    qrPayload,
    xml,
    status: result.status,
    response: result,
  };
}
