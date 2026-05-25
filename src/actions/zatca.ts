"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { certificateTokenToPem, generateZatcaCsr } from "@/lib/zatca/csr-generator";
import { requestZatcaSimulationComplianceCsid } from "@/lib/tax/zatca-phase2";

type JsonObject = Record<string, any>;

function pickApiValue(response: unknown, keys: string[]) {
  if (!response || typeof response !== "object") return undefined;
  const candidates: JsonObject[] = [response as JsonObject];
  if ((response as JsonObject).data && typeof (response as JsonObject).data === "object") {
    candidates.push((response as JsonObject).data);
  }
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value);
    }
  }
  return undefined;
}

async function requireZatcaSetting() {
  const user = await requireCompanyAuth();
  const setting = await prisma.zatcaSetting.findUnique({ where: { companyId: user.companyId } });
  if (!setting?.enabled) throw new Error("Enable and save ZATCA settings first");
  if (!setting.sellerName?.trim() || !/^\d{15}$/.test(setting.sellerVatNumber || "")) {
    throw new Error("Seller name and 15-digit VAT number are required");
  }
  return { user, setting };
}

async function refreshSettings() {
  revalidatePath("/settings");
}

export async function generateZatcaSettingsCsr() {
  const { setting } = await requireZatcaSetting();
  const generated = generateZatcaCsr({
    environment: setting.mode === "PRODUCTION" ? "PRODUCTION" : "SIMULATION",
    sellerName: setting.sellerName!,
    vatNumber: setting.sellerVatNumber!,
    branchName: setting.branchName || setting.deviceName || "Cloud Daftar",
    location: setting.address || setting.branchName || "Cloud Daftar",
    industry: "Invoicing",
    invoiceType: "1100",
  });
  // TODO: Encrypt ZATCA private keys and CSID secrets at rest before live production.
  const updated = await prisma.zatcaSetting.update({
    where: { id: setting.id },
    data: {
      privateKeyPem: generated.privateKeyPem,
      csrPem: generated.csrPem,
      status: "CSR_READY",
    },
  });
  await refreshSettings();
  return updated;
}

export async function onboardZatcaDevice() {
  const { setting } = await requireZatcaSetting();
  if (setting.mode === "LOCAL") {
    return { ok: true, mode: "LOCAL", message: "Local mode does not require onboarding" };
  }
  if (setting.mode === "PRODUCTION") {
    // TODO: Add real production compliance and production CSID onboarding after tenant credentials exist.
    throw new Error("Production onboarding requires a real ZATCA production OTP and CSID flow");
  }
  if (!setting.otp?.trim()) throw new Error("OTP is required for Simulation onboarding");
  if (!setting.csrPem?.trim()) throw new Error("Generate CSR before onboarding the device");

  const result = await requestZatcaSimulationComplianceCsid({
    otp: setting.otp,
    csrPem: setting.csrPem,
  });
  const complianceCsid = pickApiValue(result.response, [
    "binarySecurityToken",
    "binary_security_token",
    "token",
  ]);
  const complianceSecret = pickApiValue(result.response, ["secret", "Secret"]);
  const complianceRequestId = pickApiValue(result.response, [
    "requestID",
    "requestId",
    "request_id",
    "compliance_request_id",
  ]);

  await prisma.zatcaSetting.update({
    where: { id: setting.id },
    data: {
      status: result.ok && complianceCsid && complianceSecret ? "ONBOARDED" : "FAILED",
      complianceCsid: complianceCsid || setting.complianceCsid,
      complianceSecret: complianceSecret || setting.complianceSecret,
      complianceRequestId: complianceRequestId || setting.complianceRequestId,
      certificatePem: certificateTokenToPem(complianceCsid) || setting.certificatePem,
      lastTestAt: new Date(),
      lastTestResult: { action: "ONBOARD_DEVICE", result } as any,
    },
  });
  await refreshSettings();
  if (!result.ok) throw new Error(`ZATCA Simulation returned HTTP ${result.status}`);
  return result;
}

export async function testZatcaConnection() {
  const { setting } = await requireZatcaSetting();
  const result =
    setting.mode === "LOCAL"
      ? {
          ok: true,
          mode: "LOCAL",
          message: "Local ZATCA mode is ready to store XML, hash, and QR data",
        }
      : {
          ok: Boolean(setting.privateKeyPem && setting.csrPem && setting.complianceCsid),
          mode: setting.mode,
          message:
            setting.mode === "PRODUCTION"
              ? "Production needs a real production CSID before invoice submission"
              : "Simulation requires onboarding credentials before invoice submission",
        };

  await prisma.zatcaSetting.update({
    where: { id: setting.id },
    data: {
      lastTestAt: new Date(),
      lastTestResult: result as any,
      status: result.ok && setting.mode === "LOCAL" ? "LOCAL_READY" : setting.status,
    },
  });
  await refreshSettings();
  if (!result.ok) throw new Error(result.message);
  return result;
}
