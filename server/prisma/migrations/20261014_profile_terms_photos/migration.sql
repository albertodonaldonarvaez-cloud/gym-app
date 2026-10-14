ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "looking_for" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_version" TEXT;

CREATE TABLE IF NOT EXISTS "body_photos" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "body_photos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "body_photos_user_id_idx" ON "body_photos"("user_id");
ALTER TABLE "body_photos" DROP CONSTRAINT IF EXISTS "body_photos_user_id_fkey";
ALTER TABLE "body_photos" ADD CONSTRAINT "body_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
