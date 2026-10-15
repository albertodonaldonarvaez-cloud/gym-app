CREATE TABLE IF NOT EXISTS "body_scans" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "body_scans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "body_scans_user_id_created_at_idx" ON "body_scans"("user_id", "created_at");
ALTER TABLE "body_scans" DROP CONSTRAINT IF EXISTS "body_scans_user_id_fkey";
ALTER TABLE "body_scans" ADD CONSTRAINT "body_scans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
