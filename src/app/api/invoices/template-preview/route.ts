import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { renderDocument } from "@/components/templates/renderer";
import { renderAdvancedDocument } from "@/components/templates/advanced-template";
import { getDefaultOptions, getTemplateDef, type RenderData } from "@/lib/template-registry";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = (session.user as any).companyId;
    const templateId = req.nextUrl.searchParams.get("templateId") || "invoice-modern-minimal";
    let templateDef = getTemplateDef(templateId);
    let customTemplate: any = null;
    if (!templateDef) {
      customTemplate = await prisma.invoiceTemplate.findFirst({
        where: { id: templateId, companyId },
      });
      if (!customTemplate) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      const fallbackId =
        customTemplate.paperSize === "THERMAL_80"
          ? "thermal-compact-80"
          : customTemplate.paperSize === "THERMAL_58"
            ? "thermal-compact-58"
            : "invoice-modern-minimal";
      templateDef = getTemplateDef(fallbackId);
    }
    if (!templateDef) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { settings: true, theme: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const sampleData: RenderData = {
      company: {
        name: company.name || "Your Business Name",
        logo: company.logo || null,
        address: company.address || "123 Business Street",
        city: company.city || "City Name",
        state: company.state || "State",
        zipCode: company.zipCode || "12345",
        phone: company.phone || "+92 300 1234567",
        email: company.email || "info@example.com",
        taxId: company.taxId || "NTN-1234567-8",
        website: company.website || null,
        country: company.country === "SA" ? "Saudi Arabia" : company.country || "Pakistan",
      },
      customer: {
        name: "Sample Customer",
        phone: "+92 311 7654321",
        email: "customer@example.com",
        address: "456 Customer Avenue, City",
      },
      document: {
        number: templateDef.type === "invoice" ? "INV-00001" : "QUO-00001",
        date: new Date(),
        dueDate: new Date(Date.now() + 15 * 86400000),
        status: templateDef.type === "invoice" ? "COMPLETED" : "SENT",
        notes: "Sample notes for preview purposes.",
        terms:
          templateDef.type === "quotation"
            ? "Payment due within 15 days. Prices valid for 30 days."
            : null,
        createdByName: "Admin User",
        paymentMethod: "BANK_TRANSFER",
        subtotal: 50000,
        discount: 2500,
        tax: 4750,
        total: 52250,
        paid: 30000,
        due: 22250,
      },
      items: [
        {
          name: "Product Alpha",
          sku: "SKU-001",
          quantity: 10,
          price: 2000,
          discount: 0,
          tax: 10,
          subtotal: 20000,
          unit: "pcs",
        },
        {
          name: "Product Beta",
          sku: "SKU-002",
          quantity: 5,
          price: 3500,
          discount: 500,
          tax: 10,
          subtotal: 17500,
          unit: "pcs",
        },
        {
          name: "Service Gamma",
          sku: null,
          quantity: 1,
          price: 15000,
          discount: 2000,
          tax: 5,
          subtotal: 15000,
          unit: null,
        },
      ],
      type: templateDef.type,
    };

    const opts = getDefaultOptions({
      currencySymbol: company.currencySymbol || "PKR",
      taxName:
        company.country === "SA" || company.currency === "SAR" ? "VAT" : company.taxName || "Tax",
      paperSize: (customTemplate?.paperSize || templateDef.paperSize) as any,
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
      primaryColor:
        customTemplate?.primaryColor || company.theme?.primaryColor || templateDef.previewColor,
      accentColor:
        customTemplate?.accentColor || company.theme?.accentColor || templateDef.previewAccent,
      documentLanguage: "en",
    });

    const html = customTemplate?.advancedDesign
      ? renderAdvancedDocument(sampleData, opts, customTemplate.advancedDesign as any)
      : renderDocument(templateDef.id, sampleData, opts);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
