import { UTApi, UTFile } from "uploadthing/server";

export type StoredFile = {
  provider: "uploadthing";
  url: string;
  key?: string;
  name: string;
  size: number;
  type: string;
};

type UploadBufferInput = {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  prefix: string;
};

export function isExternalFileStorageConfigured() {
  return Boolean(process.env.UPLOADTHING_TOKEN);
}

export function bufferToDataUrl(buffer: Buffer, contentType: string) {
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function uploadBufferToFileStorage({
  buffer,
  fileName,
  contentType,
  prefix,
}: UploadBufferInput): Promise<StoredFile | null> {
  if (!isExternalFileStorageConfigured()) {
    return null;
  }

  const safePrefix = sanitizePathSegment(prefix || "uploads");
  const safeName = sanitizeFileName(fileName || "upload");
  const customId = `${safePrefix}/${Date.now()}-${safeName}`;
  const file = new UTFile([new Uint8Array(buffer)], safeName, {
    type: contentType,
    customId,
  });

  const result = await new UTApi().uploadFiles(file, { acl: "public-read" });
  if (result.error || !result.data) {
    throw new Error(result.error?.message || "External file upload failed");
  }
  const data = result.data as typeof result.data & {
    ufsUrl?: string;
    url?: string;
    appUrl?: string;
  };

  return {
    provider: "uploadthing",
    url: data.ufsUrl || data.url || data.appUrl || "",
    key: data.key,
    name: data.name,
    size: data.size,
    type: data.type,
  };
}

function sanitizePathSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "")
    .slice(0, 80);
}

function sanitizeFileName(value: string) {
  const clean = value
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return clean || "upload";
}
