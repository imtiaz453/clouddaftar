// Pakistan FBR QR payload encoding
// FBR invoice QR contains supplier info, buyer info, invoice details, and IRN

export interface FbrQrData {
  supplierName: string;
  supplierNtn: string;
  buyerName: string;
  buyerNtn?: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTime: string;
  totalAmount: string;
  salesTaxAmount: string;
  fbrInvoiceNumber: string;
}

export interface FbrVerificationResult {
  verified: boolean;
  fbrInvoiceNumber: string;
  qrPayload: string;
}

export function buildFbrQrPayload(data: FbrQrData): string {
  const fields = [
    `SPN=${data.supplierName}`,
    `SPN=${data.supplierNtn}`,
    `BN=${data.buyerName}`,
    data.buyerNtn ? `BN=${data.buyerNtn}` : null,
    `INV=${data.invoiceNumber}`,
    `DT=${data.invoiceDate}`,
    `TM=${data.invoiceTime}`,
    `AMT=${data.totalAmount}`,
    `TX=${data.salesTaxAmount}`,
    `IRN=${data.fbrInvoiceNumber}`,
  ].filter(Boolean) as string[];

  return fields.join("|");
}

export function formatFbrDate(date: Date): string {
  const d = date.toISOString().slice(0, 10);
  return d;
}

export function formatFbrTime(date: Date): string {
  return date.toISOString().slice(11, 19);
}
