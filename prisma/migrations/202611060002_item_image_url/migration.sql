-- Add imageUrl to Item
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
