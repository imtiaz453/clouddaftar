import { NextRequest, NextResponse } from "next/server";
import { getCategories, createCategory } from "@/actions/inventory";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createAuditLog } from "@/lib/audit";
import { slugify } from "@/lib/utils";

export async function GET() {
  try {
    const categories = await getCategories();
    const catsWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await prisma.product.count({ where: { categoryId: cat.id, deletedAt: null } });
        return { ...cat, _count: { products: count } };
      }),
    );
    return NextResponse.json({ success: true, data: catsWithCounts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch categories" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const category = await createCategory({ name: body.name, description: body.description, color: body.color });
    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create category" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { companyId, id: userId } = user;
    const { id, name, description, color } = await req.json();

    const slug = slugify(name);
    const category = await prisma.category.update({
      where: { id },
      data: { name, slug, description, color },
    });

    await createAuditLog({
      userId, companyId,
      action: "UPDATE", entity: "Category",
      entityId: id,
      metadata: { name },
    });

    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update category" },
      { status: 500 },
    );
  }
}
