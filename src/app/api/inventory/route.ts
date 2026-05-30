import { NextResponse } from "next/server";
import { createProduct, deleteProduct, getProducts, updateProduct } from "@/actions/inventory";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 50);
    const data = await getProducts({
      search: searchParams.get("search") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      locationId: searchParams.get("locationId") || undefined,
      stockStatus: (searchParams.get("stockStatus") || undefined) as "low" | "out" | undefined,
      page,
      pageSize,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load inventory" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const product = await createProduct({
      name: String(body.name || "").trim(),
      sku: body.sku || undefined,
      barcode: body.barcode || undefined,
      description: body.description || undefined,
      purchasePrice: Number(body.purchasePrice || 0),
      sellingPrice: Number(body.sellingPrice || 0),
      wholesalePrice: body.wholesalePrice === undefined || body.wholesalePrice === "" ? undefined : Number(body.wholesalePrice),
      minStock: Number(body.minStock || 0),
      maxStock: body.maxStock === undefined || body.maxStock === "" ? undefined : Number(body.maxStock),
      unit: body.unit || "pcs",
      tax: Number(body.tax || 0),
      categoryId: body.categoryId || null,
      isService: Boolean(body.isService),
      trackingMode: body.trackingMode || "NONE",
      image: body.image || undefined,
    });
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to create product" }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ success: false, error: "Product id is required" }, { status: 400 });
    const { id, stock, mfgDate, expiryDate, ...data } = body;
    const product = await updateProduct(String(id), {
      ...data,
      categoryId: data.categoryId || null,
      purchasePrice: Number(data.purchasePrice || 0),
      sellingPrice: Number(data.sellingPrice || 0),
      wholesalePrice: data.wholesalePrice === undefined || data.wholesalePrice === "" ? undefined : Number(data.wholesalePrice),
      minStock: Number(data.minStock || 0),
      maxStock: data.maxStock === undefined || data.maxStock === "" ? undefined : Number(data.maxStock),
      tax: Number(data.tax || 0),
      isService: Boolean(data.isService),
    });
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to update product" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ success: false, error: "Product id is required" }, { status: 400 });
    await deleteProduct(String(body.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to delete product" }, { status: 400 });
  }
}
