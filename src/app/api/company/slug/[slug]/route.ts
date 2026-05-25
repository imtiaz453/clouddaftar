import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const company = await prisma.company.findUnique({
      where: { slug },
      select: { name: true, logo: true },
    });

    if (!company) {
      return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: company });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch company" }, { status: 500 });
  }
}
