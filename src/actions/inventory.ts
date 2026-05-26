"use server";

import { revalidateBoth } from "@/lib/auth-helper";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { generateSku, slugify } from "@/lib/utils";
import { serialize } from "@/lib/serialize";
import { createAuditLog, createNotification } from "@/lib/audit";
import {
  adjustWarehouseStock,
  getProductStockAtWarehouse,
  resolveOperationalLocation,
} from "@/lib/locations";

function toNumber(value: unknown) {
  return Number(value) || 0;
}

async function getWarehouseTransferPolicy(companyId: string, userId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: { companyId, userId, isActive: true },
    select: { role: true, branchId: true },
  });
  const operational = await resolveOperationalLocation(prisma, { companyId, userId });
  const canChooseSource = membership?.role === "OWNER" || membership?.role === "ADMIN";

  if (canChooseSource) {
    const warehouses = await prisma.warehouse.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    return {
      canChooseSource,
      defaultFromWarehouseId: operational.warehouseId,
      sourceWarehouseIds: warehouses.map((warehouse) => warehouse.id),
    };
  }

  const sourceWarehouseIds = new Set<string>([operational.warehouseId]);
  if (membership?.branchId) {
    const branchWarehouses = await prisma.warehouse.findMany({
      where: {
        companyId,
        branchId: membership.branchId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
    branchWarehouses.forEach((warehouse) => sourceWarehouseIds.add(warehouse.id));
  }

  return {
    canChooseSource,
    defaultFromWarehouseId: operational.warehouseId,
    sourceWarehouseIds: Array.from(sourceWarehouseIds),
  };
}

export async function getProducts(params?: {
  search?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
  lowStock?: boolean;
}) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const where: Record<string, unknown> = {
    companyId,
    deletedAt: null,
  };

  if (params?.search) {
    const q = params.search.toLowerCase();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
    ];
  }

  if (params?.categoryId) {
    where.categoryId = params.categoryId;
  }

  if (params?.lowStock) {
    where.stock = { lte: prisma.product.fields.minStock };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: where as any,
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where: where as any }),
  ]);

  return {
    data: serialize(products),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getInventoryOperationsOverview() {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  await prisma.$transaction(async (tx) => {
    await tx.company.findUnique({ where: { id: companyId }, select: { id: true } });
  });

  const [
    productCount,
    stockableCount,
    valuationProducts,
    lowStockProducts,
    lowStockCount,
    warehouses,
    locations,
    logs,
    purchaseOrders,
    salesOrders,
    categories,
    lots,
  ] =
    await Promise.all([
      prisma.product.count({ where: { companyId, deletedAt: null } }),
      prisma.product.count({ where: { companyId, deletedAt: null, isService: false } }),
      prisma.product.findMany({
        where: { companyId, deletedAt: null, isService: false },
        select: {
          id: true,
          stock: true,
          minStock: true,
          purchasePrice: true,
          sellingPrice: true,
          barcode: true,
          expiryDate: true,
          trackingMode: true,
        },
      }),
      prisma.product.findMany({
        where: { companyId, deletedAt: null, isService: false, stock: { lte: prisma.product.fields.minStock } },
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
          minStock: true,
          maxStock: true,
          unit: true,
        },
        orderBy: { stock: "asc" },
        take: 12,
      }),
      prisma.product.count({
        where: { companyId, deletedAt: null, isService: false, stock: { lte: prisma.product.fields.minStock } },
      }),
      prisma.warehouse.findMany({
        where: { companyId, deletedAt: null },
        include: {
          branch: { select: { name: true, code: true } },
          _count: { select: { locations: true, productStocks: true } },
          productStocks: { select: { quantity: true } },
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
      prisma.warehouseLocation.count({ where: { companyId, deletedAt: null } }),
      prisma.inventoryLog.findMany({
        where: { companyId },
        include: {
          product: { select: { name: true, sku: true, unit: true } },
          warehouse: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.purchase.count({
        where: {
          companyId,
          deletedAt: null,
          status: { in: ["DRAFT", "PENDING", "PARTIALLY_RECEIVED"] },
        },
      }),
      prisma.sale.count({
        where: { companyId, deletedAt: null, status: { in: ["DRAFT", "CONFIRMED"] } },
      }),
      prisma.category.count({ where: { companyId, deletedAt: null } }),
      prisma.productLot.findMany({
        where: { companyId, isActive: true },
        include: {
          product: { select: { name: true, sku: true, trackingMode: true } },
          stocks: { include: { warehouse: { select: { name: true, code: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

  const expiringSoon = valuationProducts.filter(
    (product) =>
      product.expiryDate && product.expiryDate.getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000,
  );
  const valuation = valuationProducts.reduce(
    (sum, product) => sum + product.stock * toNumber(product.purchasePrice),
    0,
  );
  const saleValue = valuationProducts.reduce(
    (sum, product) => sum + product.stock * toNumber(product.sellingPrice),
    0,
  );
  const transferPolicy = await getWarehouseTransferPolicy(companyId, user.id);

  return {
    operationCards: [
      {
        label: "Receipts",
        value: purchaseOrders,
        href: "/purchases",
        hint: "Purchases waiting to receive",
      },
      {
        label: "Delivery Orders",
        value: salesOrders,
        href: "/sales",
        hint: "Sales waiting for delivery",
      },
      {
        label: "Internal Transfers",
        value: warehouses.length > 1 ? 1 : 0,
        href: "/inventory/warehouses",
        hint: "Move stock between warehouses",
      },
      {
        label: "Replenishment",
        value: lowStockCount,
        href: "/inventory/low-stock",
        hint: "Products below minimum",
      },
      {
        label: "Adjustments",
        value: logs.filter((log) => log.type === "ADJUSTMENT").length,
        href: "/inventory/adjustments",
        hint: "Recent stock corrections",
      },
    ],
    replenishment: lowStockProducts.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      minStock: product.minStock,
      maxStock: product.maxStock || product.minStock * 2,
      toOrder: Math.max((product.maxStock || product.minStock * 2) - product.stock, 0),
      unit: product.unit,
    })),
    warehouses: warehouses.map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
      branch: warehouse.branch,
      locations: warehouse._count.locations,
      products: warehouse._count.productStocks,
      onHand: warehouse.productStocks.reduce((sum, row) => sum + row.quantity, 0),
      isActive: warehouse.isActive,
    })),
    transferPolicy,
    traceability: {
      withBarcode: valuationProducts.filter((product) => product.barcode).length,
      expiringSoon: expiringSoon.length,
      lots: lots.filter((lot) => !lot.serialNumber).length,
      serials: lots.filter((lot) => lot.serialNumber).length,
      trackedCandidates: valuationProducts.filter(
        (product) => product.expiryDate || product.barcode || product.trackingMode !== "NONE",
      ).length,
    },
    lots: lots.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      serialNumber: lot.serialNumber,
      expiryDate: lot.expiryDate,
      notes: lot.notes,
      product: lot.product,
      quantity: lot.stocks.reduce((sum, stock) => sum + stock.quantity, 0),
      warehouses: lot.stocks.map((stock) => ({
        id: stock.warehouseId,
        name: stock.warehouse.name,
        code: stock.warehouse.code,
        quantity: stock.quantity,
      })),
      createdAt: lot.createdAt,
    })),
    valuation: {
      cost: valuation,
      saleValue,
      marginPotential: saleValue - valuation,
    },
    recentMoves: logs.map((log) => ({
      id: log.id,
      product: log.product,
      warehouse: log.warehouse,
      type: log.type,
      quantity: log.quantity,
      beforeStock: log.beforeStock,
      afterStock: log.afterStock,
      reference: log.reference,
      createdAt: log.createdAt,
    })),
    totals: {
      products: productCount,
      stockableProducts: stockableCount,
      categories,
      warehouses: warehouses.length,
      locations,
      lowStock: lowStockCount,
      expiringSoon: expiringSoon.length,
      stockOnHand: valuationProducts.reduce((sum, product) => sum + product.stock, 0),
      valuation,
    },
  };
}

export async function getProduct(id: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  return prisma.product.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { category: true },
  });
}

export async function createProduct(data: {
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  stock: number;
  minStock: number;
  maxStock?: number;
  unit?: string;
  tax?: number;
  discount?: number;
  categoryId?: string | null;
  isService?: boolean;
  trackingMode?: "NONE" | "LOT" | "SERIAL";
  expiryDate?: string;
  image?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
  });

  const sku = data.sku || generateSku(settings?.skuPrefix || "CD");
  const slug = slugify(data.name) + "-" + Date.now();

  const product = await prisma.product.create({
    data: {
      name: data.name,
      sku,
      barcode: data.barcode || "",
      description: data.description,
      purchasePrice: data.purchasePrice,
      sellingPrice: data.sellingPrice,
      wholesalePrice: data.wholesalePrice,
      stock: data.stock,
      minStock: data.minStock,
      maxStock: data.maxStock,
      unit: data.unit || "pcs",
      tax: data.tax ?? 0,
      discount: data.discount ?? 0,
      categoryId: data.categoryId || null,
      isService: data.isService ?? false,
      trackingMode: data.trackingMode || "NONE",
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      image: data.image,
      companyId,
    },
  });

  if (data.stock > 0) {
    await prisma.inventoryLog.create({
      data: {
        productId: product.id,
        companyId,
        type: "ADJUSTMENT",
        quantity: data.stock,
        beforeStock: 0,
        afterStock: data.stock,
        notes: "Initial stock",
        createdById: userId,
      },
    });
  }

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Product",
    entityId: product.id,
    metadata: { name: product.name, sku: product.sku },
  });

  revalidateBoth("/inventory", user.companySlug);
  return product;
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.product.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!existing) throw new Error("Product not found");

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      image: data.image ? String(data.image) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate as string) : undefined,
    },
  });

  if (typeof data.stock === "number" && data.stock !== existing.stock) {
    const beforeStock = existing.stock;
    const afterStock = data.stock;
    const diff = afterStock - beforeStock;
    await prisma.inventoryLog.create({
      data: {
        productId: id,
        companyId,
        type: "ADJUSTMENT",
        quantity: diff,
        beforeStock,
        afterStock,
        notes: "Stock adjusted via product edit",
        createdById: userId,
      },
    });
  }

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Product",
    entityId: id,
    metadata: { changes: data },
  });

  revalidateBoth("/inventory", user.companySlug);
  return product;
}

