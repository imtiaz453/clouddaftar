import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const templates = await prisma.invoiceTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: templates });
  } catch {
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const companyId = (session.user as any).companyId;
    const userId = (session.user as any).id;
    const body = await req.json();
    const templateType = normalizeTemplateType(body.type);

    if (body.isDefault) {
      await prisma.invoiceTemplate.updateMany({
        where: { companyId, templateType },
        data: { isDefault: false },
      });
    }

    const template = await prisma.invoiceTemplate.create({
      data: {
        name: body.name,
        companyId,
        templateType,
        isDefault: body.isDefault ?? false,
        showLogo: body.showLogo ?? true,
        showHeader: body.showHeader ?? true,
        showFooter: body.showFooter ?? true,
        showBarcode: body.showBarcode ?? false,
        showQR: body.showQR ?? false,
        showSignature: body.showSignature ?? false,
        headerText: body.headerText || null,
        footerText: body.footerText || null,
        primaryColor: body.primaryColor || "#0f172a",
        accentColor: body.accentColor || "#3b82f6",
        paperSize: body.paperSize || "A4",
        fontSize: body.fontSize || "normal",
        margin: body.margin || "normal",
        advancedDesign: body.advancedDesign || {},
      },
    });

    if (body.isDefault) {
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

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
