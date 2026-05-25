import { NextResponse } from "next/server";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { generateTemplate } from "@/lib/import-utils";

export async function GET() {
  try {
    await requireCompanyAuth();
    const buffer = generateTemplate("suppliers"); const uint8 = new Uint8Array(buffer);
    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=suppliers-template.xlsx",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
