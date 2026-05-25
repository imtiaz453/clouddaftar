"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createAuditLog } from "@/lib/audit";

export async function getUnits() {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  return prisma.unit.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createUnit(data: { name: string; abbreviation?: string }) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.unit.findFirst({
    where: { name: data.name, companyId, deletedAt: null },
  });
  if (existing) throw new Error("Unit with this name already exists");

  const unit = await prisma.unit.create({
    data: {
      name: data.name,
      abbreviation: data.abbreviation || "",
      companyId,
    },
  });

  await createAuditLog({
    userId, companyId, action: "CREATE",
    entity: "Unit", entityId: unit.id,
    metadata: { name: unit.name },
  });

  revalidatePath("/settings");
  return unit;
}

export async function updateUnit(id: string, data: { name?: string; abbreviation?: string; isActive?: boolean }) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.unit.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!existing) throw new Error("Unit not found");

  if (data.name && data.name !== existing.name) {
    const duplicate = await prisma.unit.findFirst({
      where: { name: data.name, companyId, id: { not: id }, deletedAt: null },
    });
    if (duplicate) throw new Error("Unit with this name already exists");
  }

  const unit = await prisma.unit.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.abbreviation !== undefined && { abbreviation: data.abbreviation }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await createAuditLog({
    userId, companyId, action: "UPDATE",
    entity: "Unit", entityId: id,
    metadata: { name: unit.name },
  });

  revalidatePath("/settings");
  return unit;
}

export async function deleteUnit(id: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.unit.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!existing) throw new Error("Unit not found");

  const productsUsingUnit = await prisma.product.count({
    where: { unit: existing.name, companyId, deletedAt: null },
  });
  if (productsUsingUnit > 0) {
    throw new Error(`Cannot delete unit "${existing.name}" — ${productsUsingUnit} product(s) are using it`);
  }

  await prisma.unit.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await createAuditLog({
    userId, companyId, action: "DELETE",
    entity: "Unit", entityId: id,
    metadata: { name: existing.name },
  });

  revalidatePath("/settings");
}
