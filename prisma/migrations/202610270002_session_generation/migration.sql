-- UUID generations prevent repeat/older restores from reviving any signed session.
ALTER TABLE "User" ADD COLUMN "sessionGeneration" TEXT NOT NULL DEFAULT (gen_random_uuid())::text;
