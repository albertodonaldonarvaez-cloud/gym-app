-- Add invite flow fields to User
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_expires" TIMESTAMP(3);

-- Make password_hash nullable (for pending invite users)
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- Make name have a default (for pending invite users)
ALTER TABLE "users" ALTER COLUMN "name" SET DEFAULT '';
