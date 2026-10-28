-- Lookup invoice lines without scanning every line for each bounded page.
CREATE INDEX IF NOT EXISTS "PurchaseLine_invoiceId_idx" ON "PurchaseLine"("invoiceId");
CREATE INDEX IF NOT EXISTS "SaleLine_invoiceId_idx" ON "SaleLine"("invoiceId");
CREATE INDEX IF NOT EXISTS "SaleInvoice_status_invoiceDate_id_idx" ON "SaleInvoice"("status", "invoiceDate", "id");
