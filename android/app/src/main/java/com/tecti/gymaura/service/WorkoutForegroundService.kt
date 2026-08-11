package com.tecti.gymaura.service

import android.app.*
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.tecti.gymaura.MainActivity
import com.tecti.gymaura.R
import kotlinx.coroutines.*
import java.util.UUID
import java.util.concurrent.TimeUnit

class WorkoutForegroundService : Service() {
    companion object {
        const val CHANNEL_ID = "workout_session_channel"
        const val NOTIF_ID = 1001
        const val ACTION_START = "START_WORKOUT"
        const val ACTION_STOP = "STOP_WORKOUT"
        
        var isRunning = false
        var sessionId: String = ""
        var sessionStartTime: Long = 0L
        var sessionDayName: String = ""
        
        // Observable elapsed seconds for UI
        @Volatile var elapsedSeconds: Int = 0
    }

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Default + job)
    private var timerJob: Job? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val dayName = intent.getStringExtra("dayName") ?: ""
                startWorkout(dayName)
            }
            ACTION_STOP -> stopWorkout()
        }
        return START_STICKY
    }

    private fun startWorkout(dayName: String) {
        isRunning = true
        sessionId = UUID.randomUUID().toString()
        sessionStartTime = System.currentTimeMillis()
        sessionDayName = dayName
        elapsedSeconds = 0

        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification("Iniciando..."))

        timerJob = scope.launch {
            while (isActive && isRunning) {
                delay(1000)
                elapsedSeconds++
                val elapsed = formatTime(elapsedSeconds)
                updateNotification("🏋️ Entrenando: $dayName — $elapsed")
            }
        }
    }

    private fun stopWorkout() {
        isRunning = false
        timerJob?.cancel()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun formatTime(seconds: Int): String {
        val h = seconds / 3600
        val m = (seconds % 3600) / 60
        val s = seconds % 60
        return if (h > 0) "%02d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Sesión de Entrenamiento",
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Muestra el progreso del entrenamiento activo" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        val tapIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this, 1,
            Intent(this, WorkoutForegroundService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("GymAura — Entrenamiento Activo")
            .setContentText(text)
            .setContentIntent(tapIntent)
            .addAction(android.R.drawable.ic_media_pause, "Terminar", stopIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val notif = buildNotification(text)
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, notif)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        isRunning = false
        timerJob?.cancel()
        job.cancel()
        super.onDestroy()
    }
}
