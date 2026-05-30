import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting stock migration...");

  // 1. Migrate Warehouses -> StockLocations
  const warehouses = await prisma.warehouse.findMany({ where: { deletedAt: null } });
  console.log(`Found ${warehouses.length} warehouses to migrate`);

  for (const wh of warehouses) {
    const existing = await prisma.stockLocation.findUnique({
      where: { code_companyId: { code: wh.code, companyId: wh.companyId } },
    });
    if (existing) {
      console.log(`  StockLocation already exists for warehouse ${wh.code}, skipping`);
      continue;
    }

    await prisma.stockLocation.create({
      data: {
        name: wh.name,
        code: wh.code,
        type: wh.type === "MAIN_WAREHOUSE" ? "MAIN_WAREHOUSE" : wh.type === "POS_STORE" ? "POS_STORE" : "BRANCH_STORE",
        branchId: wh.branchId,
        assignedEmployeeId: wh.assignedEmployeeId,
        companyId: wh.companyId,
        isDefault: wh.isDefault,
        isActive: wh.isActive,
        notes: wh.notes,
        createdAt: wh.createdAt,
        updatedAt: wh.updatedAt,
      },
    });
    console.log(`  Created StockLocation for warehouse "${wh.code}"`);
  }

  // 2. Find or create default MAIN_WAREHOUSE location per company
  const companies = await prisma.company.findMany({ where: { isActive: true } });
  for (const company of companies) {
    const defaultLoc = await prisma.stockLocation.findFirst({
      where: { companyId: company.id, isDefault: true },
    });
    if (!defaultLoc) {
      const existing = await prisma.stockLocation.findFirst({
        where: { companyId: company.id, code: "MAIN" },
      });
      if (!existing) {
        await prisma.stockLocation.create({
          data: {
            name: "Main Warehouse",
            code: "MAIN",
            type: "MAIN_WAREHOUSE",
            companyId: company.id,
            isDefault: true,
            isActive: true,
          },
        });
        console.log(`  Created default MAIN_WAREHOUSE for company ${company.id}`);
      }
    }
  }

  // 3. Migrate ProductStock -> StockBalance + opening ledger
  const productStocks = await prisma.productStock.findMany({
    include: { warehouse: true, product: true },
    where: { product: { deletedAt: null }, warehouse: { deletedAt: null } },
  });
  console.log(`Found ${productStocks.length} product stock records to migrate`);

  for (const ps of productStocks) {
    const location = await prisma.stockLocation.findFirst({
      where: { companyId: ps.companyId, code: ps.warehouse.code },
    });
    if (!location) {
      console.log(`  No StockLocation found for warehouse ${ps.warehouse.code}, skipping product ${ps.productId}`);
      continue;
    }

    if (ps.quantity <= 0) continue;

    const existingBalance = await prisma.stockBalance.findUnique({
      where: {
        productId_locationId_companyId: {
          productId: ps.productId,
          locationId: location.id,
          companyId: ps.companyId,
        },
      },
    });
    if (existingBalance) {
      console.log(`  Balance already exists for product ${ps.productId} at ${location.code}, skipping`);
      continue;
    }

    const qty = ps.quantity;
    await prisma.$transaction([
      prisma.stockBalance.create({
        data: {
          productId: ps.productId,
          locationId: location.id,
          companyId: ps.companyId,
          qtyOnHand: qty,
          qtyReserved: 0,
          qtyAvailable: qty,
        },
      }),
      prisma.stockLedger.create({
        data: {
          productId: ps.productId,
          locationId: location.id,
          companyId: ps.companyId,
          movementType: "OPENING_BALANCE",
          quantity: qty,
          qtyOnHandBefore: 0,
          qtyOnHandAfter: qty,
          qtyReservedBefore: 0,
          qtyReservedAfter: 0,
          notes: "Migrated from ProductStock",
        },
      }),
    ]);
    console.log(`  Migrated product ${ps.productId} stock ${qty} to location ${location.code}`);
  }

  // 4. For products with stock > 0 but no ProductStock record, create at default location
  const productsWithStock = await prisma.product.findMany({
    where: { stock: { gt: 0 }, deletedAt: null },
  });
  console.log(`Found ${productsWithStock.length} products with direct stock`);

  for (const product of productsWithStock) {
    const existingBalance = await prisma.stockBalance.findFirst({
      where: { productId: product.id, companyId: product.companyId },
    });
    if (existingBalance) continue;

    const defaultLocation = await prisma.stockLocation.findFirst({
      where: { companyId: product.companyId, isDefault: true },
    });
    if (!defaultLocation) continue;

    const qty = product.stock;
    await prisma.$transaction([
      prisma.stockBalance.create({
        data: {
          productId: product.id,
          locationId: defaultLocation.id,
          companyId: product.companyId,
          qtyOnHand: qty,
          qtyReserved: 0,
          qtyAvailable: qty,
        },
      }),
      prisma.stockLedger.create({
        data: {
          productId: product.id,
          locationId: defaultLocation.id,
          companyId: product.companyId,
          movementType: "OPENING_BALANCE",
          quantity: qty,
          qtyOnHandBefore: 0,
          qtyOnHandAfter: qty,
          qtyReservedBefore: 0,
          qtyReservedAfter: 0,
          notes: "Migrated from Product.stock field",
        },
      }),
    ]);
    console.log(`  Migrated direct stock ${qty} for product ${product.id}`);
  }

  // 5. Migrate InventoryLog -> StockLedger (for non-zero entries)
  const inventoryLogs = await prisma.inventoryLog.findMany({
    where: { quantity: { not: 0 } },
    orderBy: { createdAt: "asc" },
    take: 10000,
  });
  console.log(`Found ${inventoryLogs.length} inventory logs to migrate (limited to 10000)`);

  for (const log of inventoryLogs) {
    const existingLedger = await prisma.stockLedger.findFirst({
      where: {
        productId: log.productId,
        location: { companyId: log.companyId },
        reference: log.id,
      },
    });
    if (existingLedger) continue;

    let location;
    if (log.warehouseId) {
      const wh = await prisma.warehouse.findUnique({ where: { id: log.warehouseId }, select: { code: true } });
      if (wh) {
        location = await prisma.stockLocation.findFirst({
          where: { companyId: log.companyId, code: wh.code },
        });
      }
    }
    if (!location) {
      location = await prisma.stockLocation.findFirst({
        where: { companyId: log.companyId, isDefault: true },
      });
    }
    if (!location) continue;

    const movementType = mapInventoryType(log.type);
    const qty = Math.abs(log.quantity);
    const direction = log.quantity > 0 ? "IN" : "OUT";

    await prisma.stockLedger.create({
      data: {
        productId: log.productId,
        locationId: location.id,
        companyId: log.companyId,
        movementType,
        quantity: qty,
        qtyOnHandBefore: log.beforeStock,
        qtyOnHandAfter: log.afterStock,
        qtyReservedBefore: 0,
        qtyReservedAfter: 0,
        reference: log.id,
        referenceId: log.reference,
        notes: log.notes,
        createdById: log.createdById,
        createdAt: log.createdAt,
      },
    });
  }

  console.log("Migration complete!");
}

function mapInventoryType(type: string): "SALE" | "PURCHASE_RECEIVE" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "OPENING_BALANCE" | "SALE_RETURN" | "PURCHASE_RETURN" {
  switch (type) {
    case "SALE": return "SALE";
    case "PURCHASE": return "PURCHASE_RECEIVE";
    case "RETURN": return "SALE_RETURN";
    case "ADJUSTMENT": return "ADJUSTMENT_IN";
    default: return "ADJUSTMENT_IN";
  }
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