export async function deleteProduct(id: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.product.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!existing) throw new Error("Product not found");

  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "DELETE",
    entity: "Product",
    entityId: id,
    metadata: { name: existing.name },
  });

  revalidateBoth("/inventory", user.companySlug);
}

export async function getCategories() {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  return prisma.category.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(data: { name: string; description?: string; color?: string }) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const slug = slugify(data.name);

  const category = await prisma.category.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      color: data.color,
      companyId,
    },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Category",
    entityId: category.id,
    metadata: { name: category.name },
  });

  return category;
}

export async function adjustStock(data: {
  productId: string;
  branchId?: string;
  warehouseId?: string;
  quantity: number;
  type: string;
  notes?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const product = await prisma.product.findFirst({
    where: { id: data.productId, companyId, deletedAt: null },
  });
  if (!product) throw new Error("Product not found");

  const settings = await prisma.companySettings.findUnique({ where: { companyId } });

  const { branchId, warehouseId } = await resolveOperationalLocation(prisma, {
    companyId,
    userId,
    branchId: data.branchId,
    warehouseId: data.warehouseId,
  });
  const currentWarehouseStock = await getProductStockAtWarehouse(
    prisma,
    product,
    companyId,
    warehouseId,
  );
  const projectedWarehouseStock = currentWarehouseStock + data.quantity;
  if (!settings?.enableNegativeStock && !product.isService && projectedWarehouseStock < 0) {
    throw new Error(
      `Insufficient stock for ${product.name} at selected warehouse. Available: ${currentWarehouseStock}, adjustment: ${data.quantity}`,
    );
  }

  const { beforeStock, afterStock } = await adjustWarehouseStock(prisma, {
    companyId,
    productId: data.productId,
    warehouseId,
    quantityDelta: data.quantity,
  });

  await prisma.inventoryLog.create({
    data: {
      productId: data.productId,
      companyId,
      branchId,
      warehouseId,
      type: data.type,
      quantity: data.quantity,
      beforeStock,
      afterStock,
      notes: data.notes,
      createdById: userId,
    },
  });

  if (afterStock <= product.minStock && afterStock > 0) {
    await createNotification({
      companyId,
      userId,
      title: "Low Stock Alert",
      message: `${product.name} (${product.sku || "N/A"}) has only ${afterStock} units remaining (min: ${product.minStock})`,
      type: "WARNING",
      link: "/inventory",
    });
  }

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Product",
    entityId: data.productId,
    metadata: {
      stockAdjustment: { type: data.type, quantity: data.quantity, beforeStock, afterStock },
    },
  });

  revalidateBoth("/inventory", user.companySlug);
}

