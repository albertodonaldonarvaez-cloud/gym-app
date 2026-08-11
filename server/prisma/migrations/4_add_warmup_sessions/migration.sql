-- Migration 4: Add warmup_sessions table

CREATE TABLE IF NOT EXISTS "warmup_sessions" (
    "id"          TEXT NOT NULL,
    "athlete_id"  TEXT NOT NULL,
    "started_at"  TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "duration_sec" INTEGER NOT NULL DEFAULT 0,
    "notes"        TEXT NOT NULL DEFAULT '',
    "is_synced"    BOOLEAN NOT NULL DEFAULT false,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "warmup_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "warmup_sessions_athlete_id_fkey"
        FOREIGN KEY ("athlete_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "warmup_sessions_athlete_started_idx"
    ON "warmup_sessions"("athlete_id", "started_at");
