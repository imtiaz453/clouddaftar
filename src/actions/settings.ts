"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { slugify } from "@/lib/utils";
import { normalizeRolePermissionOverrides } from "@/lib/constants";

export async function getCompanySettings() {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { settings: true, theme: true, zatcaEgsUnits: true, zatcaSetting: true },
  });

  return company;
}

export async function updateCompanySettings(data: Record<string, unknown>) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const updateData: Record<string, unknown> = {};
  const companyFields = [
    "name",
    "phone",
    "email",
    "address",
    "city",
    "state",
    "zipCode",
    "country",
    "taxId",
    "taxName",
    "taxRate",
    "currency",
    "currencySymbol",
    "timezone",
    "dateFormat",
    "fiscalYearStart",
    "website",
    "logo",
  ];
  for (const field of companyFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  if (data.name && typeof data.name === "string") {
    updateData.slug = slugify(data.name) + "-" + companyId.slice(0, 4);
  }

  await prisma.company.update({
    where: { id: companyId },
    data: updateData,
  });

  revalidatePath("/settings");
}

export async function updateCompanySettingsData(data: Record<string, unknown>) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const settingsFields = [
    "invoicePrefix",
    "salesOrderPrefix",
    "proformaInvoicePrefix",
    "quotationPrefix",
    "purchaseOrderPrefix",
    "invoiceSuffix",
    "invoiceNumberLength",
    "defaultInvoiceTemplate",
    "defaultThermalInvoiceTemplate",
    "defaultQuotationTemplate",
    "defaultPurchaseOrderTemplate",
    "lowStockThreshold",
    "enableNegativeStock",
    "enableBarcodeScanning",
    "enableExpiryTracking",
    "autoGenerateSKU",
    "skuPrefix",
    "defaultPaymentMethod",
    "defaultTaxRate",
    "currencyPosition",
    "thousandSeparator",
    "decimalSeparator",
    "decimalPlaces",
    "language",
    "rolePermissions",
    "printerBridgeSettings",
  ];
  const updateData: Record<string, unknown> = {};
  for (const field of settingsFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  await prisma.companySettings.upsert({
    where: { companyId },
    create: { companyId, ...updateData } as any,
    update: updateData as any,
  });

  revalidatePath("/settings");
}

export async function updatePermissionSettings(data: { rolePermissions?: unknown }) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const rolePermissions = normalizeRolePermissionOverrides(data.rolePermissions);

  await prisma.companySettings.upsert({
    where: { companyId },
    create: { companyId, rolePermissions } as any,
    update: { rolePermissions } as any,
  });

  revalidatePath("/users/roles");
  revalidatePath("/settings");
}

export async function updateThemeSettings(data: {
  sidebarColor?: string;
  sidebarStyle?: string;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  layoutDensity?: string;
  isDarkMode?: boolean;
}) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const updateData: Record<string, unknown> = {};
  const themeFields = [
    "sidebarColor",
    "sidebarStyle",
    "primaryColor",
    "accentColor",
    "fontFamily",
    "borderRadius",
    "layoutDensity",
    "isDarkMode",
  ];
  for (const field of themeFields) {
    if (data[field as keyof typeof data] !== undefined)
      updateData[field] = data[field as keyof typeof data];
  }

  await prisma.themeSettings.upsert({
    where: { companyId },
    create: { companyId, ...updateData } as any,
    update: updateData as any,
  });

  revalidatePath("/settings");
}

export async function updateTaxComplianceSettings(data: {
  taxComplianceMode?: string;
  fbrCredentials?: Record<string, string>;
  fbrPosId?: string;
  zatcaSettings?: Record<string, unknown>;
}) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const updateData: Record<string, unknown> = {};
  if (data.taxComplianceMode !== undefined) updateData.taxComplianceMode = data.taxComplianceMode;
  if (data.fbrCredentials !== undefined) updateData.fbrCredentials = data.fbrCredentials;
  if (data.fbrPosId !== undefined) updateData.fbrPosId = data.fbrPosId;
  if (data.zatcaSettings !== undefined) updateData.zatcaSettings = data.zatcaSettings;

  await prisma.companySettings.upsert({
    where: { companyId },
    create: { companyId, ...updateData } as any,
    update: updateData as any,
  });

  if (data.zatcaSettings !== undefined) {
    const zatca = data.zatcaSettings;
    const enabled = data.taxComplianceMode === "ZATCA" && zatca.enabled !== false;
    await prisma.zatcaSetting.upsert({
      where: { companyId },
      create: {
        companyId,
        enabled,
        mode: String(zatca.mode || "LOCAL"),
        sellerVatNumber: String(zatca.vatRegNo || "") || null,
        sellerName: String(zatca.sellerName || "") || null,
        branchName: String(zatca.branchName || "") || null,
        address: String(zatca.address || "") || null,
        crNumber: String(zatca.crNo || "") || null,
        deviceName: String(zatca.deviceName || "") || null,
        otp: String(zatca.otp || "") || null,
      },
      update: {
        enabled,
        mode: String(zatca.mode || "LOCAL"),
        sellerVatNumber: String(zatca.vatRegNo || "") || null,
        sellerName: String(zatca.sellerName || "") || null,
        branchName: String(zatca.branchName || "") || null,
        address: String(zatca.address || "") || null,
        crNumber: String(zatca.crNo || "") || null,
        deviceName: String(zatca.deviceName || "") || null,
        otp: String(zatca.otp || "") || null,
      },
    });
  }

  revalidatePath("/settings");
}

export async function updateCompanyLogo(formData: FormData) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const logo = formData.get("logo") as string;
  if (!logo) throw new Error("Logo URL is required");

  await prisma.company.update({
    where: { id: companyId },
    data: { logo },
  });

  revalidatePath("/settings");
}
