import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";

type TemplateUse = "invoice" | "quotation" | "thermal" | "purchase_order";

function normalizeTemplateType(value: unknown): TemplateUse {
  return value === "quotation" ||
    value === "thermal" ||
    value === "purchase_order" ||
    value === "invoice"
    ? value
    : "invoice";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.TEMPLATES_MANAGE);
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const companyId = (session.user as any).companyId;
    const userId = (session.user as any).id;
    const templateType = normalizeTemplateType(req.nextUrl.searchParams.get("type"));

    const existing = await prisma.invoiceTemplate.findFirst({ where: { id, companyId } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

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
      userId, companyId, action: "UPDATE", entity: "InvoiceTemplate",
      entityId: id, metadata: { type: "set_default", templateType },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to set default template" }, { status: 500 });
  }
}
