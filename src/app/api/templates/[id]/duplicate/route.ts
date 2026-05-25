import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const companyId = (session.user as any).companyId;
    const userId = (session.user as any).id;

    const original = await prisma.invoiceTemplate.findFirst({ where: { id, companyId } });
    if (!original) return NextResponse.json({ error: "Template not found" }, { status: 404 });

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

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to duplicate template" }, { status: 500 });
  }
}
