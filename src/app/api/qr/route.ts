import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const payload = searchParams.get("payload");
    if (!payload) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const svg = await QRCode.toString(payload, {
      type: "svg",
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate QR" }, { status: 500 });
  }
}
