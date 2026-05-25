import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { performReconciliation } from "@/actions/accounting";
import { z } from "zod";

const allocationSchema = z.array(
  z.object({
    paymentId: z.string().optional(),
    saleId: z.string().optional(),
    purchaseId: z.string().optional(),
    ledgerEntryId: z.string().optional(),
    allocatedAmount: z.number().positive(),
  }),
);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { companyId } = await requireCompanyAuth();
    const { id } = await params;
    const reconciliation = await prisma.reconciliation.findFirst({
      where: { id, companyId },
      include: {
        allocations: {
          include: {
            payment: true,
            sale: { select: { id: true, invoiceNumber: true } },
            purchase: { select: { id: true, referenceNumber: true } },
            ledgerEntry: true,
          },
        },
        createdBy: { select: { name: true } },
      },
    });

    if (!reconciliation) {
      return NextResponse.json({ error: "Reconciliation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: reconciliation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch reconciliation" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = allocationSchema.safeParse(body.allocations ?? body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reconciliation allocations" }, { status: 400 });
    }

    const data = await performReconciliation(id, parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to perform reconciliation" },
      { status: 500 },
    );
  }
}
