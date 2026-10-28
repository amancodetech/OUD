-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CashTransaction" ADD COLUMN     "sourceReturnId" TEXT;

-- CreateTable
CREATE TABLE "DocumentCounter" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "LoginAttempt_expiresAt_idx" ON "LoginAttempt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashTransaction_sourceReturnId_key" ON "CashTransaction"("sourceReturnId");

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_sourceReturnId_fkey" FOREIGN KEY ("sourceReturnId") REFERENCES "ReturnLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

