-- Migration: Add routine_templates table for coach reusable routine templates
CREATE TABLE "routine_templates" (
    "id"          TEXT NOT NULL,
    "coach_id"    TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Plantilla de rutina',
    "schedule"    JSONB NOT NULL DEFAULT '{}',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "routine_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "routine_templates_coach_id_fkey"
        FOREIGN KEY ("coach_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "routine_templates_coach_id_idx" ON "routine_templates"("coach_id");
