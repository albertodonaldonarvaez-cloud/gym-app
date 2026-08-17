-- AlterTable: add exercise_name and rest_seconds to set_logs
ALTER TABLE "set_logs" ADD COLUMN IF NOT EXISTS "exercise_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "set_logs" ADD COLUMN IF NOT EXISTS "rest_seconds" INTEGER;
