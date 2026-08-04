package com.tecti.gymaura.data.local

import androidx.room.*
import java.util.UUID

@Entity(tableName = "set_logs")
data class SetLogEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val clientLogId: String = UUID.randomUUID().toString(), // Unique idempotent key for server sync
    val exerciseId: String,
    val exerciseName: String = "",
    val workoutLogId: String = "",
    val weightKg: Double = 0.0,
    val reps: Int = 0,
    val rpe: Double = 0.0,
    val setNumber: Int = 1,
    val notes: String = "",
    val timestamp: Long = System.currentTimeMillis(),
    val isSynced: Boolean = false
)
