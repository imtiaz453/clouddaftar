import type { Prisma } from "@prisma/client";
import type { CompanySettings } from "@prisma/client";

/** Document kinds with dedicated prefix + sequence per company. */
export type DocumentNumberKind =
  | "invoice"
  | "sales_order"
  | "proforma_invoice"
  | "quotation"
  | "purchase_order";

export type DocumentNumberSettings = Pick<
  CompanySettings,
  | "invoicePrefix"
  | "salesOrderPrefix"
  | "proformaInvoicePrefix"
  | "quotationPrefix"
  | "purchaseOrderPrefix"
  | "invoiceSuffix"
  | "invoiceNumberLength"
>;

type Tx = Prisma.TransactionClient;

const KIND_CONFIG: Record<
  DocumentNumberKind,
  {
    prefixKey: keyof DocumentNumberSettings;
    /** Prisma delegate + field holding the human-readable number. */
    scan?: {
      model: "sale" | "purchase" | "quotation";
      field: "invoiceNumber" | "referenceNumber" | "quoteNumber";
      /** Optional filter for sales (invoice vs sales order share invoiceNumber). */
      saleStatuses?: string[];
    };
  }
> = {
  invoice: {
    prefixKey: "invoicePrefix",
    scan: {
      model: "sale",
      field: "invoiceNumber",
      saleStatuses: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"],
    },
  },
  sales_order: {
    prefixKey: "salesOrderPrefix",
    scan: {
      model: "sale",
      field: "invoiceNumber",
      saleStatuses: ["DRAFT", "CONFIRMED"],
    },
  },
  proforma_invoice: {
    prefixKey: "proformaInvoicePrefix",
    scan: {
      model: "sale",
      field: "invoiceNumber",
      saleStatuses: ["PROFORMA"],
    },
  },
  quotation: {
    prefixKey: "quotationPrefix",
    scan: { model: "quotation", field: "quoteNumber" },
  },
  purchase_order: {
    prefixKey: "purchaseOrderPrefix",
    scan: { model: "purchase", field: "referenceNumber" },
  },
};

const DEFAULT_PREFIXES: Record<DocumentNumberKind, string> = {
  invoice: "INV",
  sales_order: "SORD",
  proforma_invoice: "PI",
  quotation: "QUOT",
  purchase_order: "PO",
};

/** Normalize prefix: trim and remove trailing separators because the formatter owns slash layout. */
export function normalizeDocumentPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed) return "";
  return trimmed.replace(/[-_./]+$/g, "");
}

export function getPrefixForKind(
  kind: DocumentNumberKind,
  settings?: DocumentNumberSettings | null,
): string {
  const key = KIND_CONFIG[kind].prefixKey;
  const raw = settings?.[key];
  const value = typeof raw === "string" && raw.trim() ? raw : DEFAULT_PREFIXES[kind];
  return normalizeDocumentPrefix(value);
}

export function formatDocumentNumber(
  prefix: string,
  sequence: number,
  length: number,
  suffix?: string | null,
  date: Date = new Date(),
): string {
  const normalized = normalizeDocumentPrefix(prefix);
  const padded = String(sequence).padStart(Math.max(3, Math.min(10, length)), "0");
  const suf = suffix?.trim() || "";
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${normalized}/${year}/${month}/${padded}${suf}`;
}

function parseSequenceFromNumber(
  documentNumber: string,
  prefix: string,
  suffix?: string | null,
  date: Date = new Date(),
): number | null {
  const normalized = normalizeDocumentPrefix(prefix);
  const suf = suffix?.trim();
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const currentPeriodPrefix = `${normalized}/${year}/${month}/`;

  if (documentNumber.startsWith(currentPeriodPrefix)) {
    let rest = documentNumber.slice(currentPeriodPrefix.length);
    if (suf && rest.endsWith(suf)) rest = rest.slice(0, -suf.length);
    const match = rest.match(/^(\d+)/);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  const legacyPrefix = `${normalized}-`;
  if (documentNumber.startsWith(legacyPrefix)) {
    let rest = documentNumber.slice(legacyPrefix.length);
    if (suf && rest.endsWith(suf)) rest = rest.slice(0, -suf.length);
    const match = rest.match(/^(\d+)/);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  return null;
}

function documentPeriodKey(kind: DocumentNumberKind, date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${kind}:${year}-${month}`;
}

