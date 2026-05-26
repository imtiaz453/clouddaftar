import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { buildRenderDataFromQuotation, renderDocument } from "@/components/templates/renderer";
import { renderAdvancedDocument } from "@/components/templates/advanced-template";
import {
  getDefaultOptions,
  getTemplateDef,
  type PaperSize,
  type RenderOptions,
} from "@/lib/template-registry";
import { generatePdfFromHtml } from "@/lib/html-pdf";
import { pdfFilename } from "@/lib/pdf-generator";
import { resolveTaxLabel } from "@/lib/tax-label";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
        company: { include: { theme: true, settings: true } },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const companyData = quotation.company as any;
    const settings = companyData?.settings || {};
    const theme = companyData?.theme || {};

    const data = buildRenderDataFromQuotation(quotation as any);

    let templateId =
      req.nextUrl.searchParams.get("template") ||
      settings.defaultQuotationTemplate ||
      "quotation-modern-minimal";
    let templateDef = getTemplateDef(templateId);
    let customTemplate = null;

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

    const paperSize = (customTemplate?.paperSize || templateDef?.paperSize || "A4") as PaperSize;
    const options: RenderOptions = getDefaultOptions({
      paperSize,
      currencySymbol: companyData?.currencySymbol || "PKR",
      taxName: resolveTaxLabel({
        country: companyData?.country,
        currency: companyData?.currency,
        taxName: companyData?.taxName,
        taxComplianceMode: settings.taxComplianceMode,
      }),
      primaryColor:
        customTemplate?.primaryColor || theme?.primaryColor || templateDef?.previewColor,
      accentColor: customTemplate?.accentColor || theme?.accentColor || templateDef?.previewAccent,
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
    });

    const baseUrl = `${req.nextUrl.protocol}//${req.headers.get("host") || "localhost:3000"}`;

    const html = customTemplate?.advancedDesign
      ? renderAdvancedDocument(data, options, customTemplate.advancedDesign as Record<string, any>)
      : templateDef
        ? renderDocument(templateDef.id, data, options)
        : renderDocument("quotation-modern-minimal", data, options);

    const pdfBuffer = await generatePdfFromHtml(html, paperSize, baseUrl);

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFilename("quotation", quotation.quoteNumber)}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Quotation PDF error:", err?.message, err?.stack);
    return NextResponse.json({ error: err?.message || "Failed to generate PDF" }, { status: 500 });
  }
}
