import { NextResponse } from "next/server";
import { getProductsForSelector } from "@/actions/inventory";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const take = Math.max(1, Math.min(Number(searchParams.get("take") || 50), 100));
    const products = await getProductsForSelector(search);
    return NextResponse.json({ success: true, data: products.slice(0, take) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load products" },
      { status: 500 },
    );
  }
}
