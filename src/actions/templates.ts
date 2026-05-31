"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, requirePermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";
import { createAuditLog } from "@/lib/audit";

type TemplateUse = "invoice" | "quotation" | "thermal" | "purchase_order";

function normalizeTemplateType(value: unknown): TemplateUse {
  return value === "quotation" ||
    value === "thermal" ||
    value === "purchase_order" ||
    value === "invoice"
    ? value
    : "invoice";
}

export async function getTemplates() {
  await requirePermission(PERMISSIONS.TEMPLATES_VIEW);
  const user = await requireCompanyAuth();
  const { companyId } = user;

  return prisma.invoiceTemplate.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTemplate(id: string) {
  await requirePermission(PERMISSIONS.TEMPLATES_VIEW);
  const user = await requireCompanyAuth();
  const { companyId } = user;

  return prisma.invoiceTemplate.findFirst({
    where: { id, companyId },
  });
}

export async function createTemplate(data: {
  name: string;
  isDefault?: boolean;
  type?: TemplateUse;
  showLogo?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  showBarcode?: boolean;
  showQR?: boolean;
  showSignature?: boolean;
  headerText?: string;
  footerText?: string;
  primaryColor?: string;
  accentColor?: string;
  paperSize?: string;
  fontSize?: string;
  margin?: string;
  advancedDesign?: Record<string, any>;
}) {
  await requirePermission(PERMISSIONS.TEMPLATES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const templateType = normalizeTemplateType(data.type);

  if (data.isDefault) {
    await prisma.invoiceTemplate.updateMany({
      where: { companyId, templateType },
      data: { isDefault: false },
    });
  }

  const template = await prisma.invoiceTemplate.create({
    data: {
      name: data.name,
      companyId,
      templateType,
      isDefault: data.isDefault ?? false,
      showLogo: data.showLogo ?? true,
      showHeader: data.showHeader ?? true,
      showFooter: data.showFooter ?? true,
      showBarcode: data.showBarcode ?? false,
      showQR: data.showQR ?? false,
      showSignature: data.showSignature ?? false,
      headerText: data.headerText || null,
      footerText: data.footerText || null,
      primaryColor: data.primaryColor || "#0f172a",
      accentColor: data.accentColor || "#3b82f6",
      paperSize: data.paperSize || "A4",
      fontSize: data.fontSize || "normal",
      margin: data.margin || "normal",
      advancedDesign: data.advancedDesign || {},
    },
  });

  if (data.isDefault) {
    const upsertData =
      templateType === "quotation"
        ? { defaultQuotationTemplate: template.id }
        : templateType === "purchase_order"
          ? { defaultPurchaseOrderTemplate: template.id }
          : templateType === "thermal"
            ? { defaultThermalInvoiceTemplate: template.id }
        : { defaultInvoiceTemplate: template.id };
    await prisma.companySettings.upsert({
      where: { companyId },
      create: { companyId, ...upsertData },
      update: upsertData,
    });
  }

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "InvoiceTemplate",
    entityId: template.id,
    metadata: { name: template.name },
  });

  revalidatePath("/settings/templates");
  return template;
}

