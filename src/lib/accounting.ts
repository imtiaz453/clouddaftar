import { prisma } from "@/lib/prisma";
import type { LedgerEntryType } from "@prisma/client";

export function computePaymentStatus(
  total: number,
  paid: number,
): "UNPAID" | "PARTIALLY_PAID" | "PAID" {
  if (paid <= 0) return "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIALLY_PAID";
}

export async function createLedgerEntry(
  params: {
    companyId: string;
    customerId?: string | null;
    supplierId?: string | null;
    type: LedgerEntryType;
    referenceId: string;
    referenceNumber: string;
    debit: number;
    credit: number;
    description: string;
    createdById: string;
  },
  tx?: any,
) {
  const client = tx || prisma;
  const entries = await client.ledgerEntry.findMany({
    where: {
      companyId: params.companyId,
      customerId: params.customerId || undefined,
      supplierId: params.supplierId || undefined,
    },
    orderBy: { entryDate: "desc" },
    take: 1,
  });

  const lastBalance = entries.length > 0 ? Number(entries[0].balance) : 0;
  const balance = lastBalance + params.debit - params.credit;

  return client.ledgerEntry.create({
    data: {
      companyId: params.companyId,
      customerId: params.customerId || null,
      supplierId: params.supplierId || null,
      type: params.type,
      referenceId: params.referenceId,
      referenceNumber: params.referenceNumber,
      debit: params.debit,
      credit: params.credit,
      balance,
      entryDate: new Date(),
      description: params.description,
      createdById: params.createdById,
    },
  });
}

export async function recalculateLedgerBalances(
  tx: any,
  companyId: string,
  customerId?: string | null,
  supplierId?: string | null,
) {
  const entries = await tx.ledgerEntry.findMany({
    where: {
      companyId,
      customerId: customerId || undefined,
      supplierId: supplierId || undefined,
    },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  let balance = 0;
  for (const entry of entries) {
    balance = balance + Number(entry.debit) - Number(entry.credit);
    await tx.ledgerEntry.update({
      where: { id: entry.id },
      data: { balance },
    });
  }
}
