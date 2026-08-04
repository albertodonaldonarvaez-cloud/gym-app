package com.tecti.gymaura.worker

import android.content.Context
import android.util.Log
import androidx.work.*
import com.tecti.gymaura.data.local.AppDatabase
import com.tecti.gymaura.data.remote.ApiService
import com.tecti.gymaura.data.remote.ServerRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class SyncWorkoutWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "SyncWorkoutWorker"
        const val WORK_NAME = "GymAura_SyncWorkout"

        fun scheduleSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<SyncWorkoutWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .addTag(WORK_NAME)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)

            Log.d(TAG, "Sync scheduled")
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.d(TAG, "Starting workout sync...")
        val db = AppDatabase.getDatabase(context)
        val dao = db.setLogDao()

        try {
            val pendingLogs = dao.getPendingSetLogs()
            if (pendingLogs.isEmpty()) {
                Log.d(TAG, "No pending logs to sync")
                return@withContext Result.success()
            }

            Log.d(TAG, "Syncing ${pendingLogs.size} set logs...")

            val token = ServerRepository.getToken()
            if (token.isNullOrBlank()) {
                Log.w(TAG, "No auth token, skipping sync")
                return@withContext Result.failure()
            }

            val sets = pendingLogs.map { log ->
                ApiService.SyncSetDto(
                    clientLogId = log.clientLogId,
                    exerciseId = log.exerciseId,
                    workoutLogId = log.workoutLogId.ifBlank { null },
                    weightKg = log.weightKg,
                    reps = log.reps,
                    rpe = log.rpe,
                    setNumber = log.setNumber,
                    notes = log.notes
                )
            }

            val response = ServerRepository.syncWorkouts(sets)
            if (response != null && response.synced >= 0) {
                val syncedIds = pendingLogs.map { it.clientLogId }
                dao.markAsSynced(syncedIds)
                Log.d(TAG, "Sync complete: ${response.synced} synced, ${response.failed} failed")
                Result.success()
            } else {
                Log.w(TAG, "Sync failed, will retry")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sync error: ${e.message}", e)
            Result.retry()
        }
    }
}
