ALTER TABLE "stock_balances"
DROP CONSTRAINT IF EXISTS "stock_balances_productId_locationId_key";

DROP INDEX IF EXISTS "stock_balances_productId_locationId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "stock_balances_productId_locationId_companyId_key"
ON "stock_balances" ("productId", "locationId", "companyId");
