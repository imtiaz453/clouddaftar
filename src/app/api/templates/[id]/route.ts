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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const companyId = (session.user as any).companyId;
    const userId = (session.user as any).id;
    const body = await req.json();
    const templateType = normalizeTemplateType(body.type);

    const existing = await prisma.invoiceTemplate.findFirst({ where: { id, companyId } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    if (body.isDefault) {
      await prisma.invoiceTemplate.updateMany({
        where: { companyId, templateType, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const template = await prisma.invoiceTemplate.update({
      where: { id },
      data: {
        name: body.name,
        templateType,
        isDefault: body.isDefault,
        showLogo: body.showLogo,
        showHeader: body.showHeader,
        showFooter: body.showFooter,
        showBarcode: body.showBarcode,
        showQR: body.showQR,
        showSignature: body.showSignature,
        headerText: body.headerText,
        footerText: body.footerText,
        primaryColor: body.primaryColor,
        accentColor: body.accentColor,
        paperSize: body.paperSize,
        fontSize: body.fontSize,
        margin: body.margin,
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
      action: "UPDATE",
      entity: "InvoiceTemplate",
      entityId: id,
      metadata: { changes: Object.keys(body) },
    });

    return NextResponse.json({ success: true, data: template });
  } catch {
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const companyId = (session.user as any).companyId;
    const userId = (session.user as any).id;

    const existing = await prisma.invoiceTemplate.findFirst({ where: { id, companyId } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    await prisma.invoiceTemplate.delete({ where: { id } });

    await createAuditLog({
      userId,
      companyId,
      action: "DELETE",
      entity: "InvoiceTemplate",
      entityId: id,
      metadata: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
