-- CreateEnum
CREATE TYPE "Role" AS ENUM ('COACH', 'CLIENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "coach_id" TEXT,
    "avatar" TEXT NOT NULL DEFAULT '',
    "goal" TEXT NOT NULL DEFAULT 'Acondicionamiento Físico',
    "weight_kg" DOUBLE PRECISION NOT NULL DEFAULT 70.0,
    "height_cm" INTEGER NOT NULL DEFAULT 170,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscle_group" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "equipment" TEXT NOT NULL DEFAULT 'Libre',
    "instructions" TEXT NOT NULL DEFAULT '',
    "default_sets" INTEGER NOT NULL DEFAULT 4,
    "default_reps" INTEGER NOT NULL DEFAULT 12,
    "media_filename" TEXT,
    "media_url" TEXT,
    "hash_md5" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_plans" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Rutina Semanal',
    "description" TEXT NOT NULL DEFAULT 'Plan personalizado',
    "schedule" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "routine_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_seconds" INTEGER,
    "calories_burned" DOUBLE PRECISION,
    "avg_hr" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_logs" (
    "id" TEXT NOT NULL,
    "client_log_id" TEXT NOT NULL,
    "workout_log_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "rpe" DOUBLE PRECISION DEFAULT 0,
    "set_number" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "set_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "set_logs_client_log_id_key" ON "set_logs"("client_log_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "routine_plans" ADD CONSTRAINT "routine_plans_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "routine_plans" ADD CONSTRAINT "routine_plans_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_workout_log_id_fkey" FOREIGN KEY ("workout_log_id") REFERENCES "workout_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
