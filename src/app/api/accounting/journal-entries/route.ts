import { NextResponse } from "next/server";
import { getJournalEntries, getJournalEntry, createJournalEntry } from "@/actions/accounting-coa";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) {
      const data = await getJournalEntry(id);
      return NextResponse.json({ success: true, data });
    }
    const journalType = searchParams.get("journalType") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const data = await getJournalEntries({ journalType: journalType as any, page, pageSize });
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await createJournalEntry(body);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}