export async function transferStock(data: {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  if (data.fromWarehouseId === data.toWarehouseId) {
    throw new Error("Source and destination warehouses must be different");
  }

  const [product, fromWarehouse, toWarehouse, settings] = await Promise.all([
    prisma.product.findFirst({
      where: { id: data.productId, companyId, deletedAt: null },
      select: { id: true, name: true, sku: true, stock: true, minStock: true, isService: true },
    }),
    prisma.warehouse.findFirst({
      where: { id: data.fromWarehouseId, companyId, deletedAt: null, isActive: true },
      select: { id: true, name: true, code: true, branchId: true },
    }),
    prisma.warehouse.findFirst({
      where: { id: data.toWarehouseId, companyId, deletedAt: null, isActive: true },
      select: { id: true, name: true, code: true, branchId: true },
    }),
    prisma.companySettings.findUnique({ where: { companyId } }),
  ]);

  if (!product) throw new Error("Product not found");
  if (product.isService) throw new Error("Service products cannot be transferred");
  if (!fromWarehouse) throw new Error("Source warehouse not found");
  if (!toWarehouse) throw new Error("Destination warehouse not found");

  const transferPolicy = await getWarehouseTransferPolicy(companyId, userId);
  if (!transferPolicy.sourceWarehouseIds.includes(fromWarehouse.id)) {
    throw new Error("You can only transfer stock out of your assigned warehouse.");
  }

  const available = await getProductStockAtWarehouse(prisma, product, companyId, fromWarehouse.id);
  if (!settings?.enableNegativeStock && available < data.quantity) {
    throw new Error(
      `Insufficient stock at ${fromWarehouse.name}. Available: ${available}, requested: ${data.quantity}`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const source = await adjustWarehouseStock(tx, {
      companyId,
      productId: product.id,
      warehouseId: fromWarehouse.id,
      quantityDelta: -data.quantity,
    });
    const destination = await adjustWarehouseStock(tx, {
      companyId,
      productId: product.id,
      warehouseId: toWarehouse.id,
      quantityDelta: data.quantity,
    });

    const reference = `TRANSFER-${Date.now()}`;
    const noteSuffix = data.notes?.trim() ? ` | ${data.notes.trim()}` : "";
    await tx.inventoryLog.createMany({
      data: [
        {
          productId: product.id,
          companyId,
          branchId: fromWarehouse.branchId,
          warehouseId: fromWarehouse.id,
          type: "TRANSFER_OUT",
          quantity: -data.quantity,
          beforeStock: source.beforeStock,
          afterStock: source.afterStock,
          reference,
          notes: `Transfer to ${toWarehouse.code} - ${toWarehouse.name}${noteSuffix}`,
          createdById: userId,
        },
        {
          productId: product.id,
          companyId,
          branchId: toWarehouse.branchId,
          warehouseId: toWarehouse.id,
          type: "TRANSFER_IN",
          quantity: data.quantity,
          beforeStock: destination.beforeStock,
          afterStock: destination.afterStock,
          reference,
          notes: `Transfer from ${fromWarehouse.code} - ${fromWarehouse.name}${noteSuffix}`,
          createdById: userId,
        },
      ],
    });

    return { reference, source, destination };
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Product",
    entityId: product.id,
    metadata: {
      product: product.name,
      quantity: data.quantity,
      fromWarehouseId: fromWarehouse.id,
      toWarehouseId: toWarehouse.id,
      reference: result.reference,
    },
  });

  revalidateBoth("/inventory", user.companySlug);
  revalidateBoth("/inventory/warehouses", user.companySlug);
  return result;
}

export async function createProductLot(data: {
  productId: string;
  warehouseId: string;
  lotNumber: string;
  serialNumber?: string;
  quantity: number;
  expiryDate?: string;
  notes?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const product = await prisma.product.findFirst({
    where: { id: data.productId, companyId, deletedAt: null, isService: false },
    select: { id: true, name: true, stock: true, trackingMode: true },
  });
  if (!product) throw new Error("Product not found");

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: data.warehouseId, companyId, deletedAt: null, isActive: true },
    select: { id: true, branchId: true, name: true },
  });
  if (!warehouse) throw new Error("Warehouse not found");

  const isSerial = Boolean(data.serialNumber?.trim()) || product.trackingMode === "SERIAL";
  if (isSerial && data.quantity !== 1) {
    throw new Error("Serial-number tracked items must be registered one unit at a time");
  }

  const result = await prisma.$transaction(async (tx) => {
    const lot = await tx.productLot.upsert({
      where: {
        productId_lotNumber_companyId: {
          productId: product.id,
          lotNumber: data.lotNumber.trim(),
          companyId,
        },
      },
      create: {
        productId: product.id,
        companyId,
        lotNumber: data.lotNumber.trim(),
        serialNumber: data.serialNumber?.trim() || null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        notes: data.notes,
      },
      update: {
        serialNumber: data.serialNumber?.trim() || null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        notes: data.notes,
        isActive: true,
      },
    });

    const currentLotStock = await tx.productLotStock.findUnique({
      where: { lotId_warehouseId: { lotId: lot.id, warehouseId: warehouse.id } },
      select: { quantity: true },
    });
    const beforeLotStock = currentLotStock?.quantity || 0;
    const afterLotStock = beforeLotStock + data.quantity;

    await tx.productLotStock.upsert({
      where: { lotId_warehouseId: { lotId: lot.id, warehouseId: warehouse.id } },
      create: {
        lotId: lot.id,
        productId: product.id,
        warehouseId: warehouse.id,
        companyId,
        quantity: afterLotStock,
      },
      update: { quantity: afterLotStock },
    });

    const stock = await adjustWarehouseStock(tx, {
      companyId,
      productId: product.id,
      warehouseId: warehouse.id,
      quantityDelta: data.quantity,
    });

    const nextTrackingMode = isSerial ? "SERIAL" : "LOT";
    if (product.trackingMode === "NONE" || product.trackingMode !== nextTrackingMode) {
      await tx.product.update({
        where: { id: product.id },
        data: { trackingMode: nextTrackingMode },
      });
    }

    await tx.inventoryLog.create({
      data: {
        productId: product.id,
        companyId,
        branchId: warehouse.branchId,
        warehouseId: warehouse.id,
        lotId: lot.id,
        serialNumber: data.serialNumber?.trim() || null,
        type: isSerial ? "SERIAL_REGISTERED" : "LOT_RECEIPT",
        quantity: data.quantity,
        beforeStock: stock.beforeStock,
        afterStock: stock.afterStock,
        notes: data.notes || `Registered ${isSerial ? "serial" : "lot"} ${data.lotNumber}`,
        createdById: userId,
      },
    });

    return lot;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "ProductLot",
    entityId: result.id,
    metadata: {
      productId: product.id,
      lotNumber: data.lotNumber,
      serialNumber: data.serialNumber,
      quantity: data.quantity,
      warehouseId: warehouse.id,
    },
  });

  revalidateBoth("/inventory", user.companySlug);
  return result;
}

