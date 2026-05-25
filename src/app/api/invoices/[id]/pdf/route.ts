import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { buildRenderDataFromSale, renderDocument } from "@/components/templates/renderer";
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

function mapSizeToTemplate(size: string): string {
  switch (size) {
    case "THERMAL_80":
      return "thermal-compact-80";
    case "THERMAL_58":
      return "thermal-compact-58";
    default:
      return "invoice-modern-minimal";
  }
}

function documentFilenamePrefix(status: string) {
  if (status === "PROFORMA") return "proforma-invoice";
  if (status === "DRAFT" || status === "CONFIRMED") return "sales-order";
  return "invoice";
}

function isTaxInvoiceStatus(status: string) {
  return ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(status);
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
        company: { include: { theme: true, settings: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const companyData = sale.company as any;
    const settings = companyData?.settings || {};
    const theme = companyData?.theme || {};

    const data = buildRenderDataFromSale(sale as any, "invoice");
    const documentTitle = data.document.title || "Invoice";

    const requestedSize = req.nextUrl.searchParams.get("size") || "A4";
    const wantsThermal = requestedSize.startsWith("THERMAL");
    let templateId =
      req.nextUrl.searchParams.get("template") ||
      (wantsThermal
        ? settings.defaultThermalInvoiceTemplate || mapSizeToTemplate(requestedSize)
        : settings.defaultInvoiceTemplate || mapSizeToTemplate(requestedSize));
    let templateDef = getTemplateDef(templateId);
    let customTemplate = null;

    if (!templateDef) {
      customTemplate = await prisma.invoiceTemplate.findFirst({
        where: { id: templateId, companyId },
      });
    }

    if ((templateDef && templateDef.type !== "invoice") || (!templateDef && !customTemplate)) {
      templateId = mapSizeToTemplate(requestedSize);
      templateDef = getTemplateDef(templateId);
      customTemplate = null;
    }

    const paperSize = (customTemplate?.paperSize || templateDef?.paperSize || "A4") as PaperSize;
    const taxComplianceMode =
      sale.taxComplianceMode && sale.taxComplianceMode !== "NONE"
        ? sale.taxComplianceMode
        : settings.taxComplianceMode || "NONE";
    const hasTaxCompliance = isTaxInvoiceStatus(sale.status) && taxComplianceMode !== "NONE";

    const options: RenderOptions = getDefaultOptions({
      paperSize,
      currencySymbol: companyData?.currencySymbol || "PKR",
      taxName: resolveTaxLabel({
        country: companyData?.country,
        currency: companyData?.currency,
        taxName: companyData?.taxName,
        taxComplianceMode,
      }),
      primaryColor:
        customTemplate?.primaryColor || theme?.primaryColor || templateDef?.previewColor,
      accentColor: customTemplate?.accentColor || theme?.accentColor || templateDef?.previewAccent,
      showLogo: customTemplate?.showLogo ?? true,
      showHeader: customTemplate?.showHeader ?? true,
      showFooter: customTemplate?.showFooter ?? true,
      showBarcode: customTemplate?.showBarcode ?? false,
      showQR: hasTaxCompliance ? true : (customTemplate?.showQR ?? false),
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
    });

    const baseUrl = `${req.nextUrl.protocol}//${req.headers.get("host") || "localhost:3000"}`;

    const advancedDesign = advancedDesignForDocument(customTemplate, documentTitle);
    const html = customTemplate?.advancedDesign
      ? renderAdvancedDocument(data, options, advancedDesign)
      : templateDef
        ? renderDocument(templateDef.id, data, options)
        : renderDocument(mapSizeToTemplate(requestedSize), data, options);

    const pdfBuffer = await generatePdfFromHtml(html, paperSize, baseUrl);

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFilename(documentFilenamePrefix(sale.status), sale.invoiceNumber)}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Invoice PDF error:", err?.message, err?.stack);
    return NextResponse.json({ error: err?.message || "Failed to generate PDF" }, { status: 500 });
  }
}
