import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { requireCompanyAuth } from "@/lib/auth-helper";

const f = createUploadthing();

async function requireUploadAuth() {
  try {
    const user = await requireCompanyAuth();
    return { userId: user.id, companyId: user.companyId };
  } catch {
    throw new UploadThingError("Authentication required");
  }
}

function publicFileUrl(file: { ufsUrl?: string; url?: string; appUrl?: string }) {
  return file.ufsUrl || file.url || file.appUrl || "";
}

export const ourFileRouter = {
  productImage: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .middleware(requireUploadAuth)
    .onUploadComplete(async ({ file }) => {
      return { url: publicFileUrl(file) };
    }),

  companyLogo: f({ image: { maxFileSize: "1MB", maxFileCount: 1 } })
    .middleware(requireUploadAuth)
    .onUploadComplete(async ({ file }) => {
      return { url: publicFileUrl(file) };
    }),

  documentUpload: f({
    image: { maxFileSize: "4MB", maxFileCount: 5 },
    pdf: { maxFileSize: "8MB", maxFileCount: 3 },
  })
    .middleware(requireUploadAuth)
    .onUploadComplete(async ({ file }) => {
      return { url: publicFileUrl(file) };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
