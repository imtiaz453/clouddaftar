"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export type BrandingSettings = {
  logoUrl: string;
  appName: string;
  faviconUrl: string;
};

const DEFAULTS: BrandingSettings = {
  logoUrl: "",
  appName: "Cloud Daftar",
  faviconUrl: "",
};

export async function getBranding(): Promise<BrandingSettings> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: ["logoUrl", "appName", "faviconUrl"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULTS, ...map };
}

export async function getBrandingForAdmin() {
  await requireAdmin();
  return getBranding();
}

export async function updateBranding(data: Partial<BrandingSettings>) {
  await requireAdmin();
  const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
  for (const [key, value] of entries) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });
  }
  revalidatePath("/cloud-daftar-admin/settings");
  return { success: true };
}
