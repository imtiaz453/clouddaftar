import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export type ImportType = "products" | "customers" | "suppliers";

export interface ImportResult {
  success: number;
  errors: number;
  total: number;
  errorDetails: string[];
}

export function generateTemplate(type: ImportType): Buffer {
  const templates: Record<ImportType, { header: string[]; example: string[] }> = {
    products: {
      header: ["name", "sku", "barcode", "description", "purchasePrice", "sellingPrice", "wholesalePrice", "stock", "minStock", "unit", "tax", "discount", "categoryName", "isService", "expiryDate"],
      example: ["Product Name", "SKU-001", "123456789", "Product description", "100", "150", "120", "50", "10", "pcs", "0", "0", "Category Name", "FALSE", ""],
    },
    customers: {
      header: ["name", "email", "phone", "address", "city", "companyName", "taxId", "notes", "creditLimit"],
      example: ["Customer Name", "customer@example.com", "03001234567", "123 Street", "City Name", "Company Ltd", "NTN-123", "Notes here", "0"],
    },
    suppliers: {
      header: ["name", "email", "phone", "address", "city", "companyName", "taxId", "notes"],
      example: ["Supplier Name", "supplier@example.com", "03001234567", "123 Street", "City Name", "Company Ltd", "NTN-123", "Notes here"],
    },
  };

  const t = templates[type];
  const ws = XLSX.utils.aoa_to_sheet([t.header, t.example]);
  ws["!cols"] = t.header.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function validateAndGetCategoryId(categoryName: string | undefined, companyId: string): Promise<string | undefined> {
  if (!categoryName || !categoryName.trim()) return undefined;
  const cat = await prisma.category.findFirst({
    where: { name: { equals: categoryName.trim(), mode: "insensitive" }, companyId, deletedAt: null },
  });
  return cat?.id;
}

export function parseFile(buffer: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
}

const REQUIRED_PRODUCT = ["name", "purchaseprice", "sellingprice", "stock"];
const REQUIRED_CUSTOMER = ["name"];
const REQUIRED_SUPPLIER = ["name"];

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.trim().toLowerCase();
    out[key] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

export async function importProducts(rows: Record<string, unknown>[], companyId: string): Promise<ImportResult> {
  let success = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = normalizeRow(rows[i]);
      const missing = REQUIRED_PRODUCT.filter((f) => !row[f] || String(row[f]) === "");
      if (missing.length > 0) {
        errors.push(`Row ${i + 2}: Missing required fields: ${missing.join(", ")}`);
        continue;
      }

      const categoryId = await validateAndGetCategoryId(row.categoryname as string, companyId);

      const openingStock = parseInt(String(row.stock)) || 0;
      const purchasePrice = parseFloat(String(row.purchaseprice)) || 0;

      await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name: String(row.name),
            sku: String(row.sku || ""),
            barcode: String(row.barcode || ""),
            description: String(row.description || ""),
            purchasePrice,
            sellingPrice: parseFloat(String(row.sellingprice)) || 0,
            wholesalePrice: row.wholesaleprice ? parseFloat(String(row.wholesaleprice)) : null,
            stock: openingStock,
            minStock: parseInt(String(row.minstock)) || 10,
            unit: String(row.unit || "pcs"),
            tax: parseFloat(String(row.tax || 0)),
            discount: parseFloat(String(row.discount || 0)),
            categoryId,
            isService: ["true", "1", "yes"].includes(String(row.isservice).toLowerCase()),
            expiryDate: row.expirydate ? new Date(String(row.expirydate)) : null,
            companyId,
          },
        });

        if (openingStock > 0) {
          let location = await tx.stockLocation.findFirst({
            where: {
              companyId,
              deletedAt: null,
              isActive: true,
              OR: [{ isDefault: true }, { type: "MAIN_WAREHOUSE" }],
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          });

          if (!location) {
            location = await tx.stockLocation.create({
              data: {
                companyId,
                name: "Main Stock",
                code: `MAIN-STOCK-${companyId.slice(-6)}`.toUpperCase(),
                type: "MAIN_WAREHOUSE",
                isDefault: true,
                isActive: true,
                isSellable: true,
              },
            });
          }

          await tx.stockBalance.upsert({
            where: {
              productId_locationId_companyId: {
                productId: product.id,
                locationId: location.id,
                companyId,
              },
            },
            update: {
              qtyOnHand: openingStock,
              qtyAvailable: openingStock,
              averageCost: purchasePrice,
              lastMovementAt: new Date(),
            },
            create: {
              productId: product.id,
              locationId: location.id,
              companyId,
              qtyOnHand: openingStock,
              qtyReserved: 0,
              qtyAvailable: openingStock,
              reorderPoint: parseInt(String(row.minstock)) || 0,
              averageCost: purchasePrice,
              lastMovementAt: new Date(),
            },
          });

          await tx.stockLedger.create({
            data: {
              productId: product.id,
              locationId: location.id,
              companyId,
              movementType: "OPENING_BALANCE",
              quantity: openingStock,
              qtyOnHandBefore: 0,
              qtyOnHandAfter: openingStock,
              qtyReservedBefore: 0,
              qtyReservedAfter: 0,
              reference: "PRODUCT_IMPORT",
              notes: "Opening stock from product import",
            },
          });
        }
      });
      success++;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { success, errors: errors.length, total: rows.length, errorDetails: errors };
}

export async function importCustomers(rows: Record<string, unknown>[], companyId: string): Promise<ImportResult> {
  let success = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = normalizeRow(rows[i]);
      const missing = REQUIRED_CUSTOMER.filter((f) => !row[f] || String(row[f]) === "");
      if (missing.length > 0) {
        errors.push(`Row ${i + 2}: Missing required fields: ${missing.join(", ")}`);
        continue;
      }

      const phone = String(row.phone || "");
      if (phone) {
        const existing = await prisma.customer.findFirst({
          where: { phone, companyId, deletedAt: null },
        });
        if (existing) {
          errors.push(`Row ${i + 2}: Customer with phone "${phone}" already exists`);
          continue;
        }
      }

      await prisma.customer.create({
        data: {
          name: String(row.name),
          email: String(row.email || ""),
          phone,
          address: String(row.address || ""),
          city: String(row.city || ""),
          companyName: String(row.companyname || ""),
          taxId: String(row.taxid || ""),
          notes: String(row.notes || ""),
          creditLimit: parseFloat(String(row.creditlimit || 0)),
          companyId,
        },
      });
      success++;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { success, errors: errors.length, total: rows.length, errorDetails: errors };
}

export async function importSuppliers(rows: Record<string, unknown>[], companyId: string): Promise<ImportResult> {
  let success = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = normalizeRow(rows[i]);
      const missing = REQUIRED_SUPPLIER.filter((f) => !row[f] || String(row[f]) === "");
      if (missing.length > 0) {
        errors.push(`Row ${i + 2}: Missing required fields: ${missing.join(", ")}`);
        continue;
      }

      const phone = String(row.phone || "");
      if (phone) {
        const existing = await prisma.supplier.findFirst({
          where: { phone, companyId, deletedAt: null },
        });
        if (existing) {
          errors.push(`Row ${i + 2}: Supplier with phone "${phone}" already exists`);
          continue;
        }
      }

      await prisma.supplier.create({
        data: {
          name: String(row.name),
          email: String(row.email || ""),
          phone,
          address: String(row.address || ""),
          city: String(row.city || ""),
          companyName: String(row.companyname || ""),
          taxId: String(row.taxid || ""),
          notes: String(row.notes || ""),
          companyId,
        },
      });
      success++;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { success, errors: errors.length, total: rows.length, errorDetails: errors };
}
