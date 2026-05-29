-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'CASHIER');

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('MAIN_WAREHOUSE', 'POS_STORE', 'EMPLOYEE_STORE');

-- CreateEnum
CREATE TYPE "StockLocationType" AS ENUM ('MAIN_WAREHOUSE', 'BRANCH_STORE', 'POS_STORE', 'EMPLOYEE_STORE', 'DAMAGED_STORE', 'RETURN_STORE');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING_BALANCE', 'PURCHASE_RECEIVE', 'PURCHASE_RETURN', 'SALE', 'SALE_RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RESERVATION', 'RESERVATION_RELEASE', 'WRITE_OFF', 'STOCK_COUNT_CORRECTION', 'DAMAGE', 'EXPIRY', 'LOST', 'FOUND', 'INTERNAL_USE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdjustmentReason" AS ENUM ('OPENING_BALANCE', 'CORRECTION', 'DAMAGE', 'EXPIRED', 'LOST', 'FOUND', 'INTERNAL_USE');

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'REVIEWED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PROFORMA', 'COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'PENDING', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CHEQUE', 'EASYPAISA', 'JAZZCASH', 'ONLINE_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "SalePaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PurchasePaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ProductTrackingMode" AS ENUM ('NONE', 'LOT', 'SERIAL', 'BATCH');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('INVOICE', 'PURCHASE', 'PAYMENT', 'RETURN', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', 'CONTRA_ASSET', 'CONTRA_LIABILITY', 'CONTRA_INCOME', 'CONTRA_EXPENSE');

