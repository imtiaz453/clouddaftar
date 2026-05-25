import type { RenderData, RenderOptions } from "@/lib/template-registry";
import { getDefaultOptions } from "@/lib/template-registry";
import {
  buildFbrQrPayload,
  buildZatcaPhase1Payload,
  formatFbrDate,
  formatFbrTime,
  formatZatcaTimestamp,
  formatZatcaTotal,
} from "@/lib/tax";

import {
  renderModernMinimal,
  renderCorporate,
  renderCleanAccounting,
  renderBoldCommercial,
  renderPremiumBusiness,
} from "./a4-invoice";

import {
  renderThermalCompact58,
  renderThermalCompact80,
  renderThermalPos58,
  renderThermalPos80,
  renderThermalMinimal58,
} from "./thermal-invoice";

import {
  renderQuotationModernMinimal,
  renderQuotationCorporate,
  renderQuotationCleanAccounting,
  renderQuotationBoldCommercial,
  renderQuotationPremiumBusiness,
} from "./a4-quotation";

export type TemplateRenderer = (data: RenderData, opts: RenderOptions) => string;

const registry: Record<string, TemplateRenderer> = {
  "invoice-modern-minimal": renderModernMinimal,
  "invoice-corporate": renderCorporate,
  "invoice-clean-accounting": renderCleanAccounting,
  "invoice-bold-commercial": renderBoldCommercial,
  "invoice-premium-business": renderPremiumBusiness,
  "thermal-compact-58": renderThermalCompact58,
  "thermal-compact-80": renderThermalCompact80,
  "thermal-pos-58": renderThermalPos58,
  "thermal-pos-80": renderThermalPos80,
  "thermal-minimal-58": renderThermalMinimal58,
  "quotation-modern-minimal": renderQuotationModernMinimal,
  "quotation-corporate": renderQuotationCorporate,
  "quotation-clean-accounting": renderQuotationCleanAccounting,
  "quotation-bold-commercial": renderQuotationBoldCommercial,
  "quotation-premium-business": renderQuotationPremiumBusiness,
};

export function getRenderer(templateId: string): TemplateRenderer | undefined {
  return registry[templateId];
}

export function renderDocument(
  templateId: string,
  data: RenderData,
  opts?: Partial<RenderOptions>,
): string {
  const renderer = getRenderer(templateId);
  if (!renderer) throw new Error(`Template not found: ${templateId}`);
  const mergedOpts: RenderOptions = { ...getDefaultOptions(opts), ...opts } as RenderOptions;
  return renderer(data, mergedOpts);
}

function isPostedSaleStatus(status: string | null | undefined): boolean {
  return ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(status || "COMPLETED");
}

function buildFallbackQrPayload(sale: any): string | null {
  if (!isPostedSaleStatus(sale.status)) return null;

  const mode =
    sale.taxComplianceMode && sale.taxComplianceMode !== "NONE"
      ? sale.taxComplianceMode
      : sale.company?.settings?.taxComplianceMode || "NONE";
  if (!mode || mode === "NONE") return null;

  const company = sale.company || {};
  const settings = company.settings || {};
  const zatcaSettings = settings.zatcaSettings || {};
  const issuedAt = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const sellerName =
    mode === "ZATCA" ? zatcaSettings.sellerName || company.name || "" : company.name || "";
  const sellerTaxNumber =
    sale.sellerTaxNumber ||
    (mode === "ZATCA" ? zatcaSettings.vatRegNo || company.taxId || "" : company.taxId || "");

  if (mode === "FBR") {
    return buildFbrQrPayload({
      supplierName: sellerName,
      supplierNtn: sellerTaxNumber,
      buyerName: sale.customer?.name || "Walk-in Customer",
      buyerNtn: sale.buyerTaxNumber || "",
      invoiceNumber: sale.invoiceNumber,
      invoiceDate: formatFbrDate(issuedAt),
      invoiceTime: formatFbrTime(issuedAt),
      totalAmount: Number(sale.total || 0).toFixed(2),
      salesTaxAmount: Number(sale.tax || 0).toFixed(2),
      fbrInvoiceNumber: sale.fbrInvoiceNumber || "",
    });
  }

  if (mode === "ZATCA") {
    return buildZatcaPhase1Payload(
      sellerName,
      sellerTaxNumber,
      formatZatcaTimestamp(issuedAt),
      formatZatcaTotal(Number(sale.total || 0)),
      formatZatcaTotal(Number(sale.tax || 0)),
    );
  }

  return null;
}

