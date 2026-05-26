import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { successResponse, errorResponse } from "@/lib/api";
import { generatePdfFromHtml } from "@/lib/html-pdf";
import { pdfFilename } from "@/lib/pdf-generator";
import { generateStatementHtml } from "@/lib/statement-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const format = searchParams.get("format");

    if (!customerId) return errorResponse("customerId is required");

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: user.companyId, deletedAt: null },
      include: { company: { select: { currencySymbol: true, country: true, settings: { select: { language: true } } } } },
    });
    if (!customer) return errorResponse("Customer not found", 404);

    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to) : new Date("2099-12-31");

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        companyId: user.companyId,
        customerId,
        entryDate: { lte: toDate },
      },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    });

    const priorEntries = entries.filter((e) => e.entryDate < fromDate);
    const periodEntries = entries.filter((e) => e.entryDate >= fromDate);

    const openingBalance = priorEntries.length > 0 ? Number(priorEntries[priorEntries.length - 1].balance) : 0;
    const closingBalance = periodEntries.length > 0 ? Number(periodEntries[periodEntries.length - 1].balance) : openingBalance;

    const transactions = periodEntries.map((e) => ({
      date: e.entryDate.toISOString(),
      reference: e.referenceNumber || "",
      description: e.description || "",
      debit: Number(e.debit),
      credit: Number(e.credit),
      balance: Number(e.balance),
      type: e.type,
    }));

    const statement = {
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      openingBalance,
      closingBalance,
      totalDebits: periodEntries.reduce((sum, e) => sum + Number(e.debit), 0),
      totalCredits: periodEntries.reduce((sum, e) => sum + Number(e.credit), 0),
      transactions,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    };

    if (format === "pdf") {
      const html = generateStatementHtml({
        title: "Customer Statement",
        partyLabel: "Customer",
        partyName: customer.name,
        partyPhone: customer.phone,
        fromDate,
        toDate,
        openingBalance,
        closingBalance,
        totalDebits: statement.totalDebits,
        totalCredits: statement.totalCredits,
        currencySymbol: customer.company.currencySymbol || "Rs",
        transactions,
      });
      const baseUrl = `${req.nextUrl.protocol}//${req.headers.get("host") || "localhost:3000"}`;
      const pdfBuffer = await generatePdfFromHtml(html, "A4", baseUrl);
      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdfFilename("customer-statement", customer.name)}"`,
          "Content-Length": pdfBuffer.length.toString(),
          "Cache-Control": "no-store",
        },
      });
    }

    return successResponse(statement);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch statement");
  }
}
