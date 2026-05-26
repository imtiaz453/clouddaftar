import type { JournalType } from "@prisma/client";

type Tx = any;

const JOURNAL_PREFIX: Record<JournalType, string> = {
  GENERAL: "GL",
  SALES: "GL-INV",
  PURCHASES: "GL-BIL",
  CASH: "GL-CSH",
  BANK: "GL-BNK",
  RECEIPT: "GL-RCT",
  PAYMENT: "GL-PYT",
  SALARY: "GL-SAL",
};

function journalSequenceKind(journalType: JournalType) {
  return `journal:${journalType}`;
}

function parseJournalSequence(number: string, prefix: string) {
  if (!number.startsWith(`${prefix}-`)) return 0;
  return parseInt(number.split("-").at(-1) || "0", 10) || 0;
}

async function scanMaxJournalSequence(tx: Tx, companyId: string, journalType: JournalType) {
  const prefix = JOURNAL_PREFIX[journalType] || "GL";
  const rows = await tx.journalEntryMaster.findMany({
    where: { companyId, journalType },
    select: { number: true },
  });

  return rows.reduce((max: number, row: { number: string }) => {
    return Math.max(max, parseJournalSequence(row.number, prefix));
  }, 0);
}

export async function reserveNextJournalNumber(
  tx: Tx,
  companyId: string,
  journalType: JournalType,
) {
  const prefix = JOURNAL_PREFIX[journalType] || "GL";
  const documentKind = journalSequenceKind(journalType);
  const scannedMax = await scanMaxJournalSequence(tx, companyId, journalType);
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
      // Created concurrently; continue to the atomic increment below.
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
