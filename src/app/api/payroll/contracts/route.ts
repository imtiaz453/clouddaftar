import { NextRequest, NextResponse } from "next/server";
import { getContracts, createContract } from "@/actions/payroll";

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.nextUrl.searchParams.get("employeeId");
    const contracts = await getContracts();
    const data = employeeId
      ? contracts.filter((contract) => contract.employeeId === employeeId)
      : contracts;
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await createContract(body);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}
