export type LocalityCode = "PK" | "SA";

export interface LocalityPreset {
  country: LocalityCode;
  label: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  taxName: string;
  taxRate: number;
  defaultTaxRate: number;
  taxComplianceMode: "NONE" | "FBR" | "ZATCA";
}

export const LOCALITY_PRESETS: Record<LocalityCode, LocalityPreset> = {
  PK: {
    country: "PK",
    label: "Pakistan",
    currency: "PKR",
    currencySymbol: "Rs",
    timezone: "Asia/Karachi",
    taxName: "GST",
    taxRate: 0,
    defaultTaxRate: 0,
    taxComplianceMode: "NONE",
  },
  SA: {
    country: "SA",
    label: "Saudi Arabia",
    currency: "SAR",
    currencySymbol: "SAR",
    timezone: "Asia/Riyadh",
    taxName: "VAT",
    taxRate: 15,
    defaultTaxRate: 15,
    taxComplianceMode: "ZATCA",
  },
};

export function getLocalityPreset(country: unknown): LocalityPreset {
  return country === "SA" ? LOCALITY_PRESETS.SA : LOCALITY_PRESETS.PK;
}
