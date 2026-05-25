import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { renderDocument, buildRenderDataFromSale } from "@/components/templates/renderer";
import { renderAdvancedDocument } from "@/components/templates/advanced-template";
import { getTemplateDef, type RenderOptions, getDefaultOptions } from "@/lib/template-registry";
import { resolveTaxLabel } from "@/lib/tax-label";

function mapSizeToTemplate(size: string): string {
  switch (size) {
    case "A4":
      return "invoice-modern-minimal";
    case "THERMAL_80":
      return "thermal-compact-80";
    case "THERMAL_58":
      return "thermal-compact-58";
    default:
      return "invoice-modern-minimal";
  }
}

function advancedDesignForDocument(customTemplate: any, documentTitle: string) {
  const design = customTemplate?.advancedDesign;
  if (!design) return null;
  return {
    ...design,
    documentTitle: documentTitle.toUpperCase(),
    labels: {
      ...(design.labels || {}),
      invoice: documentTitle,
    },
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const companyId = (session.user as any).companyId;

    const sale = await prisma.sale.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } },
        createdBy: { select: { name: true } },
        branch: { select: { name: true, code: true } },
        warehouse: { select: { name: true, code: true } },
        company: {
          include: { theme: true, settings: true },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const companyData = sale.company as any;
    const settings = companyData?.settings || {};
    const theme = companyData?.theme || {};

    const requestedSize = req.nextUrl.searchParams.get("size") || "A4";
    const autoPrint = req.nextUrl.searchParams.get("autoPrint") !== "false";
    const wantsThermal = requestedSize.startsWith("THERMAL");
    let templateId =
      req.nextUrl.searchParams.get("template") ||
      (wantsThermal
        ? settings.defaultThermalInvoiceTemplate || mapSizeToTemplate(requestedSize)
        : settings.defaultInvoiceTemplate || mapSizeToTemplate(requestedSize));
    let templateDef = getTemplateDef(templateId);
    let customTemplate: any = null;
    if (!templateDef) {
      customTemplate = await prisma.invoiceTemplate.findFirst({
        where: { id: templateId, companyId },
      });
    }
    if (!templateDef && !customTemplate) {
      templateId = mapSizeToTemplate(req.nextUrl.searchParams.get("size") || "A4");
      templateDef = getTemplateDef(templateId);
    }

    const paperSize =
      customTemplate?.paperSize ||
      templateDef?.paperSize ||
      req.nextUrl.searchParams.get("size") ||
      "A4";

    const data = buildRenderDataFromSale(sale as any, "invoice");
    const documentTitle = data.document.title || "Invoice";

    const taxComplianceMode =
      sale.taxComplianceMode && sale.taxComplianceMode !== "NONE"
        ? sale.taxComplianceMode
        : settings.taxComplianceMode || "NONE";
    const hasTaxCompliance = taxComplianceMode !== "NONE";

    const opts: Partial<RenderOptions> = {
      paperSize: paperSize as any,
      currencySymbol: companyData?.currencySymbol || "PKR",
      taxName: resolveTaxLabel({
        country: companyData?.country,
        currency: companyData?.currency,
        taxName: companyData?.taxName,
        taxComplianceMode,
      }),
      primaryColor: customTemplate?.primaryColor || theme.primaryColor || undefined,
      accentColor: customTemplate?.accentColor || theme.accentColor || undefined,
      showLogo: customTemplate?.showLogo ?? true,
      showHeader: customTemplate?.showHeader ?? true,
      showFooter: customTemplate?.showFooter ?? true,
      showBarcode: customTemplate?.showBarcode ?? false,
      showQR: hasTaxCompliance ? true : (customTemplate?.showQR ?? undefined),
      showSignature: customTemplate?.showSignature ?? false,
      headerText: customTemplate?.headerText || null,
      footerText: customTemplate?.footerText || null,
      fontSize: customTemplate?.fontSize || "normal",
      margin: customTemplate?.margin || "normal",
      taxComplianceMode,
      taxComplianceStatus: sale.taxComplianceStatus || null,
      fbrInvoiceNumber: sale.fbrInvoiceNumber || null,
      buyerTaxNumber: sale.buyerTaxNumber || null,
      sellerTaxNumber: sale.sellerTaxNumber || null,
      documentLanguage: "en",
      advancedDesign: { autoPrint },
    };

    const advancedDesign = advancedDesignForDocument(customTemplate, documentTitle);
    const html = customTemplate?.advancedDesign
      ? renderAdvancedDocument(data, opts, advancedDesign)
      : renderDocument(templateDef?.id || templateId, data, opts);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}
