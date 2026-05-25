import { signZatcaPhase2Invoice } from "@/lib/tax/zatca-phase2";
import type { ZatcaInvoiceInput, ZatcaInvoiceKind } from "./config";

export function signZatcaInvoice(args: {
  input: ZatcaInvoiceInput;
  kind: ZatcaInvoiceKind;
  privateKeyPem: string;
  certificatePem?: string | null;
  cryptographicStamp?: string | null;
}) {
  // TODO: Confirm production XAdES signing/certificate chain against a real ZATCA-issued CSID.
  return signZatcaPhase2Invoice(
    {
      saleId: args.input.saleId,
      invoiceNumber: args.input.invoiceNumber,
      issuedAt: args.input.issuedAt,
      seller: {
        name: args.input.seller.sellerName,
        vatNumber: args.input.seller.sellerVatNumber,
        crNumber: args.input.seller.crNumber || undefined,
        address: args.input.seller.address || undefined,
      },
      buyer: args.input.buyer,
      totals: args.input.totals,
      lines: args.input.lines,
      privateKeyPem: args.privateKeyPem,
      certificatePem: args.certificatePem || undefined,
      cryptographicStamp: args.cryptographicStamp || undefined,
      previousInvoiceHash: args.input.previousInvoiceHash || undefined,
      invoiceCounter: args.input.invoiceCounter || undefined,
    },
    args.kind,
  );
}
