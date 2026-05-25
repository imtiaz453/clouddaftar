import type { ZatcaClientCredentials, ZatcaClientDocument, ZatcaClientResult } from "./config";
import { ZATCA_SIMULATION_ENDPOINTS } from "./config";

async function submitDocument(
  document: ZatcaClientDocument,
  credentials: ZatcaClientCredentials,
): Promise<ZatcaClientResult> {
  if (!credentials.csid || !credentials.secret) {
    return { status: "SKIPPED", error: "Simulation CSID credentials are missing" };
  }
  const endpoint =
    document.kind === "standard"
      ? ZATCA_SIMULATION_ENDPOINTS.clearanceSingle
      : ZATCA_SIMULATION_ENDPOINTS.reportingSingle;
  try {
    // TODO: Use ZATCA Simulation CSID credentials issued for this tenant device.
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
        error: `ZATCA Simulation returned HTTP ${response.status}`,
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
      error: error instanceof Error ? error.message : "ZATCA Simulation request failed",
    };
  }
}

export const simulationClient = { submitDocument };