-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('GENERAL', 'SALES', 'PURCHASES', 'CASH', 'BANK', 'RECEIPT', 'PAYMENT', 'SALARY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'READ', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'ENABLE', 'DISABLE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED_TO_SALE', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SystemAdminRole" AS ENUM ('OWNER', 'SUPER_ADMIN', 'BILLING_ADMIN', 'SUPPORT_ADMIN');

-- CreateEnum
CREATE TYPE "WageType" AS ENUM ('MONTHLY', 'HOURLY', 'DAILY');

-- CreateEnum
CREATE TYPE "SalaryRuleCategory" AS ENUM ('BASIC', 'ALLOWANCE', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION', 'NET');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'VERIFIED', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayslipBatchStatus" AS ENUM ('DRAFT', 'VERIFIED', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('ASSIGNED', 'AVAILABLE', 'MAINTENANCE', 'RETIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'PK',
    "taxId" TEXT,
    "taxName" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "currencySymbol" TEXT NOT NULL DEFAULT 'Rs',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "fiscalYearStart" TEXT NOT NULL DEFAULT '01-01',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "role" "RoleType" NOT NULL DEFAULT 'STAFF',
    "permissionOverrides" JSONB DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_records" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "hasSystemAccess" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "companyId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "StoreType" NOT NULL DEFAULT 'MAIN_WAREHOUSE',
    "branchId" TEXT,
    "assignedEmployeeId" TEXT,
    "companyId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INTERNAL',
    "warehouseId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentId" TEXT,
    "barcode" TEXT,
    "removalStrategy" TEXT,
    "isReplenishable" BOOLEAN NOT NULL DEFAULT false,
    "isScrapLocation" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "StockLocationType" NOT NULL DEFAULT 'MAIN_WAREHOUSE',
    "branchId" TEXT,
    "assignedEmployeeId" TEXT,
    "companyId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSellable" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "qtyOnHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qtyReserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qtyAvailable" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorderPoint" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lastMovementAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_ledgers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "qtyOnHandBefore" DECIMAL(18,4) NOT NULL,
    "qtyOnHandAfter" DECIMAL(18,4) NOT NULL,
    "qtyReservedBefore" DECIMAL(18,4) NOT NULL,
    "qtyReservedAfter" DECIMAL(18,4) NOT NULL,
    "reference" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "destinationLocationId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "companyId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "reason" "AdjustmentReason" NOT NULL DEFAULT 'CORRECTION',
    "companyId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_items" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'IN',
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "frozenAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_items" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "countedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "variance" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "RoleType" NOT NULL DEFAULT 'STAFF',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL DEFAULT '',
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "description" TEXT,
    "purchasePrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "wholesalePrice" DECIMAL(65,30),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "maxStock" INTEGER,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "trackingMode" "ProductTrackingMode" NOT NULL DEFAULT 'NONE',
    "mfgDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "categoryId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_stocks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "maxStock" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_lots" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "serialNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_lot_stocks" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_lot_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "companyName" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "creditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPurchases" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "companyName" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "totalSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "due" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "paymentStatus" "SalePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "terms" TEXT,
    "dueDate" TIMESTAMP(3),
    "customerId" TEXT,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "taxComplianceMode" TEXT NOT NULL DEFAULT 'NONE',
    "taxComplianceStatus" TEXT,
    "fbrInvoiceNumber" TEXT,
    "fbrQrPayload" TEXT,
    "zatcaQrPayload" TEXT,
    "zatcaPhase" TEXT,
    "zatcaInvoiceHash" TEXT,
    "zatcaSubmissionStatus" TEXT,
    "zatcaUuid" TEXT,
    "zatcaXmlPath" TEXT,
    "zatcaResponseJson" JSONB,
    "sellerTaxNumber" TEXT,
    "buyerTaxNumber" TEXT,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "due" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PurchasePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "terms" TEXT,
    "dueDate" TIMESTAMP(3),
    "supplierId" TEXT,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_logs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "lotId" TEXT,
    "serialNumber" TEXT,
    "type" TEXT NOT NULL DEFAULT 'ADJUSTMENT',
    "quantity" INTEGER NOT NULL,
    "beforeStock" INTEGER NOT NULL,
    "afterStock" INTEGER NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateType" TEXT NOT NULL DEFAULT 'invoice',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "showHeader" BOOLEAN NOT NULL DEFAULT true,
    "showFooter" BOOLEAN NOT NULL DEFAULT true,
    "showBarcode" BOOLEAN NOT NULL DEFAULT false,
    "showQR" BOOLEAN NOT NULL DEFAULT false,
    "showSignature" BOOLEAN NOT NULL DEFAULT false,
    "headerText" TEXT,
    "footerText" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "accentColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "fontSize" TEXT NOT NULL DEFAULT 'normal',
    "margin" TEXT NOT NULL DEFAULT 'normal',
    "advancedDesign" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "companyId" TEXT NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "terms" TEXT,
    "saleId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sidebarColor" TEXT NOT NULL DEFAULT 'slate',
    "sidebarStyle" TEXT NOT NULL DEFAULT 'gradient',
    "primaryColor" TEXT NOT NULL DEFAULT 'blue',
    "borderRadius" TEXT NOT NULL DEFAULT 'normal',
    "fontFamily" TEXT NOT NULL DEFAULT 'inter',
    "isDarkMode" BOOLEAN NOT NULL DEFAULT false,
    "layoutDensity" TEXT NOT NULL DEFAULT 'comfortable',
    "accentColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theme_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "defaultInvoiceTemplate" TEXT,
    "defaultThermalInvoiceTemplate" TEXT,
    "defaultQuotationTemplate" TEXT,
    "defaultPurchaseOrderTemplate" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "salesOrderPrefix" TEXT NOT NULL DEFAULT 'SORD',
    "proformaInvoicePrefix" TEXT NOT NULL DEFAULT 'PI',
    "quotationPrefix" TEXT NOT NULL DEFAULT 'QUOT',
    "purchaseOrderPrefix" TEXT NOT NULL DEFAULT 'PO',
    "invoiceSuffix" TEXT,
    "invoiceNumberLength" INTEGER NOT NULL DEFAULT 5,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "enableNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "enableBarcodeScanning" BOOLEAN NOT NULL DEFAULT true,
    "enableExpiryTracking" BOOLEAN NOT NULL DEFAULT true,
    "autoGenerateSKU" BOOLEAN NOT NULL DEFAULT true,
    "skuPrefix" TEXT NOT NULL DEFAULT 'CD',
    "defaultPaymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "defaultTaxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currencyPosition" TEXT NOT NULL DEFAULT 'left',
    "thousandSeparator" TEXT NOT NULL DEFAULT ',',
    "decimalSeparator" TEXT NOT NULL DEFAULT '.',
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "language" TEXT NOT NULL DEFAULT 'en',
    "rolePermissions" JSONB DEFAULT '{}',
    "taxComplianceMode" TEXT NOT NULL DEFAULT 'NONE',
    "fbrCredentials" JSONB DEFAULT '{}',
    "fbrPosId" TEXT,
    "zatcaSettings" JSONB DEFAULT '{}',
    "printerBridgeSettings" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zatca_egs_units" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'SIMULATION',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "invoiceType" TEXT NOT NULL DEFAULT '1100',
    "branchName" TEXT,
    "location" TEXT,
    "industry" TEXT,
    "commonName" TEXT,
    "serialNumber" TEXT,
    "privateKeyPem" TEXT,
    "csrPem" TEXT,
    "certificatePem" TEXT,
    "complianceCsid" TEXT,
    "complianceSecret" TEXT,
    "complianceRequestId" TEXT,
    "productionCsid" TEXT,
    "productionSecret" TEXT,
    "previousInvoiceHash" TEXT,
    "invoiceCounter" INTEGER NOT NULL DEFAULT 1,
    "lastResponseJson" JSONB,
    "lastError" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zatca_egs_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zatca_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'LOCAL',
    "sellerVatNumber" TEXT,
    "sellerName" TEXT,
    "branchName" TEXT,
    "address" TEXT,
    "crNumber" TEXT,
    "deviceName" TEXT,
    "otp" TEXT,
    "privateKeyPem" TEXT,
    "csrPem" TEXT,
    "certificatePem" TEXT,
    "complianceCsid" TEXT,
    "complianceSecret" TEXT,
    "complianceRequestId" TEXT,
    "productionCsid" TEXT,
    "productionSecret" TEXT,
    "previousInvoiceHash" TEXT,
    "invoiceCounter" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "lastTestAt" TIMESTAMP(3),
    "lastTestResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zatca_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zatca_invoice_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT,
    "mode" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "invoiceHash" TEXT NOT NULL,
    "previousInvoiceHash" TEXT,
    "qrPayload" TEXT,
    "xml" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zatca_invoice_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_number_sequences" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentKind" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "yearlyPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "userLimit" INTEGER NOT NULL DEFAULT 5,
    "storageLimitMB" INTEGER NOT NULL DEFAULT 500,
    "features" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_subscriptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "currencySymbol" TEXT NOT NULL DEFAULT 'Rs',
    "baseAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "baseCurrency" TEXT NOT NULL DEFAULT 'PKR',
    "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_submissions" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "transactionRef" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'easypaisa',
    "screenshotUrl" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "payment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "type" TEXT NOT NULL DEFAULT 'info',
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "notes" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "allocatedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "referenceId" TEXT,
    "referenceNumber" TEXT,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reminders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FOLLOW_UP',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "contactMethod" TEXT,
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "payment_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_login_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "deviceModel" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_login_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "codeHash" TEXT NOT NULL,
    "resetSessionTokenHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "reconciliations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "referenceId" TEXT,
    "referenceType" TEXT,
    "totalAllocated" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalMatched" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "difference" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reconciledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_allocations" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "paymentId" TEXT,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "ledgerEntryId" TEXT,
    "allocatedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "matchedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "difference" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "reconciliation_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_adjustments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OPENING_BALANCE',
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "direction" TEXT NOT NULL DEFAULT 'DEBIT',
    "reason" TEXT,
    "referenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "paidBy" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "receiptUrl" TEXT,
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reimbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_commitments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "commitmentDate" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "fulfilledAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fulfilledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_admins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "SystemAdminRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_admin_sessions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coa_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coa_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_masters" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "journalType" "JournalType" NOT NULL DEFAULT 'GENERAL',
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "isPosted" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entry_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "partnerId" TEXT,
    "description" TEXT,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "wageType" "WageType" NOT NULL DEFAULT 'MONTHLY',
    "wage" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "schedule" TEXT DEFAULT 'Monthly',
    "structure" TEXT DEFAULT 'Monthly Employee',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SalaryRuleCategory" NOT NULL DEFAULT 'ALLOWANCE',
    "sequence" INTEGER NOT NULL DEFAULT 10,
    "condition" TEXT DEFAULT 'True',
    "amountFixed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "basedOn" TEXT DEFAULT 'contract.wage',
    "accountId" TEXT,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "batchId" TEXT,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "grossPay" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "employerCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslip_lines" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "salaryRuleId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SalaryRuleCategory" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sequence" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "payslip_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_batches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "status" "PayslipBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_entries" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "workType" TEXT DEFAULT 'PRESENT',
    "hours" DOUBLE PRECISION DEFAULT 8,
    "dayRate" DECIMAL(65,30) DEFAULT 0,
    "leaveType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_adjustments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SalaryRuleCategory" NOT NULL DEFAULT 'ALLOWANCE',
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "payslipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "category" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_certifications" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "referenceUrl" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_slug_idx" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_isActive_idx" ON "companies"("isActive");

-- CreateIndex
CREATE INDEX "company_memberships_userId_idx" ON "company_memberships"("userId");

-- CreateIndex
CREATE INDEX "company_memberships_companyId_idx" ON "company_memberships"("companyId");

-- CreateIndex
CREATE INDEX "company_memberships_branchId_idx" ON "company_memberships"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "company_memberships_userId_companyId_key" ON "company_memberships"("userId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_records_userId_key" ON "employee_records"("userId");

-- CreateIndex
CREATE INDEX "employee_records_companyId_idx" ON "employee_records"("companyId");

-- CreateIndex
CREATE INDEX "employee_records_branchId_idx" ON "employee_records"("branchId");

-- CreateIndex
CREATE INDEX "employee_records_userId_idx" ON "employee_records"("userId");

-- CreateIndex
CREATE INDEX "employee_records_isActive_idx" ON "employee_records"("isActive");

-- CreateIndex
CREATE INDEX "branches_companyId_idx" ON "branches"("companyId");

-- CreateIndex
CREATE INDEX "branches_isActive_idx" ON "branches"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_companyId_key" ON "branches"("code", "companyId");

-- CreateIndex
CREATE INDEX "warehouses_companyId_idx" ON "warehouses"("companyId");

-- CreateIndex
CREATE INDEX "warehouses_branchId_idx" ON "warehouses"("branchId");

-- CreateIndex
CREATE INDEX "warehouses_assignedEmployeeId_idx" ON "warehouses"("assignedEmployeeId");

-- CreateIndex
CREATE INDEX "warehouses_isActive_idx" ON "warehouses"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_companyId_key" ON "warehouses"("code", "companyId");

-- CreateIndex
CREATE INDEX "warehouse_locations_companyId_idx" ON "warehouse_locations"("companyId");

-- CreateIndex
CREATE INDEX "warehouse_locations_warehouseId_idx" ON "warehouse_locations"("warehouseId");

-- CreateIndex
CREATE INDEX "warehouse_locations_parentId_idx" ON "warehouse_locations"("parentId");

-- CreateIndex
CREATE INDEX "warehouse_locations_type_idx" ON "warehouse_locations"("type");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_locations_code_companyId_key" ON "warehouse_locations"("code", "companyId");

-- CreateIndex
CREATE INDEX "stock_locations_companyId_idx" ON "stock_locations"("companyId");

-- CreateIndex
CREATE INDEX "stock_locations_branchId_idx" ON "stock_locations"("branchId");

-- CreateIndex
CREATE INDEX "stock_locations_assignedEmployeeId_idx" ON "stock_locations"("assignedEmployeeId");

-- CreateIndex
CREATE INDEX "stock_locations_isActive_idx" ON "stock_locations"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_code_companyId_key" ON "stock_locations"("code", "companyId");

-- CreateIndex
CREATE INDEX "stock_balances_companyId_idx" ON "stock_balances"("companyId");

-- CreateIndex
CREATE INDEX "stock_balances_productId_idx" ON "stock_balances"("productId");

-- CreateIndex
CREATE INDEX "stock_balances_locationId_idx" ON "stock_balances"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_productId_locationId_companyId_key" ON "stock_balances"("productId", "locationId", "companyId");

-- CreateIndex
CREATE INDEX "stock_ledgers_companyId_idx" ON "stock_ledgers"("companyId");

-- CreateIndex
CREATE INDEX "stock_ledgers_productId_idx" ON "stock_ledgers"("productId");

-- CreateIndex
CREATE INDEX "stock_ledgers_locationId_idx" ON "stock_ledgers"("locationId");

-- CreateIndex
CREATE INDEX "stock_ledgers_movementType_idx" ON "stock_ledgers"("movementType");

-- CreateIndex
CREATE INDEX "stock_ledgers_createdAt_idx" ON "stock_ledgers"("createdAt");

-- CreateIndex
CREATE INDEX "stock_ledgers_reference_idx" ON "stock_ledgers"("reference");

-- CreateIndex
CREATE INDEX "stock_ledgers_referenceId_idx" ON "stock_ledgers"("referenceId");

-- CreateIndex
CREATE INDEX "stock_transfers_companyId_idx" ON "stock_transfers"("companyId");

-- CreateIndex
CREATE INDEX "stock_transfers_sourceLocationId_idx" ON "stock_transfers"("sourceLocationId");

-- CreateIndex
CREATE INDEX "stock_transfers_destinationLocationId_idx" ON "stock_transfers"("destinationLocationId");

-- CreateIndex
CREATE INDEX "stock_transfers_status_idx" ON "stock_transfers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_referenceNumber_companyId_key" ON "stock_transfers"("referenceNumber", "companyId");

-- CreateIndex
CREATE INDEX "stock_transfer_items_transferId_idx" ON "stock_transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "stock_adjustments_companyId_idx" ON "stock_adjustments"("companyId");

-- CreateIndex
CREATE INDEX "stock_adjustments_locationId_idx" ON "stock_adjustments"("locationId");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_adjustmentId_idx" ON "stock_adjustment_items"("adjustmentId");

-- CreateIndex
CREATE INDEX "stock_counts_companyId_idx" ON "stock_counts"("companyId");

-- CreateIndex
CREATE INDEX "stock_counts_locationId_idx" ON "stock_counts"("locationId");

-- CreateIndex
CREATE INDEX "stock_counts_status_idx" ON "stock_counts"("status");

-- CreateIndex
CREATE INDEX "stock_count_items_countId_idx" ON "stock_count_items"("countId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_companyId_idx" ON "invitations"("companyId");

-- CreateIndex
CREATE INDEX "categories_companyId_idx" ON "categories"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_companyId_key" ON "categories"("name", "companyId");

-- CreateIndex
CREATE INDEX "units_companyId_idx" ON "units"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "units_name_companyId_key" ON "units"("name", "companyId");

-- CreateIndex
CREATE INDEX "products_companyId_idx" ON "products"("companyId");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "products"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_companyId_key" ON "products"("sku", "companyId");

-- CreateIndex
CREATE INDEX "product_stocks_companyId_idx" ON "product_stocks"("companyId");

-- CreateIndex
CREATE INDEX "product_stocks_warehouseId_idx" ON "product_stocks"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "product_stocks_productId_warehouseId_key" ON "product_stocks"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "product_lots_companyId_idx" ON "product_lots"("companyId");

-- CreateIndex
CREATE INDEX "product_lots_productId_idx" ON "product_lots"("productId");

-- CreateIndex
CREATE INDEX "product_lots_expiryDate_idx" ON "product_lots"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "product_lots_productId_lotNumber_companyId_key" ON "product_lots"("productId", "lotNumber", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "product_lots_productId_serialNumber_companyId_key" ON "product_lots"("productId", "serialNumber", "companyId");

-- CreateIndex
CREATE INDEX "product_lot_stocks_companyId_idx" ON "product_lot_stocks"("companyId");

-- CreateIndex
CREATE INDEX "product_lot_stocks_productId_idx" ON "product_lot_stocks"("productId");

-- CreateIndex
CREATE INDEX "product_lot_stocks_warehouseId_idx" ON "product_lot_stocks"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "product_lot_stocks_lotId_warehouseId_key" ON "product_lot_stocks"("lotId", "warehouseId");

-- CreateIndex
CREATE INDEX "customers_companyId_idx" ON "customers"("companyId");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "suppliers_companyId_idx" ON "suppliers"("companyId");

-- CreateIndex
CREATE INDEX "sales_companyId_idx" ON "sales"("companyId");

-- CreateIndex
CREATE INDEX "sales_branchId_idx" ON "sales"("branchId");

-- CreateIndex
CREATE INDEX "sales_warehouseId_idx" ON "sales"("warehouseId");

-- CreateIndex
CREATE INDEX "sales_customerId_idx" ON "sales"("customerId");

-- CreateIndex
CREATE INDEX "sales_createdAt_idx" ON "sales"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoiceNumber_companyId_key" ON "sales"("invoiceNumber", "companyId");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");

-- CreateIndex
CREATE INDEX "purchases_companyId_idx" ON "purchases"("companyId");

-- CreateIndex
CREATE INDEX "purchases_branchId_idx" ON "purchases"("branchId");

-- CreateIndex
CREATE INDEX "purchases_warehouseId_idx" ON "purchases"("warehouseId");

-- CreateIndex
CREATE INDEX "purchases_supplierId_idx" ON "purchases"("supplierId");

-- CreateIndex
CREATE INDEX "purchases_createdAt_idx" ON "purchases"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_referenceNumber_companyId_key" ON "purchases"("referenceNumber", "companyId");

-- CreateIndex
CREATE INDEX "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId");

-- CreateIndex
CREATE INDEX "purchase_items_productId_idx" ON "purchase_items"("productId");

-- CreateIndex
CREATE INDEX "inventory_logs_productId_idx" ON "inventory_logs"("productId");

-- CreateIndex
CREATE INDEX "inventory_logs_companyId_idx" ON "inventory_logs"("companyId");

-- CreateIndex
CREATE INDEX "inventory_logs_branchId_idx" ON "inventory_logs"("branchId");

-- CreateIndex
CREATE INDEX "inventory_logs_warehouseId_idx" ON "inventory_logs"("warehouseId");

-- CreateIndex
CREATE INDEX "inventory_logs_lotId_idx" ON "inventory_logs"("lotId");

-- CreateIndex
CREATE INDEX "inventory_logs_createdById_idx" ON "inventory_logs"("createdById");

-- CreateIndex
CREATE INDEX "inventory_logs_createdAt_idx" ON "inventory_logs"("createdAt");

-- CreateIndex
CREATE INDEX "invoice_templates_companyId_idx" ON "invoice_templates"("companyId");

-- CreateIndex
CREATE INDEX "quotations_companyId_idx" ON "quotations"("companyId");

-- CreateIndex
CREATE INDEX "quotations_customerId_idx" ON "quotations"("customerId");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_createdAt_idx" ON "quotations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quoteNumber_companyId_key" ON "quotations"("quoteNumber", "companyId");

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_items_productId_idx" ON "quotation_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "theme_settings_companyId_key" ON "theme_settings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_companyId_key" ON "company_settings"("companyId");

-- CreateIndex
CREATE INDEX "zatca_egs_units_companyId_idx" ON "zatca_egs_units"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "zatca_egs_units_companyId_environment_key" ON "zatca_egs_units"("companyId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "zatca_settings_companyId_key" ON "zatca_settings"("companyId");

-- CreateIndex
CREATE INDEX "zatca_invoice_logs_companyId_idx" ON "zatca_invoice_logs"("companyId");

-- CreateIndex
CREATE INDEX "zatca_invoice_logs_saleId_idx" ON "zatca_invoice_logs"("saleId");

-- CreateIndex
CREATE INDEX "zatca_invoice_logs_uuid_idx" ON "zatca_invoice_logs"("uuid");

-- CreateIndex
CREATE INDEX "document_number_sequences_companyId_idx" ON "document_number_sequences"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "document_number_sequences_companyId_documentKind_key" ON "document_number_sequences"("companyId", "documentKind");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_name_key" ON "subscription_plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subscriptions_companyId_key" ON "tenant_subscriptions"("companyId");

-- CreateIndex
CREATE INDEX "tenant_subscriptions_companyId_idx" ON "tenant_subscriptions"("companyId");

-- CreateIndex
CREATE INDEX "tenant_subscriptions_planId_idx" ON "tenant_subscriptions"("planId");

-- CreateIndex
CREATE INDEX "tenant_subscriptions_status_idx" ON "tenant_subscriptions"("status");

-- CreateIndex
CREATE INDEX "tenant_subscriptions_endDate_idx" ON "tenant_subscriptions"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_invoiceNumber_key" ON "billing_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "billing_invoices_companyId_idx" ON "billing_invoices"("companyId");

-- CreateIndex
CREATE INDEX "billing_invoices_status_idx" ON "billing_invoices"("status");

-- CreateIndex
CREATE INDEX "billing_invoices_dueDate_idx" ON "billing_invoices"("dueDate");

-- CreateIndex
CREATE INDEX "billing_invoices_invoiceNumber_idx" ON "billing_invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payment_submissions_invoiceId_key" ON "payment_submissions"("invoiceId");

-- CreateIndex
CREATE INDEX "payment_submissions_invoiceId_idx" ON "payment_submissions"("invoiceId");

-- CreateIndex
CREATE INDEX "payment_submissions_companyId_idx" ON "payment_submissions"("companyId");

-- CreateIndex
CREATE INDEX "payment_submissions_submittedAt_idx" ON "payment_submissions"("submittedAt");

-- CreateIndex
CREATE INDEX "system_notifications_isRead_idx" ON "system_notifications"("isRead");

-- CreateIndex
CREATE INDEX "system_notifications_createdAt_idx" ON "system_notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_key_idx" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_audit_logs_createdAt_idx" ON "system_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "system_audit_logs_action_idx" ON "system_audit_logs"("action");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_companyId_idx" ON "notifications"("companyId");

-- CreateIndex
CREATE INDEX "push_subscriptions_companyId_idx" ON "push_subscriptions"("companyId");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_companyId_key" ON "push_subscriptions"("endpoint", "companyId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "payments_companyId_idx" ON "payments"("companyId");

-- CreateIndex
CREATE INDEX "payments_customerId_idx" ON "payments"("customerId");

-- CreateIndex
CREATE INDEX "payments_supplierId_idx" ON "payments"("supplierId");

-- CreateIndex
CREATE INDEX "payments_paymentDate_idx" ON "payments"("paymentDate");

-- CreateIndex
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocations_saleId_idx" ON "payment_allocations"("saleId");

-- CreateIndex
CREATE INDEX "payment_allocations_purchaseId_idx" ON "payment_allocations"("purchaseId");

-- CreateIndex
CREATE INDEX "ledger_entries_companyId_idx" ON "ledger_entries"("companyId");

-- CreateIndex
CREATE INDEX "ledger_entries_customerId_idx" ON "ledger_entries"("customerId");

-- CreateIndex
CREATE INDEX "ledger_entries_supplierId_idx" ON "ledger_entries"("supplierId");

-- CreateIndex
CREATE INDEX "ledger_entries_entryDate_idx" ON "ledger_entries"("entryDate");

-- CreateIndex
CREATE INDEX "payment_reminders_companyId_idx" ON "payment_reminders"("companyId");

-- CreateIndex
CREATE INDEX "payment_reminders_customerId_idx" ON "payment_reminders"("customerId");

-- CreateIndex
CREATE INDEX "payment_reminders_supplierId_idx" ON "payment_reminders"("supplierId");

-- CreateIndex
CREATE INDEX "payment_reminders_status_idx" ON "payment_reminders"("status");

-- CreateIndex
CREATE INDEX "payment_reminders_createdAt_idx" ON "payment_reminders"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "active_login_sessions_userId_idx" ON "active_login_sessions"("userId");

-- CreateIndex
CREATE INDEX "active_login_sessions_expiresAt_idx" ON "active_login_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_codes_resetSessionTokenHash_key" ON "password_reset_codes"("resetSessionTokenHash");

-- CreateIndex
CREATE INDEX "password_reset_codes_email_idx" ON "password_reset_codes"("email");

-- CreateIndex
CREATE INDEX "password_reset_codes_userId_idx" ON "password_reset_codes"("userId");

-- CreateIndex
CREATE INDEX "password_reset_codes_expiresAt_idx" ON "password_reset_codes"("expiresAt");

-- CreateIndex
CREATE INDEX "password_reset_codes_createdAt_idx" ON "password_reset_codes"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "reconciliations_companyId_idx" ON "reconciliations"("companyId");

-- CreateIndex
CREATE INDEX "reconciliations_status_idx" ON "reconciliations"("status");

-- CreateIndex
CREATE INDEX "reconciliations_createdAt_idx" ON "reconciliations"("createdAt");

-- CreateIndex
CREATE INDEX "reconciliation_allocations_reconciliationId_idx" ON "reconciliation_allocations"("reconciliationId");

-- CreateIndex
CREATE INDEX "reconciliation_allocations_paymentId_idx" ON "reconciliation_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "balance_adjustments_companyId_idx" ON "balance_adjustments"("companyId");

-- CreateIndex
CREATE INDEX "balance_adjustments_customerId_idx" ON "balance_adjustments"("customerId");

-- CreateIndex
CREATE INDEX "balance_adjustments_supplierId_idx" ON "balance_adjustments"("supplierId");

-- CreateIndex
CREATE INDEX "balance_adjustments_type_idx" ON "balance_adjustments"("type");

-- CreateIndex
CREATE INDEX "expenses_companyId_idx" ON "expenses"("companyId");

-- CreateIndex
CREATE INDEX "expenses_employeeId_idx" ON "expenses"("employeeId");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_expenseDate_idx" ON "expenses"("expenseDate");

-- CreateIndex
CREATE INDEX "payment_commitments_companyId_idx" ON "payment_commitments"("companyId");

-- CreateIndex
CREATE INDEX "payment_commitments_customerId_idx" ON "payment_commitments"("customerId");

-- CreateIndex
CREATE INDEX "payment_commitments_supplierId_idx" ON "payment_commitments"("supplierId");

-- CreateIndex
CREATE INDEX "payment_commitments_status_idx" ON "payment_commitments"("status");

-- CreateIndex
CREATE INDEX "payment_commitments_commitmentDate_idx" ON "payment_commitments"("commitmentDate");

-- CreateIndex
CREATE UNIQUE INDEX "system_admins_email_key" ON "system_admins"("email");

-- CreateIndex
CREATE INDEX "system_admins_email_idx" ON "system_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "system_admin_sessions_token_key" ON "system_admin_sessions"("token");

-- CreateIndex
CREATE INDEX "system_admin_sessions_token_idx" ON "system_admin_sessions"("token");

-- CreateIndex
CREATE INDEX "system_admin_sessions_adminId_idx" ON "system_admin_sessions"("adminId");

-- CreateIndex
CREATE INDEX "system_admin_sessions_expiresAt_idx" ON "system_admin_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "system_admin_audit_logs_adminId_idx" ON "system_admin_audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "system_admin_audit_logs_createdAt_idx" ON "system_admin_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "system_admin_audit_logs_action_idx" ON "system_admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "coa_accounts_companyId_idx" ON "coa_accounts"("companyId");

-- CreateIndex
CREATE INDEX "coa_accounts_parentId_idx" ON "coa_accounts"("parentId");

-- CreateIndex
CREATE INDEX "coa_accounts_type_idx" ON "coa_accounts"("type");

-- CreateIndex
CREATE UNIQUE INDEX "coa_accounts_code_companyId_key" ON "coa_accounts"("code", "companyId");

-- CreateIndex
CREATE INDEX "journal_entry_masters_companyId_idx" ON "journal_entry_masters"("companyId");

-- CreateIndex
CREATE INDEX "journal_entry_masters_date_idx" ON "journal_entry_masters"("date");

-- CreateIndex
CREATE INDEX "journal_entry_masters_journalType_idx" ON "journal_entry_masters"("journalType");

-- CreateIndex
CREATE INDEX "journal_entry_masters_isPosted_idx" ON "journal_entry_masters"("isPosted");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_masters_number_companyId_key" ON "journal_entry_masters"("number", "companyId");

-- CreateIndex
CREATE INDEX "journal_entry_lines_journalEntryId_idx" ON "journal_entry_lines"("journalEntryId");

-- CreateIndex
CREATE INDEX "journal_entry_lines_accountId_idx" ON "journal_entry_lines"("accountId");

-- CreateIndex
CREATE INDEX "journal_entry_lines_partnerId_idx" ON "journal_entry_lines"("partnerId");

-- CreateIndex
CREATE INDEX "contracts_employeeId_idx" ON "contracts"("employeeId");

-- CreateIndex
CREATE INDEX "contracts_companyId_idx" ON "contracts"("companyId");

-- CreateIndex
CREATE INDEX "contracts_isActive_idx" ON "contracts"("isActive");

-- CreateIndex
CREATE INDEX "salary_rules_companyId_idx" ON "salary_rules"("companyId");

-- CreateIndex
CREATE INDEX "salary_rules_category_idx" ON "salary_rules"("category");

-- CreateIndex
CREATE UNIQUE INDEX "salary_rules_code_companyId_key" ON "salary_rules"("code", "companyId");

-- CreateIndex
CREATE INDEX "payslips_employeeId_idx" ON "payslips"("employeeId");

-- CreateIndex
CREATE INDEX "payslips_contractId_idx" ON "payslips"("contractId");

-- CreateIndex
CREATE INDEX "payslips_batchId_idx" ON "payslips"("batchId");

-- CreateIndex
CREATE INDEX "payslips_companyId_idx" ON "payslips"("companyId");

-- CreateIndex
CREATE INDEX "payslips_dateFrom_dateTo_idx" ON "payslips"("dateFrom", "dateTo");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_number_companyId_key" ON "payslips"("number", "companyId");

-- CreateIndex
CREATE INDEX "payslip_lines_payslipId_idx" ON "payslip_lines"("payslipId");

-- CreateIndex
CREATE INDEX "payroll_batches_companyId_idx" ON "payroll_batches"("companyId");

-- CreateIndex
CREATE INDEX "payroll_batches_status_idx" ON "payroll_batches"("status");

-- CreateIndex
CREATE INDEX "work_entries_companyId_idx" ON "work_entries"("companyId");

-- CreateIndex
CREATE INDEX "work_entries_date_idx" ON "work_entries"("date");

-- CreateIndex
CREATE UNIQUE INDEX "work_entries_employeeId_date_key" ON "work_entries"("employeeId", "date");

-- CreateIndex
CREATE INDEX "salary_adjustments_employeeId_idx" ON "salary_adjustments"("employeeId");

-- CreateIndex
CREATE INDEX "salary_adjustments_companyId_idx" ON "salary_adjustments"("companyId");

-- CreateIndex
CREATE INDEX "salary_adjustments_date_idx" ON "salary_adjustments"("date");

-- CreateIndex
CREATE INDEX "employee_equipment_companyId_idx" ON "employee_equipment"("companyId");

-- CreateIndex
CREATE INDEX "employee_equipment_assignedToId_idx" ON "employee_equipment"("assignedToId");

-- CreateIndex
CREATE INDEX "employee_equipment_status_idx" ON "employee_equipment"("status");

-- CreateIndex
CREATE INDEX "employee_certifications_employeeId_idx" ON "employee_certifications"("employeeId");

-- CreateIndex
CREATE INDEX "employee_certifications_companyId_idx" ON "employee_certifications"("companyId");

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_records" ADD CONSTRAINT "employee_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_records" ADD CONSTRAINT "employee_records_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_records" ADD CONSTRAINT "employee_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "stock_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledgers" ADD CONSTRAINT "stock_ledgers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledgers" ADD CONSTRAINT "stock_ledgers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "stock_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledgers" ADD CONSTRAINT "stock_ledgers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledgers" ADD CONSTRAINT "stock_ledgers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_countId_fkey" FOREIGN KEY ("countId") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lots" ADD CONSTRAINT "product_lots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lots" ADD CONSTRAINT "product_lots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lot_stocks" ADD CONSTRAINT "product_lot_stocks_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "product_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lot_stocks" ADD CONSTRAINT "product_lot_stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lot_stocks" ADD CONSTRAINT "product_lot_stocks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lot_stocks" ADD CONSTRAINT "product_lot_stocks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "product_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_settings" ADD CONSTRAINT "theme_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zatca_egs_units" ADD CONSTRAINT "zatca_egs_units_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zatca_settings" ADD CONSTRAINT "zatca_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zatca_invoice_logs" ADD CONSTRAINT "zatca_invoice_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zatca_invoice_logs" ADD CONSTRAINT "zatca_invoice_logs_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_number_sequences" ADD CONSTRAINT "document_number_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "tenant_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "system_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "billing_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "system_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_login_sessions" ADD CONSTRAINT "active_login_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_allocations" ADD CONSTRAINT "reconciliation_allocations_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_allocations" ADD CONSTRAINT "reconciliation_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_allocations" ADD CONSTRAINT "reconciliation_allocations_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_allocations" ADD CONSTRAINT "reconciliation_allocations_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_allocations" ADD CONSTRAINT "reconciliation_allocations_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_commitments" ADD CONSTRAINT "payment_commitments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_commitments" ADD CONSTRAINT "payment_commitments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_commitments" ADD CONSTRAINT "payment_commitments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_commitments" ADD CONSTRAINT "payment_commitments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_admin_sessions" ADD CONSTRAINT "system_admin_sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "system_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_admin_audit_logs" ADD CONSTRAINT "system_admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "system_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coa_accounts" ADD CONSTRAINT "coa_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coa_accounts" ADD CONSTRAINT "coa_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "coa_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_masters" ADD CONSTRAINT "journal_entry_masters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_masters" ADD CONSTRAINT "journal_entry_masters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entry_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "coa_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_rules" ADD CONSTRAINT "salary_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_rules" ADD CONSTRAINT "salary_rules_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "coa_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payroll_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_salaryRuleId_fkey" FOREIGN KEY ("salaryRuleId") REFERENCES "salary_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_batches" ADD CONSTRAINT "payroll_batches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_batches" ADD CONSTRAINT "payroll_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_adjustments" ADD CONSTRAINT "salary_adjustments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_adjustments" ADD CONSTRAINT "salary_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_adjustments" ADD CONSTRAINT "salary_adjustments_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_equipment" ADD CONSTRAINT "employee_equipment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_equipment" ADD CONSTRAINT "employee_equipment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

