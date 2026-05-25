export function resolveTaxLabel(input?: {
  country?: string | null;
  currency?: string | null;
  taxName?: string | null;
  taxComplianceMode?: string | null;
}) {
  const country = input?.country?.toUpperCase();
  const currency = input?.currency?.toUpperCase();
  const compliance = input?.taxComplianceMode?.toUpperCase();
  if (country === "SA" || country === "SAUDI ARABIA" || currency === "SAR" || compliance === "ZATCA") {
    return "VAT";
  }
  return input?.taxName?.trim() || "Tax";
}

export function getRuntimeTaxLabel() {
  if (typeof document === "undefined") return "Tax";
  return document.documentElement.dataset.taxLabel || "Tax";
}
