export type ZatcaMode = "LOCAL" | "SIMULATION" | "PRODUCTION";
export type ZatcaInvoiceKind = "standard" | "simplified";
export type ZatcaInvoiceStatus =
  | "LOCAL_STORED"
  | "SIGNED"
  | "REPORTED"
  | "CLEARED"
  | "SKIPPED"
  | "FAILED";

export type ZatcaSellerConfig = {
  sellerName: string;
  sellerVatNumber: string;
  branchName?: string | null;
  address?: string | null;
  crNumber?: string | null;
};

export type ZatcaLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  taxAmount: number;
};

export type ZatcaInvoiceInput = {
  saleId: string;
  invoiceNumber: string;
  issuedAt: Date;
  seller: ZatcaSellerConfig;
  buyer?: {
    name?: string | null;
    vatNumber?: string | null;
    address?: string | null;
  };
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
  lines: ZatcaLine[];
  previousInvoiceHash?: string | null;
  invoiceCounter?: number | null;
};

export type ZatcaClientCredentials = {
  csid?: string | null;
  secret?: string | null;
};

export type ZatcaClientDocument = {
  kind: ZatcaInvoiceKind;
  uuid: string;
  invoiceHash: string;
  xmlBase64: string;
};

export type ZatcaClientResult = {
  status: ZatcaInvoiceStatus;
  endpoint?: string;
  response?: unknown;
  error?: string;
};

export const ZATCA_SIMULATION_ENDPOINTS = {
  compliance: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance",
  complianceInvoices:
    "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance/invoices",
  productionCsids: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/production/csids",
  reportingSingle:
    "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/invoices/reporting/single",
  clearanceSingle:
    "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/invoices/clearance/single",
} as const;

export const ZATCA_PRODUCTION_ENDPOINTS = {
  compliance: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance",
  complianceInvoices: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance/invoices",
  productionCsids: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/production/csids",
  reportingSingle: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/reporting/single",
  clearanceSingle: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/clearance/single",
} as const;
