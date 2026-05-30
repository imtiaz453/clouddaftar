import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { getUserAccessibleLocationIds } from "@/lib/locations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId")?.trim();
    const locationId = searchParams.get("locationId")?.trim();

    if (!productId || !locationId) {
      return NextResponse.json(
        {
          success: false,
          error: "productId and locationId are required",
          available: 0,
          qtyAvailable: 0,
          qtyOnHand: 0,
          qtyReserved: 0,
        },
        { status: 400 },
      );
    }

    const { companyId, id: userId, role } = await requireCompanyAuth();

    const [product, location] = await Promise.all([
      prisma.product.findFirst({
        where: { id: productId, companyId, deletedAt: null, isActive: true },
        select: { id: true },
      }),
      prisma.stockLocation.findFirst({
        where: { id: locationId, companyId, deletedAt: null, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found", available: 0, qtyAvailable: 0, qtyOnHand: 0, qtyReserved: 0 },
        { status: 404 },
      );
    }

    if (!location) {
      return NextResponse.json(
        { success: false, error: "Source location not found", available: 0, qtyAvailable: 0, qtyOnHand: 0, qtyReserved: 0 },
        { status: 404 },
      );
    }

    const accessibleIds = await getUserAccessibleLocationIds(prisma, companyId, userId, role);
    if (!accessibleIds.includes(locationId)) {
      return NextResponse.json(
        { success: false, error: "Access denied for this source location", available: 0, qtyAvailable: 0, qtyOnHand: 0, qtyReserved: 0 },
        { status: 403 },
      );
    }

    const balance = await prisma.stockBalance.findUnique({
      where: {
        productId_locationId_companyId: {
          productId,
          locationId,
          companyId,
        },
      },
      select: {
        qtyOnHand: true,
        qtyReserved: true,
        qtyAvailable: true,
      },
    });

    const qtyOnHand = Number(balance?.qtyOnHand ?? 0);
    const qtyReserved = Number(balance?.qtyReserved ?? 0);
    const calculatedAvailable = Math.max(0, qtyOnHand - qtyReserved);
    const qtyAvailable = balance ? Number(balance.qtyAvailable ?? calculatedAvailable) : 0;
    const available = Math.max(0, qtyAvailable || calculatedAvailable);

    return NextResponse.json({
      success: true,
      available,
      qtyAvailable: available,
      qtyOnHand,
      qtyReserved,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load stock",
        available: 0,
        qtyAvailable: 0,
        qtyOnHand: 0,
        qtyReserved: 0,
      },
      { status: 500 },
    );
  }
}
