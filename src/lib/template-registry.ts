export type TemplateType = "invoice" | "quotation" | "purchase_order";
export type PaperSize = "A4" | "THERMAL_80" | "THERMAL_58";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  paperSize: PaperSize;
  style: string;
  previewColor: string;
  previewAccent: string;
}

export interface RenderOptions {
  primaryColor: string;
  accentColor: string;
  showLogo: boolean;
  showHeader: boolean;
  showFooter: boolean;
  showBarcode: boolean;
  showQR: boolean;
  showSignature: boolean;
  headerText?: string | null;
  footerText?: string | null;
  fontSize: string;
  margin: string;
  paperSize: PaperSize;
  currencySymbol: string;
  taxName: string;
  taxComplianceMode?: string;
  taxComplianceStatus?: string | null;
  fbrInvoiceNumber?: string | null;
  buyerTaxNumber?: string | null;
  sellerTaxNumber?: string | null;
  documentLanguage?: "en" | "ur" | "ar" | "dual" | string | null;
  advancedDesign?: Record<string, any> | null;
}

export interface RenderData {
  company: {
    name: string;
    logo?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    taxId?: string | null;
    website?: string | null;
  };
  customer?: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  document: {
    number: string;
    title?: string | null;
    date: Date;
    dueDate?: Date | null;
    status: string;
    notes?: string | null;
    terms?: string | null;
    createdByName?: string | null;
    branchName?: string | null;
    warehouseName?: string | null;
    placeName?: string | null;
    paymentMethod?: string | null;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid: number;
    due: number;
    taxComplianceMode?: string;
    taxComplianceStatus?: string | null;
  };
  taxInfo?: {
    fbrInvoiceNumber?: string | null;
    sellerTaxNumber?: string | null;
    buyerTaxNumber?: string | null;
    qrPayload?: string | null;
  } | null;
  items: {
    name: string;
    sku?: string | null;
    quantity: number;
    price: number;
    discount: number;
    tax: number;
    subtotal: number;
    unit?: string | null;
  }[];
  type: TemplateType;
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: "invoice-modern-minimal",
    name: "Modern Minimal",
    description: "Clean, minimalist design with subtle accents and plenty of whitespace",
    type: "invoice",
    paperSize: "A4",
    style: "modern-minimal",
    previewColor: "#0f172a",
    previewAccent: "#3b82f6",
  },
  {
    id: "invoice-corporate",
    name: "Corporate",
    description: "Professional business design with bold headers and structured layout",
    type: "invoice",
    paperSize: "A4",
    style: "corporate",
    previewColor: "#1e293b",
    previewAccent: "#0ea5e9",
  },
  {
    id: "invoice-clean-accounting",
    name: "Clean Accounting",
    description: "Traditional accounting style with clear section separators",
    type: "invoice",
    paperSize: "A4",
    style: "clean-accounting",
    previewColor: "#334155",
    previewAccent: "#10b981",
  },
  {
    id: "invoice-bold-commercial",
    name: "Bold Commercial",
    description: "High-impact design with strong colors and prominent branding",
    type: "invoice",
    paperSize: "A4",
    style: "bold-commercial",
    previewColor: "#111827",
    previewAccent: "#f59e0b",
  },
  {
    id: "invoice-premium-business",
    name: "Premium Business",
    description: "Elegant premium design with refined typography and subtle gradients",
    type: "invoice",
    paperSize: "A4",
    style: "premium-business",
    previewColor: "#1a1a2e",
    previewAccent: "#8b5cf6",
  },
  {
    id: "thermal-compact-58",
    name: "Compact 58mm",
    description: "Space-efficient thermal print for 58mm POS printers",
    type: "invoice",
    paperSize: "THERMAL_58",
    style: "compact",
    previewColor: "#000000",
    previewAccent: "#000000",
  },
  {
    id: "thermal-compact-80",
    name: "Compact 80mm",
    description: "Space-efficient thermal print for 80mm POS printers",
    type: "invoice",
    paperSize: "THERMAL_80",
    style: "compact",
    previewColor: "#000000",
    previewAccent: "#000000",
  },
  {
    id: "thermal-pos-58",
    name: "POS Style 58mm",
    description: "Retail POS style with large item rows for 58mm printers",
    type: "invoice",
    paperSize: "THERMAL_58",
    style: "pos",
    previewColor: "#000000",
    previewAccent: "#000000",
  },
  {
    id: "thermal-pos-80",
    name: "POS Style 80mm",
    description: "Retail POS style with large item rows for 80mm printers",
    type: "invoice",
    paperSize: "THERMAL_80",
    style: "pos",
    previewColor: "#000000",
    previewAccent: "#000000",
  },
  {
    id: "thermal-minimal-58",
    name: "Minimal 58mm",
    description: "Ultra-minimal thermal print for high-speed 58mm printers",
    type: "invoice",
    paperSize: "THERMAL_58",
    style: "minimal",
    previewColor: "#000000",
    previewAccent: "#000000",
  },
  {
    id: "quotation-modern-minimal",
    name: "Modern Minimal",
    description: "Clean minimalist quotation design",
    type: "quotation",
    paperSize: "A4",
    style: "modern-minimal",
    previewColor: "#0f172a",
    previewAccent: "#3b82f6",
  },
  {
    id: "quotation-corporate",
    name: "Corporate",
    description: "Professional business quotation design",
    type: "quotation",
    paperSize: "A4",
    style: "corporate",
    previewColor: "#1e293b",
    previewAccent: "#0ea5e9",
  },
  {
    id: "quotation-clean-accounting",
    name: "Clean Accounting",
    description: "Traditional accounting style quotation",
    type: "quotation",
    paperSize: "A4",
    style: "clean-accounting",
    previewColor: "#334155",
    previewAccent: "#10b981",
  },
  {
    id: "quotation-bold-commercial",
    name: "Bold Commercial",
    description: "High-impact commercial quotation design",
    type: "quotation",
    paperSize: "A4",
    style: "bold-commercial",
    previewColor: "#111827",
    previewAccent: "#f59e0b",
  },
  {
    id: "quotation-premium-business",
    name: "Premium Business",
    description: "Elegant premium quotation design",
    type: "quotation",
    paperSize: "A4",
    style: "premium-business",
    previewColor: "#1a1a2e",
    previewAccent: "#8b5cf6",
  },
  {
    id: "purchase-order-modern-minimal",
    name: "Modern Minimal",
    description: "Clean purchase order design with spacious supplier and order details",
    type: "purchase_order",
    paperSize: "A4",
    style: "modern-minimal",
    previewColor: "#0f172a",
    previewAccent: "#3b82f6",
  },
  {
    id: "purchase-order-corporate",
    name: "Corporate",
    description: "Professional purchase order design with strong business branding",
    type: "purchase_order",
    paperSize: "A4",
    style: "corporate",
    previewColor: "#1e293b",
    previewAccent: "#0ea5e9",
  },
  {
    id: "purchase-order-clean-accounting",
    name: "Clean Accounting",
    description: "Traditional purchase order layout with restrained accounting styling",
    type: "purchase_order",
    paperSize: "A4",
    style: "clean-accounting",
    previewColor: "#334155",
    previewAccent: "#10b981",
  },
  {
    id: "purchase-order-bold-commercial",
    name: "Bold Commercial",
    description: "High-contrast purchase order design with prominent totals",
    type: "purchase_order",
    paperSize: "A4",
    style: "bold-commercial",
    previewColor: "#111827",
    previewAccent: "#f59e0b",
  },
  {
    id: "purchase-order-premium-business",
    name: "Premium Business",
    description: "Elegant purchase order theme with polished typography and soft color",
    type: "purchase_order",
    paperSize: "A4",
    style: "premium-business",
    previewColor: "#1a1a2e",
    previewAccent: "#8b5cf6",
  },
];

export function getTemplateDef(id: string): TemplateDefinition | undefined {
  return TEMPLATE_DEFINITIONS.find((t) => t.id === id);
}

export function getTemplatesByType(
  type: TemplateType,
  paperSize?: PaperSize,
): TemplateDefinition[] {
  return TEMPLATE_DEFINITIONS.filter((t) => {
    if (t.type !== type) return false;
    if (paperSize && t.paperSize !== paperSize) return false;
    return true;
  });
}

export function getDefaultOptions(overrides?: Partial<RenderOptions>): RenderOptions {
  return {
    primaryColor: "#0f172a",
    accentColor: "#3b82f6",
    showLogo: true,
    showHeader: true,
    showFooter: true,
    showBarcode: false,
    showQR: false,
    showSignature: false,
    headerText: null,
    footerText: null,
    fontSize: "normal",
    margin: "normal",
    paperSize: "A4",
    currencySymbol: "PKR",
    taxName: "Tax",
    ...overrides,
  };
}

export function formatCurrency(amount: number, symbol = "PKR"): string {
  return `${symbol} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateShort(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}
