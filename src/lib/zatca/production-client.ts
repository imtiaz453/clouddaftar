import type { ZatcaClientCredentials, ZatcaClientDocument, ZatcaClientResult } from "./config";
import { ZATCA_PRODUCTION_ENDPOINTS } from "./config";

async function submitDocument(
  document: ZatcaClientDocument,
  credentials: ZatcaClientCredentials,
): Promise<ZatcaClientResult> {
  if (!credentials.csid || !credentials.secret) {
    return { status: "SKIPPED", error: "Production CSID credentials are missing" };
  }
  const endpoint =
    document.kind === "standard"
      ? ZATCA_PRODUCTION_ENDPOINTS.clearanceSingle
      : ZATCA_PRODUCTION_ENDPOINTS.reportingSingle;
  try {
    // TODO: Enable only after the tenant has a real production CSID and ZATCA certificate.
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": "en",
        "Accept-Version": "V2",
        Authorization: `Basic ${Buffer.from(`${credentials.csid}:${credentials.secret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        invoiceHash: document.invoiceHash,
        uuid: document.uuid,
        invoice: document.xmlBase64,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        status: "FAILED",
        endpoint,
        response: payload,
        error: `ZATCA Production returned HTTP ${response.status}`,
      };
    }
    return {
      status: document.kind === "standard" ? "CLEARED" : "REPORTED",
      endpoint,
      response: payload,
    };
  } catch (error) {
    return {
      status: "FAILED",
      endpoint,
      error: error instanceof Error ? error.message : "ZATCA Production request failed",
    };
  }
}

export const productionClient = { submitDocument };
