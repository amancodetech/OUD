CREATE TABLE "BackgroundJob" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL,
 "sessionGeneration" TEXT NOT NULL, "sessionVersion" INTEGER NOT NULL,
 "kind" TEXT NOT NULL, "hash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED',
 "inputKey" TEXT, "resultKey" TEXT, "metadata" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3)
);
CREATE INDEX "BackgroundJob_userId_createdAt_idx" ON "BackgroundJob"("userId", "createdAt");
ALTER TABLE "BackgroundJob" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "BackgroundJob" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
 EXECUTE format('REVOKE ALL ON "BackgroundJob" FROM %I', r);
 END IF; END LOOP;
END $$;
