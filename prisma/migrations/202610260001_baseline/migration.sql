-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACCOUNTANT', 'CASHIER');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CLIENT', 'SUPPLIER', 'DRIVER', 'PARTNER', 'FUNDER');

-- CreateEnum
CREATE TYPE "ItemRole" AS ENUM ('MERCHANDISE', 'RAW', 'FINISHED');

-- CreateEnum
CREATE TYPE "SaleLineType" AS ENUM ('SALE', 'DRIVER_GIFT');

-- CreateEnum
CREATE TYPE "CashAccountType" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "CashTransactionType" AS ENUM ('CUSTOMER_COLLECTION', 'CUSTOMER_REFUND', 'SUPPLIER_PAYMENT', 'SUPPLIER_REFUND', 'CASH_EXPENSE', 'DRIVER_AMOUNT', 'DRIVER_CASH_GIFT', 'EXTERNAL_SALES_PROFIT', 'ASSET_PURCHASE', 'PARTNER_CONTRIBUTION', 'PARTNER_DRAWING', 'PROFIT_DISTRIBUTION', 'LOAN_RECEIVED', 'LOAN_REPAYMENT', 'OWNER_BROTHER_FINANCING', 'OWNER_BROTHER_REPAYMENT', 'INTERNAL_TRANSFER');

-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('SALE_RETURN', 'PURCHASE_RETURN');

-- CreateEnum
CREATE TYPE "SaleReturnCondition" AS ENUM ('GOOD', 'DAMAGED');

