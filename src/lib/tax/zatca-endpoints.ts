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

export const ZATCA_DEFAULT_SIMULATION_ENDPOINT = ZATCA_SIMULATION_ENDPOINTS.reportingSingle;

export const ZATCA_PRODUCTION_ENDPOINTS = {
  compliance: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance",
  complianceInvoices: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance/invoices",
  productionCsids: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/production/csids",
  reportingSingle: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/reporting/single",
  clearanceSingle: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/clearance/single",
} as const;
