package com.tecti.gymaura.ui.viewmodel

import androidx.compose.runtime.*
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * WorkoutViewModel — persists ALL workout state across screen rotations.
 * Shared between ClientDashboardScreen and WorkoutActiveScreen.
 */
class WorkoutViewModel : ViewModel() {

    // Completed exercises (by exerciseId)
    var completedExerciseIds by mutableStateOf<List<String>>(emptyList())
        private set

    val completedExercises: Set<String> get() = completedExerciseIds.toSet()

    fun markCompleted(exerciseId: String) {
        if (!completedExerciseIds.contains(exerciseId)) {
            completedExerciseIds = completedExerciseIds + exerciseId
        }
    }

    fun resetCompleted() {
        completedExerciseIds = emptyList()
        exerciseSetProgress = emptyMap()
    }

    // Set progress per exercise: exerciseId -> list of (weightKg, reps, done)
    var exerciseSetProgress by mutableStateOf<Map<String, List<Triple<Double, Int, Boolean>>>>(emptyMap())
        private set

    fun updateSetProgress(exerciseId: String, progress: List<Triple<Double, Int, Boolean>>) {
        exerciseSetProgress = exerciseSetProgress + (exerciseId to progress)
    }

    fun getSetProgress(exerciseId: String): List<Triple<Double, Int, Boolean>>? =
        exerciseSetProgress[exerciseId]

    // ─── Rest timer ───────────────────────────────────────────────────────────
    var defaultRestSeconds by mutableStateOf(90)
    var restTimerSeconds by mutableStateOf(0)
        private set
    var isRestTimerRunning by mutableStateOf(false)
        private set
    // Tracks when rest started — used to compute actual rest time taken
    var restStartedAt by mutableStateOf(0L)
        private set

    fun setDefaultRest(seconds: Int) { defaultRestSeconds = seconds.coerceIn(15, 600) }

    private var restTimerJob: Job? = null

    fun startRestTimer(seconds: Int = defaultRestSeconds) {
        restTimerJob?.cancel()
        restTimerSeconds = seconds
        restStartedAt = System.currentTimeMillis()
        isRestTimerRunning = true
        restTimerJob = viewModelScope.launch {
            while (restTimerSeconds > 0 && isRestTimerRunning) {
                delay(1000)
                restTimerSeconds--
            }
            isRestTimerRunning = false
        }
    }

    /** Returns actual seconds elapsed since rest started (0 if not running) */
    fun getActualRestTaken(): Int {
        if (restStartedAt == 0L) return 0
        return ((System.currentTimeMillis() - restStartedAt) / 1000).toInt()
    }

    fun cancelRestTimer() {
        restTimerJob?.cancel()
        restTimerSeconds = 0
        isRestTimerRunning = false
    }

    fun addRestTime(seconds: Int) {
        restTimerSeconds += seconds
        if (!isRestTimerRunning && restTimerSeconds > 0) {
            isRestTimerRunning = true
            restTimerJob = viewModelScope.launch {
                while (restTimerSeconds > 0 && isRestTimerRunning) {
                    delay(1000)
                    restTimerSeconds--
                }
                isRestTimerRunning = false
            }
        }
    }

    // Active exercise id for WorkoutActiveScreen
    var activeExerciseId by mutableStateOf<String?>(null)

    fun openExercise(exerciseId: String) { activeExerciseId = exerciseId }
    fun closeExercise() { activeExerciseId = null }

    override fun onCleared() {
        super.onCleared()
        restTimerJob?.cancel()
    }
}