export async function getInventoryLedger(params?: {
  productId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 50;

  const where: Record<string, unknown> = { companyId };
  if (params?.productId) where.productId = params.productId;
  if (params?.type) where.type = params.type;
  if (params?.dateFrom || params?.dateTo) {
    const filter: Record<string, Date> = {};
    if (params.dateFrom) filter.gte = new Date(params.dateFrom);
    if (params.dateTo) filter.lte = new Date(params.dateTo);
    where.createdAt = filter;
  }

  const [logs, total] = await Promise.all([
    prisma.inventoryLog.findMany({
      where: where as any,
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        lot: { select: { id: true, lotNumber: true, serialNumber: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryLog.count({ where: where as any }),
  ]);

  return {
    data: logs.map((l) => ({
      ...l,
      quantity: l.quantity,
      beforeStock: l.beforeStock,
      afterStock: l.afterStock,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getTransferByReference(reference: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const logs = await prisma.inventoryLog.findMany({
    where: { companyId, reference },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (logs.length === 0) throw new Error("Transfer not found");

  const outLog = logs.find((l) => l.type === "TRANSFER_OUT");
  const inLog = logs.find((l) => l.type === "TRANSFER_IN");

  return {
    reference: outLog?.reference || inLog?.reference || reference,
    createdAt: outLog?.createdAt || inLog?.createdAt || new Date(),
    fromWarehouse: outLog?.warehouse || null,
    toWarehouse: inLog?.warehouse || null,
    notes: outLog?.notes || inLog?.notes || null,
    createdBy: outLog?.createdBy || inLog?.createdBy || null,
    items: logs.reduce(
      (acc, log) => {
        const existing = acc.find((a) => a.productId === log.productId);
        if (existing) {
          if (log.type === "TRANSFER_OUT") existing.quantity = log.quantity;
        } else {
          acc.push({
            productId: log.productId,
            productName: log.product.name,
            productSku: log.product.sku,
            productUnit: log.product.unit,
            quantity: Math.abs(log.quantity),
          });
        }
        return acc;
      },
      [] as Array<{
        productId: string;
        productName: string;
        productSku: string | null;
        productUnit: string | null;
        quantity: number;
      }>,
    ),
  };
}

export async function getLowStockProducts() {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const products = await prisma.product.findMany({
    where: { companyId, deletedAt: null, stock: { lte: prisma.product.fields.minStock } },
    include: { category: { select: { name: true } } },
    orderBy: { stock: "asc" },
  });

  return serialize(products);
}
