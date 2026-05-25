import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { renderDocument, buildRenderDataFromQuotation } from "@/components/templates/renderer";
import { renderAdvancedDocument } from "@/components/templates/advanced-template";
import { getTemplateDef, type RenderOptions } from "@/lib/template-registry";
import { resolveTaxLabel } from "@/lib/tax-label";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const companyId = (session.user as any).companyId;

    const quotation = await prisma.quotation.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } },
        createdBy: { select: { name: true } },
        company: {
          include: { theme: true, settings: true },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const companyData = quotation.company as any;
    const settings = companyData?.settings || {};
    const theme = companyData?.theme || {};

    let templateId =
      req.nextUrl.searchParams.get("template") ||
      settings.defaultQuotationTemplate ||
      "quotation-modern-minimal";
    let templateDef = getTemplateDef(templateId);
    let customTemplate: any = null;
    if (!templateDef) {
      customTemplate = await prisma.invoiceTemplate.findFirst({
        where: { id: templateId, companyId },
      });
    }
    if ((templateDef && templateDef.type !== "quotation") || (!templateDef && !customTemplate)) {
      templateId = "quotation-modern-minimal";
      templateDef = getTemplateDef(templateId);
      customTemplate = null;
    }

    const data = buildRenderDataFromQuotation(quotation as any);

    const opts: Partial<RenderOptions> = {
      paperSize: "A4",
      currencySymbol: companyData?.currencySymbol || "PKR",
      taxName: resolveTaxLabel({
        country: companyData?.country,
        currency: companyData?.currency,
        taxName: companyData?.taxName,
        taxComplianceMode: settings.taxComplianceMode,
      }),
      primaryColor: customTemplate?.primaryColor || theme.primaryColor || undefined,
      accentColor: customTemplate?.accentColor || theme.accentColor || undefined,
      showLogo: customTemplate?.showLogo ?? true,
      showHeader: customTemplate?.showHeader ?? true,
      showFooter: customTemplate?.showFooter ?? true,
      showBarcode: customTemplate?.showBarcode ?? false,
      showQR: customTemplate?.showQR ?? false,
      showSignature: customTemplate?.showSignature ?? false,
      headerText: customTemplate?.headerText || null,
      footerText: customTemplate?.footerText || null,
      fontSize: customTemplate?.fontSize || "normal",
      margin: customTemplate?.margin || "normal",
      documentLanguage: "en",
    };

    const html = customTemplate?.advancedDesign
      ? renderAdvancedDocument(data, opts, customTemplate.advancedDesign as any)
      : renderDocument(templateDef?.id || templateId, data, opts);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate quotation" }, { status: 500 });
  }
}
