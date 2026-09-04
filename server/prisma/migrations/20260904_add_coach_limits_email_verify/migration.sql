-- Add coach client limits and email verification fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "max_clients" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verify_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verify_expires" TIMESTAMP(3);

-- Set existing users as verified (they were created before verification existed)
UPDATE "users" SET "email_verified" = true WHERE "email_verified" = false;
