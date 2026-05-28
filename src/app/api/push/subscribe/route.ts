import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { endpoint, p256dh, auth, userAgent } = await req.json();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: endpoint, p256dh, auth" },
        { status: 400 },
      );
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: {
        endpoint_companyId: { endpoint, companyId: user.companyId },
      },
      update: {
        p256dh,
        auth,
        userAgent: userAgent || null,
      },
      create: {
        companyId: user.companyId,
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent || null,
      },
    });

    return NextResponse.json({ success: true, data: subscription });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to subscribe" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: "Missing endpoint" },
        { status: 400 },
      );
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, companyId: user.companyId, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to unsubscribe" },
      { status: 500 },
    );
  }
}
