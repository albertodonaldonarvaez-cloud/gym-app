-- AlterTable: add instructions_es column to exercises
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "instructions_es" TEXT;
