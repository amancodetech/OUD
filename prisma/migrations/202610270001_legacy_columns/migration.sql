-- Compatibility upgrade from the committed pre-migration schema.
-- The historical baseline is immutable: some installations already applied it.
-- Existing localized/opening values on newer installations must be preserved.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "nameId" TEXT,
                   ADD COLUMN IF NOT EXISTS "nameEn" TEXT;
ALTER TABLE "Party" ADD COLUMN IF NOT EXISTS "nameId" TEXT,
                    ADD COLUMN IF NOT EXISTS "nameEn" TEXT,
                    ADD COLUMN IF NOT EXISTS "supplierCategoryEn" TEXT,
                    ADD COLUMN IF NOT EXISTS "openingInvoice" DECIMAL(18,4) NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "openingPaid" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "FixedAsset" ADD COLUMN IF NOT EXISTS "nameId" TEXT,
                         ADD COLUMN IF NOT EXISTS "nameEn" TEXT;
