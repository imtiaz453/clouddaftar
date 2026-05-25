import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { bufferToDataUrl, uploadBufferToFileStorage } from "@/lib/file-storage";

export const runtime = "nodejs";

const maxSize = 2 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const session = await getCurrentAdmin();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = ((formData.get("type") as string) || "branding").replace(/[^a-zA-Z0-9_-]+/g, "-");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Max 2MB" }, { status: 400 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    const isImage = file.type.startsWith("image/") || extension === "ico" || extension === "svg";
    if (!isImage) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType =
      file.type || (extension === "ico" ? "image/x-icon" : "application/octet-stream");
    const storedFile = await uploadBufferToFileStorage({
      buffer,
      fileName: file.name,
      contentType,
      prefix: `system/${session.admin.id}/${type}`,
    });
    const url = storedFile?.url || bufferToDataUrl(buffer, contentType);

    return NextResponse.json({
      success: true,
      provider: storedFile?.provider || "data-url",
      key: storedFile?.key,
      url,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