-- CreateEnum
CREATE TYPE "StockIssueType" AS ENUM ('TESTER', 'SAMPLE', 'DAMAGED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CASHIER',
    "permissions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityCode" TEXT NOT NULL,
    "reason" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "storeName" TEXT NOT NULL DEFAULT 'محل العود والعطور',
    "currencyLabel" TEXT NOT NULL DEFAULT 'روبية (IDR)',
    "currencyCode" TEXT NOT NULL DEFAULT 'IDR',
    "startYear" INTEGER NOT NULL DEFAULT 2026,
    "openingCash" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "openingBank" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "openingReviewed" BOOLEAN NOT NULL DEFAULT false,
    "approveOpeningAssets" BOOLEAN NOT NULL DEFAULT false,
    "openingLoans" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "openingRetainedEarnings" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "lockedThroughDate" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UnitOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameId" TEXT,
    "nameEn" TEXT,
    "categoryId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "role" "ItemRole" NOT NULL DEFAULT 'MERCHANDISE',
    "reorderLevel" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "openingQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "openingValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "customCode" TEXT,
    "defaultSalePrice" DECIMAL(18,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameId" TEXT,
    "nameEn" TEXT,
    "type" "PartyType" NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "address" TEXT,
    "supplierCategory" TEXT,
    "supplierCategoryEn" TEXT,
    "carNumber" TEXT,
    "openingInvoice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "openingPaid" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "profitShareRatio" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "openingCapital" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "carryoverReferrals" INTEGER NOT NULL DEFAULT 0,
    "isDriverGiftEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameId" TEXT,
    "nameEn" TEXT,
    "acquiredDate" DATE,
    "submittedValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftPolicy" (
    "id" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "customersPerGift" INTEGER NOT NULL,
    "giftValue" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "invoiceYear" INTEGER NOT NULL,
    "invoiceKey" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE,
    "supplierId" TEXT NOT NULL,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "landedCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lineTotalCost" DECIMAL(18,4) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'POSTED',

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "invoiceYear" INTEGER NOT NULL,
    "invoiceKey" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE,
    "customerId" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineType" "SaleLineType" NOT NULL DEFAULT 'SALE',
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "netSaleAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "driverId" TEXT,
    "driverGiftSettlementValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'POSTED',

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "txDate" DATE NOT NULL,
    "type" "CashTransactionType" NOT NULL,
    "account" "CashAccountType" NOT NULL,
    "transferToAccount" "CashAccountType",
    "amount" DECIMAL(18,4) NOT NULL,
    "partyId" TEXT,
    "invoiceKey" TEXT,
    "assetId" TEXT,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnLine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "returnDocNo" TEXT NOT NULL,
    "returnDate" DATE NOT NULL,
    "type" "ReturnType" NOT NULL,
    "partyId" TEXT NOT NULL,
    "invoiceKey" TEXT NOT NULL,
    "sourceSaleLineId" TEXT,
    "sourcePurchaseLineId" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "saleReturnCondition" "SaleReturnCondition",
    "supplierCreditNote" DECIMAL(18,4),
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockIssue" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "type" "StockIssueType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "testerRef" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "completionDate" DATE NOT NULL,
    "finishedItemId" TEXT NOT NULL,
    "producedQty" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchMaterial" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rawItemId" TEXT NOT NULL,
    "consumedQty" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "BatchMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverReferral" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "visitDate" DATE NOT NULL,
    "visitorUniqueKey" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'POSTED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityCode_idx" ON "AuditLog"("entityType", "entityCode");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_name_key" ON "ItemCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOption_name_key" ON "UnitOption"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_name_key" ON "Item"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Party_code_key" ON "Party"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Party_name_type_key" ON "Party"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_code_key" ON "FixedAsset"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GiftPolicy_effectiveDate_key" ON "GiftPolicy"("effectiveDate");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_invoiceDate_idx" ON "PurchaseInvoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_invoiceKey_idx" ON "PurchaseInvoice"("invoiceKey");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_supplierId_invoiceKey_key" ON "PurchaseInvoice"("supplierId", "invoiceKey");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLine_code_key" ON "PurchaseLine"("code");

-- CreateIndex
CREATE INDEX "PurchaseLine_itemId_idx" ON "PurchaseLine"("itemId");

-- CreateIndex
CREATE INDEX "SaleInvoice_customerId_invoiceKey_idx" ON "SaleInvoice"("customerId", "invoiceKey");

-- CreateIndex
CREATE INDEX "SaleInvoice_invoiceDate_idx" ON "SaleInvoice"("invoiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "SaleLine_code_key" ON "SaleLine"("code");

-- CreateIndex
CREATE INDEX "SaleLine_itemId_idx" ON "SaleLine"("itemId");

-- CreateIndex
CREATE INDEX "SaleLine_driverId_idx" ON "SaleLine"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "CashTransaction_code_key" ON "CashTransaction"("code");

-- CreateIndex
CREATE INDEX "CashTransaction_txDate_idx" ON "CashTransaction"("txDate");

-- CreateIndex
CREATE INDEX "CashTransaction_partyId_invoiceKey_idx" ON "CashTransaction"("partyId", "invoiceKey");

-- CreateIndex
CREATE INDEX "CashTransaction_type_idx" ON "CashTransaction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnLine_code_key" ON "ReturnLine"("code");

-- CreateIndex
CREATE INDEX "ReturnLine_returnDate_idx" ON "ReturnLine"("returnDate");

-- CreateIndex
CREATE INDEX "ReturnLine_partyId_invoiceKey_idx" ON "ReturnLine"("partyId", "invoiceKey");

-- CreateIndex
CREATE UNIQUE INDEX "StockIssue_code_key" ON "StockIssue"("code");

-- CreateIndex
CREATE INDEX "StockIssue_issueDate_idx" ON "StockIssue"("issueDate");

-- CreateIndex
CREATE INDEX "StockIssue_itemId_idx" ON "StockIssue"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatch_code_key" ON "ProductionBatch"("code");

-- CreateIndex
CREATE INDEX "ProductionBatch_completionDate_idx" ON "ProductionBatch"("completionDate");

-- CreateIndex
CREATE INDEX "BatchMaterial_batchId_idx" ON "BatchMaterial"("batchId");

-- CreateIndex
CREATE INDEX "BatchMaterial_rawItemId_idx" ON "BatchMaterial"("rawItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverReferral_code_key" ON "DriverReferral"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DriverReferral_visitorUniqueKey_key" ON "DriverReferral"("visitorUniqueKey");

-- CreateIndex
CREATE INDEX "DriverReferral_driverId_visitDate_code_idx" ON "DriverReferral"("driverId", "visitDate", "code");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleInvoice" ADD CONSTRAINT "SaleInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SaleInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_sourceSaleLineId_fkey" FOREIGN KEY ("sourceSaleLineId") REFERENCES "SaleLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_sourcePurchaseLineId_fkey" FOREIGN KEY ("sourcePurchaseLineId") REFERENCES "PurchaseLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_finishedItemId_fkey" FOREIGN KEY ("finishedItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMaterial" ADD CONSTRAINT "BatchMaterial_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMaterial" ADD CONSTRAINT "BatchMaterial_rawItemId_fkey" FOREIGN KEY ("rawItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverReferral" ADD CONSTRAINT "DriverReferral_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Singleton configuration is initialized without touching existing installations.
INSERT INTO "SystemSetting" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);
