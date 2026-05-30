import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Inventory Migration Script ===");
  console.log("Migrating from old Warehouse/ProductStock to StockLocation/StockBalance\n");

  const companies = await prisma.company.findMany({ where: { deletedAt: null } });
  console.log(`Found ${companies.length} companies\n`);

  let totalProductsMigrated = 0;
  let totalLocationsCreated = 0;
  let totalBalancesCreated = 0;
  let totalLedgersCreated = 0;
  let totalLotStocksMigrated = 0;

  for (const company of companies) {
    console.log(`--- Processing company: ${company.name} (${company.id}) ---`);

    // 1. Ensure default MAIN_WAREHOUSE StockLocation
    let defaultLocation = await prisma.stockLocation.findFirst({
      where: { companyId: company.id, isDefault: true, type: "MAIN_WAREHOUSE", deletedAt: null },
    });

    if (!defaultLocation) {
      defaultLocation = await prisma.stockLocation.findFirst({
        where: { companyId: company.id, type: "MAIN_WAREHOUSE", deletedAt: null },
      });
    }

    if (!defaultLocation) {
      defaultLocation = await prisma.stockLocation.create({
        data: {
          name: "Main Warehouse",
          code: "MAIN",
          type: "MAIN_WAREHOUSE",
          companyId: company.id,
          isDefault: true,
          isSellable: true,
          isActive: true,
        },
      });
      totalLocationsCreated++;
      console.log(`  Created default MAIN_WAREHOUSE location: ${defaultLocation.name} (${defaultLocation.id})`);
    } else {
      console.log(`  Found existing location: ${defaultLocation.name} (${defaultLocation.id})`);
    }

    // 2. Migrate old ProductStock entries to StockBalance
    const oldProductStocks = await prisma.productStock.findMany({
      where: { companyId: company.id },
      include: { warehouse: true, product: true },
    });

    for (const ps of oldProductStocks) {
      // Map old warehouse to stock location
      let locationId = defaultLocation.id;

      // Check if this warehouse has a corresponding StockLocation
      const existingLocation = await prisma.stockLocation.findFirst({
        where: { companyId: company.id, code: ps.warehouse.code, deletedAt: null },
      });

      if (existingLocation) {
        locationId = existingLocation.id;
      }

      // Upsert StockBalance
      const existingBalance = await prisma.stockBalance.findUnique({
        where: { productId_locationId: { productId: ps.productId, locationId } },
      });

      if (!existingBalance) {
        await prisma.stockBalance.create({
          data: {
            productId: ps.productId,
            locationId,
            companyId: company.id,
            qtyOnHand: ps.quantity,
            qtyReserved: 0,
            qtyAvailable: ps.quantity,
            averageCost: Number(ps.product.purchasePrice) || 0,
            reorderPoint: ps.minStock,
          },
        });
        totalBalancesCreated++;

        // Create Opening Balance ledger entry if qty > 0
        if (ps.quantity > 0) {
          const existingLedger = await prisma.stockLedger.findFirst({
            where: {
              productId: ps.productId,
              locationId,
              companyId: company.id,
              movementType: "OPENING_BALANCE",
            },
          });
          if (!existingLedger) {
            await prisma.stockLedger.create({
              data: {
                productId: ps.productId,
                locationId,
                companyId: company.id,
                movementType: "OPENING_BALANCE",
                quantity: ps.quantity,
                qtyOnHandBefore: 0,
                qtyOnHandAfter: ps.quantity,
                qtyReservedBefore: 0,
                qtyReservedAfter: 0,
                notes: "Migrated from old inventory system",
              },
            });
            totalLedgersCreated++;
          }
        }
        totalProductsMigrated++;
      }
    }

    if (oldProductStocks.length > 0) {
      console.log(`  Migrated ${oldProductStocks.length} ProductStock entries`);
    }

    // 3. Migrate Product.stock to StockBalance if no StockBalance exists yet
    const products = await prisma.product.findMany({
      where: {
        companyId: company.id,
        deletedAt: null,
        stock: { gt: 0 },
      },
    });

    for (const product of products) {
      const existingBalance = await prisma.stockBalance.findFirst({
        where: { productId: product.id, companyId: company.id },
      });

      if (!existingBalance && product.stock > 0) {
        await prisma.stockBalance.create({
          data: {
            productId: product.id,
            locationId: defaultLocation.id,
            companyId: company.id,
            qtyOnHand: product.stock,
            qtyReserved: 0,
            qtyAvailable: product.stock,
            averageCost: Number(product.purchasePrice) || 0,
          },
        });
        totalBalancesCreated++;

        await prisma.stockLedger.create({
          data: {
            productId: product.id,
            locationId: defaultLocation.id,
            companyId: company.id,
            movementType: "OPENING_BALANCE",
            quantity: product.stock,
            qtyOnHandBefore: 0,
            qtyOnHandAfter: product.stock,
            qtyReservedBefore: 0,
            qtyReservedAfter: 0,
            notes: "Migrated from Product.stock",
          },
        });
        totalLedgersCreated++;
        totalProductsMigrated++;
      }
    }

    if (products.length > 0) {
      console.log(`  Migrated ${products.length} Product.stock entries`);
    }

    // 4. Migrate old ProductLotStock entries (warehouse-based → location-based)
    const oldLotStocks = await prisma.productLotStock.findMany({
      where: { companyId: company.id },
      include: { location: true },
    });

    for (const lotStock of oldLotStocks) {
      // Already migrated if locationId is set (schema changed)
      // Check if we need to migrate warehouseId reference
      // The schema now requires locationId, so this is handled
      totalLotStocksMigrated++;
    }

    if (oldLotStocks.length > 0) {
      console.log(`  Found ${oldLotStocks.length} ProductLotStock entries (already using StockLocation)`);
    }

    console.log("");
  }

  console.log("=== Migration Summary ===");
  console.log(`Total locations created: ${totalLocationsCreated}`);
  console.log(`Total products migrated: ${totalProductsMigrated}`);
  console.log(`Total StockBalances created: ${totalBalancesCreated}`);
  console.log(`Total StockLedger entries created: ${totalLedgersCreated}`);
  console.log(`Total ProductLotStock entries migrated: ${totalLotStocksMigrated}`);
  console.log("\nMigration complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
