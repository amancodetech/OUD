-- Run once as the migration administrator. Never as the application.
-- No password is embedded. Set a fresh password separately using your secret manager.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oud_runtime') THEN
  CREATE ROLE oud_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO oud_runtime;
DO $$ DECLARE table_name text; api_role text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['User', 'AuditLog', 'SystemSetting', 'ItemCategory', 'UnitOption', 'Item', 'Party', 'FixedAsset', 'GiftPolicy', 'PurchaseInvoice', 'PurchaseLine', 'SaleInvoice', 'SaleLine', 'CashTransaction', 'ReturnLine', 'StockIssue', 'ProductionBatch', 'BatchMaterial', 'DriverReferral', 'DocumentCounter', 'LoginAttempt', 'DataRevision', 'OperationReceipt', 'BackgroundJob'] LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO oud_runtime', table_name);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('DROP POLICY IF EXISTS oud_server_access ON public.%I', table_name);
  EXECUTE format('CREATE POLICY oud_server_access ON public.%I TO oud_runtime USING (true) WITH CHECK (true)', table_name);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, api_role);
   END IF;
  END LOOP;
 END LOOP;
END $$;
-- IDs are generated in Prisma; no sequence grants or DDL grants are needed.
-- Enable LOGIN and set the runtime password privately after reviewing this file.
-- Hyperdrive uses oud_runtime; prisma migrate deploy uses the separate owner role.