async function scanMaxSequence(
  tx: Tx,
  companyId: string,
  kind: DocumentNumberKind,
  prefix: string,
  suffix: string | null | undefined,
  scan: NonNullable<(typeof KIND_CONFIG)[DocumentNumberKind]["scan"]>,
  date: Date,
): Promise<number> {
  let numbers: string[] = [];

  if (scan.model === "sale") {
    const rows = await tx.sale.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(scan.saleStatuses?.length ? { status: { in: scan.saleStatuses as never[] } } : {}),
      },
      select: { invoiceNumber: true },
    });
    numbers = rows.map((r) => r.invoiceNumber);
  } else if (scan.model === "purchase") {
    const rows = await tx.purchase.findMany({
      where: { companyId, deletedAt: null },
      select: { referenceNumber: true },
    });
    numbers = rows.map((r) => r.referenceNumber);
  } else {
    const rows = await tx.quotation.findMany({
      where: { companyId, deletedAt: null },
      select: { quoteNumber: true },
    });
    numbers = rows.map((r) => r.quoteNumber);
  }

  let max = 0;
  for (const num of numbers) {
    if (num.startsWith("DRAFT-")) continue;
    const parsed = parseSequenceFromNumber(num, prefix, suffix, date);
    if (parsed != null && parsed > max) max = parsed;
  }
  return max;
}

/**
 * Reserve the next sequential document number inside a transaction.
 */
export async function reserveNextDocumentNumber(
  tx: Tx,
  companyId: string,
  kind: DocumentNumberKind,
  settings?: DocumentNumberSettings | null,
  date: Date = new Date(),
): Promise<string> {
  const prefix = getPrefixForKind(kind, settings);
  const length = settings?.invoiceNumberLength ?? 5;
  const suffix = settings?.invoiceSuffix ?? null;
  const config = KIND_CONFIG[kind];
  const sequenceDelegate = (tx as any).documentNumberSequence;
  const periodKind = documentPeriodKey(kind, date);
  const scannedMax =
    config.scan != null
      ? await scanMaxSequence(tx, companyId, kind, prefix, suffix, config.scan, date)
      : 0;

  if (!sequenceDelegate?.findUnique || !sequenceDelegate?.create || !sequenceDelegate?.update) {
    return formatDocumentNumber(prefix, scannedMax + 1, length, suffix, date);
  }

  const existing = await sequenceDelegate.findUnique({
    where: { companyId_documentKind: { companyId, documentKind: periodKind } },
  });

  if (!existing) {
    const start = scannedMax + 1;

    try {
      await sequenceDelegate.create({
        data: { companyId, documentKind: periodKind, nextValue: start + 1 },
      });
      return formatDocumentNumber(prefix, start, length, suffix, date);
    } catch {
      // Race: another request created the row
    }
  } else if (existing.nextValue <= scannedMax) {
    await sequenceDelegate.updateMany({
      where: { companyId, documentKind: periodKind, nextValue: { lte: scannedMax } },
      data: { nextValue: scannedMax + 1 },
    });
  }

  const updated = await sequenceDelegate.update({
    where: { companyId_documentKind: { companyId, documentKind: periodKind } },
    data: { nextValue: { increment: 1 } },
  });

  const assigned = updated.nextValue - 1;
  return formatDocumentNumber(prefix, assigned, length, suffix, date);
}

/** Map sale status to invoice vs sales-order numbering. */
export function documentKindForSaleStatus(status: string): DocumentNumberKind {
  if (status === "DRAFT" || status === "CONFIRMED") return "sales_order";
  if (status === "PROFORMA") return "proforma_invoice";
  return "invoice";
}

/** Temporary draft numbers from older versions — replace on promote. */
export function isLegacyDraftDocumentNumber(value: string): boolean {
  return /^DRAFT-/i.test(value);
}
