CREATE TABLE "DataRevision" (
 "id" INTEGER PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
 "generation" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
 "revision" BIGINT NOT NULL DEFAULT 0,
 "transactionId" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "DataRevision" ("id") VALUES (1);
CREATE TABLE "OperationReceipt" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "hash" TEXT NOT NULL,
 "status" INTEGER NOT NULL, "data" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OperationReceipt_userId_createdAt_idx" ON "OperationReceipt"("userId", "createdAt");
-- Preserve already issued operation keys during the upgrade.
INSERT INTO "OperationReceipt" ("id", "userId", "hash", "status", "data", "createdAt")
SELECT DISTINCT ON ("entityCode") "entityCode", "userId", "afterJson"->>'hash',
 ("afterJson"->>'status')::integer, "afterJson"->'data', "createdAt"
FROM "AuditLog" WHERE "entityType" = 'RequestReceipt' AND "userId" IS NOT NULL
 AND "entityCode" IS NOT NULL AND "afterJson" ? 'hash' AND "afterJson" ? 'status'
ORDER BY "entityCode", "createdAt" DESC;
CREATE FUNCTION oud_increment_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW."version" := OLD."version" + 1; RETURN NEW; END $$;
ALTER TABLE "User" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER oud_version BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION oud_increment_version();
ALTER TABLE "SystemSetting" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER oud_version BEFORE UPDATE ON "SystemSetting" FOR EACH ROW EXECUTE FUNCTION oud_increment_version();
ALTER TABLE "ItemCategory" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER oud_version BEFORE UPDATE ON "ItemCategory" FOR EACH ROW EXECUTE FUNCTION oud_increment_version();
ALTER TABLE "UnitOption" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER oud_version BEFORE UPDATE ON "UnitOption" FOR EACH ROW EXECUTE FUNCTION oud_increment_version();
ALTER TABLE "Item" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER oud_version BEFORE UPDATE ON "Item" FOR EACH ROW EXECUTE FUNCTION oud_increment_version();
ALTER TABLE "Party" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER oud_version BEFORE UPDATE ON "Party" FOR EACH ROW EXECUTE FUNCTION oud_increment_version();
ALTER TABLE "FixedAsset" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER oud_version BEFORE UPDATE ON "FixedAsset" FOR EACH ROW EXECUTE FUNCTION oud_increment_version();
ALTER TABLE "GiftPolicy" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER oud_version BEFORE UPDATE ON "GiftPolicy" FOR EACH ROW EXECUTE FUNCTION oud_increment_version();
CREATE FUNCTION oud_bump_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "DataRevision" SET "revision" = "revision" + 1, "transactionId" = txid_current()::text
 WHERE "id" = 1 AND "transactionId" <> txid_current()::text;
 RETURN NULL;
END $$;
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "User" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "SystemSetting" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "ItemCategory" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "UnitOption" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "Item" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "Party" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "FixedAsset" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "GiftPolicy" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "PurchaseInvoice" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "PurchaseLine" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "SaleInvoice" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "SaleLine" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "CashTransaction" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "ReturnLine" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "StockIssue" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "ProductionBatch" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "BatchMaterial" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
CREATE TRIGGER oud_revision AFTER INSERT OR UPDATE OR DELETE ON "DriverReferral" FOR EACH STATEMENT EXECUTE FUNCTION oud_bump_revision();
ALTER TABLE "DataRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperationReceipt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "DataRevision", "OperationReceipt" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
 EXECUTE format('REVOKE ALL ON "DataRevision", "OperationReceipt" FROM %I', r);
 END IF; END LOOP;
END $$;
