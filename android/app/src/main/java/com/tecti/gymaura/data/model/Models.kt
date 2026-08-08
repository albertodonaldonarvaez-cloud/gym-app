package com.tecti.gymaura.data.model

import com.google.gson.annotations.SerializedName

// ─── AUTH ─────────────────────────────────────────────────────────────────────
data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String,
    val role: String = "CLIENT",
    val coachId: String? = null
)

data class AuthUser(
    val id: String,
    val email: String,
    val name: String,
    val role: String,
    val coachId: String? = null
)

data class AuthResponse(
    val token: String,
    val user: AuthUser
)

enum class UserRole {
    CLIENT, COACH
}

// ─── USER / CLIENT ─────────────────────────────────────────────────────────────
data class Client(
    val id: String,
    val name: String,
    val email: String = "",
    val phone: String = "",
    val avatar: String = "",
    val goal: String = "Acondicionamiento Físico",
    val weightKg: Double = 70.0,
    val heightCm: Int = 170,
    val activeRoutineId: String? = null
)

// ─── EXERCISE ─────────────────────────────────────────────────────────────────
data class Exercise(
    val id: String,
    val name: String,
    val category: String = "General",
    val targetMuscle: String = "",
    val equipment: String = "Libre",
    val instructions: String = "",
    val defaultSets: Int = 4,
    val defaultReps: Int = 12,
    val mediaUrl: String? = null,
    val icon: String = "dumbbell"
)

// ─── ROUTINE ──────────────────────────────────────────────────────────────────
data class RoutineExercise(
    val exerciseId: String,
    val sets: Int = 4,
    val reps: Int = 10,
    val targetWeightKg: Double = 0.0,
    // Enriched by server
    val name: String = "",
    val mediaUrl: String? = null,
    val muscleGroup: String = ""
)

data class DaySchedule(
    val dayName: String,
    val focus: String = "Rutina General",
    val exercises: List<RoutineExercise> = emptyList()
)

data class WeeklyRoutine(
    val id: String?,
    val clientId: String = "",
    val title: String = "Rutina Semanal",
    val description: String = "",
    val schedule: Map<String, DaySchedule> = emptyMap()
)

// ─── SET LOG / WORKOUT LOG ────────────────────────────────────────────────────
data class WeightLog(
    val id: String,
    val clientId: String = "",
    val exerciseId: String,
    val exerciseName: String = "",
    val date: String = "",
    val dayName: String = "",
    val setNumber: Int = 1,
    val weightKg: Double = 0.0,
    val repsCompleted: Int = 0,
    val notes: String = ""
)

data class LastPerformance(
    val weightKg: Double,
    val reps: Int,
    val rpe: Double?,
    val createdAt: String
)

// ─── SYNC ─────────────────────────────────────────────────────────────────────
data class SyncResponse(
    val synced: Int,
    val failed: Int,
    val workoutLogId: String?
)

// ─── HUAWEI HEALTH ────────────────────────────────────────────────────────────
data class HuaweiWorkoutData(
    val caloriesBurned: Float?,
    val avgHr: Int?,
    val durationSeconds: Int?,
    val date: String? = null
)

// ─── COACH INFO ───────────────────────────────────────────────────────────────
data class CoachInfo(
    val id: String,
    val name: String,
    val email: String,
    val avatar: String = ""
)

data class Coach(
    val id: String,
    val name: String,
    val email: String,
    val avatar: String = "",
    val gymName: String = "GymAura Studio"
)

// ─── HISTORY ──────────────────────────────────────────────────────────────────
data class WorkoutHistoryItem(
    val id: String,
    val clientLogId: String,
    val exerciseId: String,
    val exerciseName: String,
    val workoutLogId: String,
    val weightKg: Double,
    val reps: Int,
    val rpe: Double?,
    val setNumber: Int,
    val notes: String,
    val createdAt: String
)