export async function updateTemplate(
  id: string,
  data: {
    name?: string;
    isDefault?: boolean;
    type?: TemplateUse;
    showLogo?: boolean;
    showHeader?: boolean;
    showFooter?: boolean;
    showBarcode?: boolean;
    showQR?: boolean;
    showSignature?: boolean;
    headerText?: string | null;
    footerText?: string | null;
    primaryColor?: string;
    accentColor?: string;
    paperSize?: string;
    fontSize?: string;
    margin?: string;
    advancedDesign?: Record<string, any>;
  },
) {
  await requirePermission(PERMISSIONS.TEMPLATES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const templateType = normalizeTemplateType(data.type);

  const existing = await prisma.invoiceTemplate.findFirst({
    where: { id, companyId },
  });
  if (!existing) throw new Error("Template not found");

  if (data.isDefault) {
    await prisma.invoiceTemplate.updateMany({
      where: { companyId, templateType, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const template = await prisma.invoiceTemplate.update({
    where: { id },
    data: {
      name: data.name,
      templateType,
      isDefault: data.isDefault,
      showLogo: data.showLogo,
      showHeader: data.showHeader,
      showFooter: data.showFooter,
      showBarcode: data.showBarcode,
      showQR: data.showQR,
      showSignature: data.showSignature,
      headerText: data.headerText,
      footerText: data.footerText,
      primaryColor: data.primaryColor,
      accentColor: data.accentColor,
      paperSize: data.paperSize,
      fontSize: data.fontSize,
      margin: data.margin,
      advancedDesign: data.advancedDesign || {},
    },
  });

  if (data.isDefault) {
    const upsertData =
      templateType === "quotation"
        ? { defaultQuotationTemplate: template.id }
        : templateType === "purchase_order"
          ? { defaultPurchaseOrderTemplate: template.id }
          : templateType === "thermal"
            ? { defaultThermalInvoiceTemplate: template.id }
        : { defaultInvoiceTemplate: template.id };
    await prisma.companySettings.upsert({
      where: { companyId },
      create: { companyId, ...upsertData },
      update: upsertData,
    });
  }

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "InvoiceTemplate",
    entityId: id,
    metadata: { changes: Object.keys(data) },
  });

  revalidatePath("/settings/templates");
  return template;
}

export async function duplicateTemplate(id: string) {
  await requirePermission(PERMISSIONS.TEMPLATES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const original = await prisma.invoiceTemplate.findFirst({
    where: { id, companyId },
  });
  if (!original) throw new Error("Template not found");

  const template = await prisma.invoiceTemplate.create({
    data: {
      name: `${original.name} (Copy)`,
      companyId,
      templateType: original.templateType,
      isDefault: false,
      showLogo: original.showLogo,
      showHeader: original.showHeader,
      showFooter: original.showFooter,
      showBarcode: original.showBarcode,
      showQR: original.showQR,
      showSignature: original.showSignature,
      headerText: original.headerText,
      footerText: original.footerText,
      primaryColor: original.primaryColor,
      accentColor: original.accentColor,
      paperSize: original.paperSize,
      fontSize: original.fontSize,
      margin: original.margin,
      advancedDesign: original.advancedDesign || {},
    },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "InvoiceTemplate",
    entityId: template.id,
    metadata: { name: template.name, duplicatedFrom: id },
  });

  revalidatePath("/settings/templates");
  return template;
}

export async function deleteTemplate(id: string) {
  await requirePermission(PERMISSIONS.TEMPLATES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const template = await prisma.invoiceTemplate.findFirst({
    where: { id, companyId },
  });
  if (!template) throw new Error("Template not found");

  await prisma.invoiceTemplate.delete({ where: { id } });

  await createAuditLog({
    userId,
    companyId,
    action: "DELETE",
    entity: "InvoiceTemplate",
    entityId: id,
    metadata: { name: template.name },
  });

  revalidatePath("/settings/templates");
}

export async function setDefaultTemplate(
  id: string,
  type: TemplateUse = "invoice",
) {
  await requirePermission(PERMISSIONS.TEMPLATES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const template = await prisma.invoiceTemplate.findFirst({ where: { id, companyId } });
  if (!template) throw new Error("Template not found");
  const templateType = normalizeTemplateType(type);

  await prisma.invoiceTemplate.updateMany({
    where: { companyId, templateType },
    data: { isDefault: false },
  });

  await prisma.invoiceTemplate.update({
    where: { id },
    data: { isDefault: true, templateType },
  });

  const upsertData =
    templateType === "quotation"
      ? { defaultQuotationTemplate: id }
      : templateType === "purchase_order"
        ? { defaultPurchaseOrderTemplate: id }
      : templateType === "thermal"
        ? { defaultThermalInvoiceTemplate: id }
        : { defaultInvoiceTemplate: id };

  await prisma.companySettings.upsert({
    where: { companyId },
    create: { companyId, ...upsertData },
    update: upsertData,
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "InvoiceTemplate",
    entityId: id,
    metadata: { type: "set_default", templateType },
  });

  revalidatePath("/settings/templates");
}

export async function getCompanySettings() {
  await requirePermission(PERMISSIONS.TEMPLATES_VIEW);
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const [settings, templates] = await Promise.all([
    prisma.companySettings.findUnique({ where: { companyId } }),
    prisma.invoiceTemplate.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
  ]);

  return { settings, templates };
}
