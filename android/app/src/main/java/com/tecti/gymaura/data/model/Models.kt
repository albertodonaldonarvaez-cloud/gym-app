package com.tecti.gymaura.data.model

import com.google.gson.annotations.SerializedName

enum class UserRole {
    COACH, CLIENT
}

data class Coach(
    val id: String,
    val name: String,
    val email: String,
    val gymName: String,
    val avatar: String
)

data class Client(
    val id: String,
    val name: String,
    val email: String,
    val phone: String = "",
    val goal: String = "Fuerza y Rendimiento",
    val weightKg: Double = 70.0,
    val heightCm: Int = 170,
    val avatar: String = "",
    val activeRoutineId: String? = null
)

data class Exercise(
    val id: String,
    val name: String,
    val category: String,
    val targetMuscle: String,
    val equipment: String = "Libre",
    val instructions: String = "",
    val defaultSets: Int = 4,
    val defaultReps: Int = 10,
    val icon: String = "dumbbell"
)

data class RoutineExercise(
    val exerciseId: String,
    val sets: Int = 4,
    val reps: Int = 10,
    val targetWeightKg: Double = 0.0
)

data class DaySchedule(
    val dayName: String,
    val focus: String = "Rutina General",
    val exercises: List<RoutineExercise> = emptyList()
)

data class WeeklyRoutine(
    val id: String,
    val clientId: String,
    val title: String = "Rutina Semanal",
    val description: String = "Plan de entrenamiento personal",
    val schedule: Map<String, DaySchedule> = emptyMap()
)

data class WeightLog(
    val id: String = "",
    val clientId: String,
    val exerciseId: String,
    val exerciseName: String,
    val date: String = "",
    val dayName: String = "",
    val setNumber: Int = 1,
    val weightKg: Double = 0.0,
    val repsCompleted: Int = 0,
    val notes: String = ""
)

data class ServerHealth(
    val status: String,
    val app: String,
    val timestamp: String
)
