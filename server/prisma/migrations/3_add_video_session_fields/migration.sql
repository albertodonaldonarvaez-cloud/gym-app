-- Migration 3: Add videoUrl, isCustom, coachId to exercises + session tracking to workout/set logs

-- Exercise: custom exercises with video
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "video_url" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "is_custom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "coach_id" TEXT;

-- WorkoutLog: session tracking
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "session_id" TEXT;
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "day_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "finished_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "workout_logs_session_id_idx" ON "workout_logs"("session_id");

-- SetLog: set-level timestamps
ALTER TABLE "set_logs" ADD COLUMN IF NOT EXISTS "session_id" TEXT;
ALTER TABLE "set_logs" ADD COLUMN IF NOT EXISTS "day_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "set_logs" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);
ALTER TABLE "set_logs" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "set_logs_session_id_idx" ON "set_logs"("session_id");
