import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { parseFile, importProducts, importCustomers, importSuppliers, type ImportType } from "@/lib/import-utils";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as ImportType;

    if (!file) return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    if (!["products", "customers", "suppliers"].includes(type)) {
      return NextResponse.json({ success: false, error: "Invalid import type" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseFile(buffer);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "File is empty or has no valid data rows" }, { status: 400 });
    }

    let result;
    switch (type) {
      case "products":
        result = await importProducts(rows, user.companyId);
        break;
      case "customers":
        result = await importCustomers(rows, user.companyId);
        break;
      case "suppliers":
        result = await importSuppliers(rows, user.companyId);
        break;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