function countryLabel(country: string | null | undefined) {
  const labels: Record<string, string> = {
    PK: "Pakistan",
    AE: "UAE",
    SA: "Saudi Arabia",
    US: "United States",
    GB: "United Kingdom",
  };
  return country ? labels[country] || country : null;
}

function saleDocumentTitle(status: string | null | undefined, type: "invoice" | "quotation") {
  if (type === "quotation") return "Quotation";
  if (status === "PROFORMA") return "Proforma Invoice";
  if (status === "DRAFT") return "Draft Sales Order";
  if (status === "CONFIRMED") return "Sales Order";
  return "Invoice";
}

export function buildRenderDataFromSale(
  sale: any,
  type: "invoice" | "quotation" = "invoice",
): RenderData {
  const company = sale.company || {};
  const settings = company.settings || {};
  const zatcaSettings = settings.zatcaSettings || {};
  const customer = sale.customer;
  const taxComplianceMode =
    sale.taxComplianceMode && sale.taxComplianceMode !== "NONE"
      ? sale.taxComplianceMode
      : settings.taxComplianceMode || "NONE";
  const isZatca = taxComplianceMode === "ZATCA";
  const displayTaxId =
    sale.sellerTaxNumber || (isZatca ? zatcaSettings.vatRegNo || company.taxId : company.taxId);
  const displayAddress = company.address || (isZatca ? zatcaSettings.address : null);
  const branchName = sale.branch?.name
    ? sale.branch.code
      ? `${sale.branch.name} (${sale.branch.code})`
      : sale.branch.name
    : null;
  const warehouseName = sale.warehouse?.name
    ? sale.warehouse.code
      ? `${sale.warehouse.name} (${sale.warehouse.code})`
      : sale.warehouse.name
    : null;
  const placeName = [branchName, warehouseName].filter(Boolean).join(" / ") || null;
  const items = (sale.items || []).map((item: any) => ({
    name: item.product?.name || "Item",
    sku: item.product?.sku || null,
    quantity: item.quantity,
    price: Number(item.price),
    discount: Number(item.discount),
    tax: Number(item.tax),
    subtotal: Number(item.subtotal),
    unit: item.product?.unit || null,
  }));

  return {
    company: {
      name: company.name || "Business Name",
      logo: company.logo || null,
      address: displayAddress || null,
      city: company.city || null,
      state: company.state || null,
      zipCode: company.zipCode || null,
      country: countryLabel(company.country),
      phone: company.phone || null,
      email: company.email || null,
      taxId: displayTaxId || null,
      website: company.website || null,
    },
    customer: customer
      ? {
          name: customer.name || "Customer",
          phone: customer.phone || null,
          email: customer.email || null,
          address: customer.address || null,
        }
      : null,
    document: {
      number: type === "invoice" ? sale.invoiceNumber : sale.quoteNumber,
      title: saleDocumentTitle(sale.status, type),
      date: sale.createdAt,
      dueDate: sale.dueDate || null,
      status: sale.status,
      notes: sale.notes || null,
      terms: sale.terms || null,
      createdByName: sale.createdBy?.name || null,
      branchName,
      warehouseName,
      placeName,
      paymentMethod: sale.paymentMethod || null,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      total: Number(sale.total),
      paid: Number(sale.paid),
      due: Number(sale.due),
      taxComplianceMode,
      taxComplianceStatus: sale.taxComplianceStatus || null,
    },
    taxInfo: {
      fbrInvoiceNumber: sale.fbrInvoiceNumber || null,
      sellerTaxNumber: sale.sellerTaxNumber || null,
      buyerTaxNumber: sale.buyerTaxNumber || null,
      qrPayload: isPostedSaleStatus(sale.status)
        ? sale.fbrQrPayload || sale.zatcaQrPayload || buildFallbackQrPayload(sale)
        : null,
    },
    items,
    type,
  };
}

export function buildRenderDataFromQuotation(quotation: any): RenderData {
  return buildRenderDataFromSale(
    { ...quotation, invoiceNumber: quotation.quoteNumber },
    "quotation",
  );
}
