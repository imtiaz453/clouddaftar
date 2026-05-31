import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, requirePermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";
import { bufferToDataUrl, uploadBufferToFileStorage } from "@/lib/file-storage";

export const runtime = "nodejs";

const uploadProfiles = {
  logo: {
    maxSize: 2 * 1024 * 1024,
    allowedTypes: ["image/"],
    prefix: "company-logos",
    updateCompanyLogo: true,
  },
  companyLogo: {
    maxSize: 2 * 1024 * 1024,
    allowedTypes: ["image/"],
    prefix: "company-logos",
    updateCompanyLogo: true,
  },
  productImage: {
    maxSize: 4 * 1024 * 1024,
    allowedTypes: ["image/"],
    prefix: "product-images",
    updateCompanyLogo: false,
  },
  paymentScreenshot: {
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ["image/"],
    prefix: "payment-screenshots",
    updateCompanyLogo: false,
  },
  documentUpload: {
    maxSize: 8 * 1024 * 1024,
    allowedTypes: ["image/", "application/pdf"],
    prefix: "documents",
    updateCompanyLogo: false,
  },
} as const;

type UploadType = keyof typeof uploadProfiles;

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const requestedType = ((formData.get("type") as string) || "logo") as UploadType;
    const profile = uploadProfiles[requestedType] || uploadProfiles.logo;

    if (profile.updateCompanyLogo) {
      await requirePermission(PERMISSIONS.COMPANY_SETTINGS_MANAGE);
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > profile.maxSize) {
      return NextResponse.json(
        { error: `File too large. Max ${Math.round(profile.maxSize / 1024 / 1024)}MB` },
        { status: 400 },
      );
    }

    const isAllowedType = profile.allowedTypes.some((allowedType) =>
      allowedType.endsWith("/") ? file.type.startsWith(allowedType) : file.type === allowedType,
    );
    if (!isAllowedType) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const storedFile = await uploadBufferToFileStorage({
      buffer,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      prefix: `${user.companyId}/${profile.prefix}`,
    });
    const url = storedFile?.url || bufferToDataUrl(buffer, file.type || "application/octet-stream");

    if (profile.updateCompanyLogo) {
      await prisma.company.update({
        where: { id: user.companyId },
        data: { logo: url },
      });
    }

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
