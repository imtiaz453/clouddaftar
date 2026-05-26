type Tx = any;

function companyBillingPrefix(companyId: string, slug?: string | null) {
  const stable = (slug || companyId).replace(/[^a-zA-Z0-9]+/g, "").slice(0, 10);
  const idFragment = companyId
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(-6)
    .toUpperCase();
  return `SUB-${(stable || "TENANT").toUpperCase()}-${idFragment || "000000"}`;
}

function parseBillingSequence(invoiceNumber: string, prefix: string) {
  if (!invoiceNumber.startsWith(`${prefix}-`)) return 0;
  return parseInt(invoiceNumber.split("-").at(-1) || "0", 10) || 0;
}

export async function reserveNextBillingInvoiceNumber(tx: Tx, companyId: string) {
  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: { slug: true },
  });
  const prefix = companyBillingPrefix(companyId, company?.slug);
  const documentKind = "billing_invoice";
  const rows = await tx.billingInvoice.findMany({
    where: { companyId },
    select: { invoiceNumber: true },
  });
  const scannedMax = rows.reduce(
    (max: number, row: { invoiceNumber: string }) =>
      Math.max(max, parseBillingSequence(row.invoiceNumber, prefix)),
    0,
  );
  const sequenceDelegate = tx.documentNumberSequence;

  if (!sequenceDelegate?.findUnique || !sequenceDelegate?.create || !sequenceDelegate?.update) {
    return `${prefix}-${String(scannedMax + 1).padStart(5, "0")}`;
  }

  const existing = await sequenceDelegate.findUnique({
    where: { companyId_documentKind: { companyId, documentKind } },
  });

  if (!existing) {
    try {
      await sequenceDelegate.create({
        data: { companyId, documentKind, nextValue: scannedMax + 2 },
      });
      return `${prefix}-${String(scannedMax + 1).padStart(5, "0")}`;
    } catch {
      // Concurrent request created the row; continue to atomic increment.
    }
  } else if (existing.nextValue <= scannedMax) {
    await sequenceDelegate.updateMany({
      where: { companyId, documentKind, nextValue: { lte: scannedMax } },
      data: { nextValue: scannedMax + 1 },
    });
  }

  const updated = await sequenceDelegate.update({
    where: { companyId_documentKind: { companyId, documentKind } },
    data: { nextValue: { increment: 1 } },
  });
  return `${prefix}-${String(updated.nextValue - 1).padStart(5, "0")}`;
}
