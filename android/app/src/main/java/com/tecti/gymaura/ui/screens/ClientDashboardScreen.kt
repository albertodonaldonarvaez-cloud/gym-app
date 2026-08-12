package com.tecti.gymaura.ui.screens

import android.content.Context
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.ImageLoader
import coil.decode.GifDecoder
import coil.decode.ImageDecoderDecoder
import coil.request.ImageRequest
import com.tecti.gymaura.data.local.AppDatabase
import com.tecti.gymaura.data.local.SetLogEntity
import com.tecti.gymaura.data.model.*
import com.tecti.gymaura.data.remote.ServerRepository
import com.tecti.gymaura.ui.components.*
import com.tecti.gymaura.ui.theme.*
import com.tecti.gymaura.worker.SyncWorkoutWorker
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import android.content.Intent
import androidx.compose.foundation.BorderStroke
import com.tecti.gymaura.data.local.WarmupSessionEntity
import com.tecti.gymaura.service.WorkoutForegroundService

// ─── COIL IMAGE LOADER WITH GIF SUPPORT ───────────────────────────────────────
fun buildCoilLoader(context: Context): ImageLoader {
    return ImageLoader.Builder(context)
        .components {
            if (android.os.Build.VERSION.SDK_INT >= 28) add(ImageDecoderDecoder.Factory())
            else add(GifDecoder.Factory())
        }
        .build()
}

private fun formatWarmupTime(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return "%02d:%02d".format(m, s)
}

@Composable
fun ClientDashboardScreen(
    onNavigateToCatalog: () -> Unit
) {
    val context = LocalContext.current
    val db = remember { AppDatabase.getDatabase(context) }
    val dao = remember { db.setLogDao() }
    val imageLoader = remember { buildCoilLoader(context) }
    val scope = rememberCoroutineScope()

    val daysOfWeek = listOf("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")
    val todayName = remember {
        val sdf = SimpleDateFormat("EEEE", Locale("es", "ES"))
        val day = sdf.format(Date()).replaceFirstChar { it.uppercase() }
        if (daysOfWeek.contains(day)) day else "Lunes"
    }

    var selectedDay by remember { mutableStateOf(todayName) }
    var clients by remember { mutableStateOf<List<Client>>(emptyList()) }
    var selectedClient by remember { mutableStateOf<Client?>(null) }
    var weeklyRoutine by remember { mutableStateOf<WeeklyRoutine?>(null) }
    var exercisesMap by remember { mutableStateOf<Map<String, Exercise>>(emptyMap()) }
    var loading by remember { mutableStateOf(true) }

    // Active workout mode state
    var logModalExercise by remember { mutableStateOf<Exercise?>(null) }
    var restTimerSeconds by remember { mutableStateOf(0) }
    var isRestTimerRunning by remember { mutableStateOf(false) }

    // Guided workout flow
    var completedExercises by remember { mutableStateOf<Set<String>>(emptySet()) }
    var activeWorkoutExercise by remember { mutableStateOf<Pair<RoutineExercise, Exercise?>?>(null) }

    // State for warmup
    var showWarmupSheet by remember { mutableStateOf(false) }
    var warmupId by remember { mutableStateOf<String?>(null) }
    var isWarmingUp by remember { mutableStateOf(false) }
    var warmupStartTime by remember { mutableStateOf(0L) }
    var warmupElapsedSec by remember { mutableStateOf(0) }
    var warmupHistory by remember { mutableStateOf<List<WarmupSessionEntity>>(emptyList()) }
    
    // State for workout session
    var isWorkoutActive by remember { mutableStateOf(WorkoutForegroundService.isRunning) }
    var workoutElapsed by remember { mutableStateOf(0) }

    // Warmup timer ticker
    LaunchedEffect(isWarmingUp) {
        if (isWarmingUp) {
            while (isWarmingUp) {
                delay(1000)
                warmupElapsedSec = ((System.currentTimeMillis() - warmupStartTime) / 1000).toInt()
            }
        }
    }
    
    LaunchedEffect(isWorkoutActive) {
        if (isWorkoutActive) {
            while (isWorkoutActive) {
                delay(1000)
                workoutElapsed = WorkoutForegroundService.elapsedSeconds
            }
        }
    }



    // Rest timer
    LaunchedEffect(isRestTimerRunning) {
        if (isRestTimerRunning && restTimerSeconds > 0) {
            while (restTimerSeconds > 0 && isRestTimerRunning) {
                delay(1000)
                restTimerSeconds--
            }
            isRestTimerRunning = false
        }
    }

    fun formatTime(seconds: Int): String {
        val m = seconds / 60; val s = seconds % 60
        return String.format("%02d:%02d", m, s)
    }

    // Preload exercise media with Coil
    fun preloadExerciseMedia(exercises: List<RoutineExercise>) {
        scope.launch {
            exercises.forEach { ex ->
                ex.mediaUrl?.let { url ->
                    val req = ImageRequest.Builder(context).data(url)
                        .memoryCacheKey(url).diskCacheKey(url).build()
                    imageLoader.enqueue(req)
                }
            }
        }
    }

    fun loadData() {
        scope.launch {
            loading = true
            try {
                warmupHistory = ServerRepository.getWarmupHistory()
                // If logged in, use current-week endpoint, else fall back to clients list
                if (ServerRepository.isLoggedIn()) {
                    val routine = ServerRepository.getCurrentWeekRoutine()
                    weeklyRoutine = routine
                    // Preload all media for the week
                    routine?.schedule?.values?.forEach { day ->
                        preloadExerciseMedia(day.exercises)
                    }
                    // Also load exercises map for fallback names
                    val exList = ServerRepository.getExercises()
                    exercisesMap = exList.associateBy { it.id }
                } else {
                    // Legacy: load from clients list
                    val clientList = ServerRepository.getClients()
                    clients = clientList
                    if (selectedClient == null && clientList.isNotEmpty()) selectedClient = clientList.first()
                    val exList = ServerRepository.getExercises()
                    exercisesMap = exList.associateBy { it.id }
                    selectedClient?.let { cli ->
                        val routine = ServerRepository.getWeeklyRoutine(cli.id)
                        weeklyRoutine = routine
                        routine?.schedule?.values?.forEach { day -> preloadExerciseMedia(day.exercises) }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("ClientDashboard", "Load error: ${e.message}")
            }
            loading = false
        }
    }

    LaunchedEffect(Unit) { loadData() }

    // ─── MAIN LAYOUT ──────────────────────────────────────────────────────────
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)
    ) {
        // ─── HEADER ───────────────────────────────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = if (isWorkoutActive) "🏋️ Entrenando" else "Mi Entrenamiento",
                    fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary
                )
                Text(
                    text = if (isWorkoutActive) "Tiempo: ${formatTime(workoutElapsed)}" else "Registra tus cargas y supera tus récords",
                    fontSize = 13.sp, color = if (isWorkoutActive) AppleEmerald else TextSecondary
                )
            }
            // Workout start/stop button
            GlassButton(
                text = if (isWorkoutActive) "Finalizar" else "Iniciar",
                gradientColors = if (isWorkoutActive) listOf(AppleRose, AppleOrange) else listOf(AppleEmerald, AppleTeal),
                onClick = {
                    if (isWorkoutActive) {
                        val stopIntent = Intent(context, WorkoutForegroundService::class.java).apply {
                            action = WorkoutForegroundService.ACTION_STOP
                        }
                        context.startService(stopIntent)
                        isWorkoutActive = false
                        scope.launch {
                            val sessionId = WorkoutForegroundService.sessionId
                            val startTime = WorkoutForegroundService.sessionStartTime
                            val duration = WorkoutForegroundService.elapsedSeconds
                            ServerRepository.saveWorkoutSession(
                                sessionId, WorkoutForegroundService.sessionDayName,
                                startTime, System.currentTimeMillis(), duration
                            )
                        }
                    } else {
                        val todayDay = listOf("Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo")
                        val dayIdx = (java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_WEEK) + 5) % 7
                        val dayName = todayDay[dayIdx]
                        val startIntent = Intent(context, WorkoutForegroundService::class.java).apply {
                            action = WorkoutForegroundService.ACTION_START
                            putExtra("dayName", dayName)
                        }
                        context.startForegroundService(startIntent)
                        isWorkoutActive = true
                    }
                }
            )
        }

        // ─── REST TIMER ───────────────────────────────────────────────────────
        AnimatedVisibility(visible = isRestTimerRunning || restTimerSeconds > 0) {
            GlassCard(
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                backgroundColor = if (restTimerSeconds > 10) AppleTeal.copy(alpha = 0.12f) else AppleOrange.copy(alpha = 0.12f),
                borderColor = if (restTimerSeconds > 10) AppleTeal.copy(alpha = 0.3f) else AppleOrange.copy(alpha = 0.3f)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Timer,
                            contentDescription = null,
                            tint = if (restTimerSeconds > 10) AppleTeal else AppleOrange,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Descanso: ${formatTime(restTimerSeconds)}",
                            fontWeight = FontWeight.Bold,
                            color = if (restTimerSeconds > 10) AppleTeal else AppleOrange
                        )
                    }
                    IconButton(onClick = { restTimerSeconds = 0; isRestTimerRunning = false }) {
                        Icon(Icons.Default.Close, contentDescription = "Cancelar", tint = TextSecondary)
                    }
                }
            }
        }

        // ─── COMPACT WARMUP (solo disponible si la sesión está activa) ──────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(
                    when {
                        isWarmingUp -> Color(0xFFFF9800).copy(alpha = 0.1f)
                        !isWorkoutActive -> GlassSurfaceWhite.copy(alpha = 0.5f)
                        else -> GlassSurfaceWhite
                    }
                )
                .border(
                    1.dp,
                    if (isWarmingUp) Color(0xFFFF9800).copy(alpha = 0.3f) else GlassBorderWhite,
                    RoundedCornerShape(12.dp)
                )
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("🔥", fontSize = 16.sp)
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = if (isWarmingUp) "Calentando: ${formatWarmupTime(warmupElapsedSec)}" else "Calentar",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isWarmingUp) Color(0xFFFF9800) else if (!isWorkoutActive) TextSecondary else TextPrimary
                    )
                    if (!isWorkoutActive && !isWarmingUp) {
                        Text(
                            text = "Inicia sesión primero",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }
            }
            Text(
                text = if (isWarmingUp) "Terminar" else "Iniciar",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = if (!isWorkoutActive && !isWarmingUp) TextSecondary
                        else if (isWarmingUp) Color(0xFFFF9800)
                        else AppleOrange,
                modifier = Modifier.clickable(enabled = isWorkoutActive || isWarmingUp) {
                    if (isWarmingUp) {
                        showWarmupSheet = true
                    } else {
                        scope.launch {
                            warmupStartTime = System.currentTimeMillis()
                            warmupElapsedSec = 0
                            isWarmingUp = true
                            val id = ServerRepository.startWarmup(warmupStartTime)
                            warmupId = id
                        }
                    }
                }
            )
        }

        // ─── DAYS BAR ─────────────────────────────────────────────────────────
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 12.dp)
        ) {
            items(daysOfWeek) { day ->
                GlassChip(
                    text = day.take(3),
                    isSelected = selectedDay == day,
                    onClick = { selectedDay = day }
                )
            }
        }

        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AppleBlue)
            }
        } else if (weeklyRoutine == null) {
            // Offline fallback
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    backgroundColor = GlassSurfaceWhite,
                    borderColor = GlassBorderWhite
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.WifiOff,
                            contentDescription = null,
                            tint = TextSecondary,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Sin conexión al servidor", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Tu rutina se cargará cuando tengas internet.", fontSize = 14.sp, color = TextSecondary, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { loadData() },
                            colors = ButtonDefaults.buttonColors(containerColor = AppleBlue)
                        ) {
                            Text("Reintentar", color = Color.White)
                        }
                    }
                }
            }
        } else {
            val daySchedule = weeklyRoutine?.schedule?.get(selectedDay)
            val routineExercises = daySchedule?.exercises ?: emptyList()

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(14.dp),
                contentPadding = PaddingValues(bottom = 90.dp)
            ) {
                // Focus Card
                item {
                    GlassCard(
                        modifier = Modifier.fillMaxWidth(),
                        backgroundColor = GlassSurfaceWhite,
                        borderColor = GlassBorderWhite
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "RUTINA DE ${selectedDay.uppercase()}",
                                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AppleBlue
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = daySchedule?.focus ?: "Rutina General",
                                    fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary
                                )
                            }
                            GlassBadge(
                                text = "${routineExercises.size} ejercicios",
                                color = AppleTeal
                            )
                        }
                    }
                }

                if (routineExercises.isEmpty()) {
                    item {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.fillMaxWidth().padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = Icons.Default.EventAvailable,
                                    contentDescription = null,
                                    tint = TextSecondary,
                                    modifier = Modifier.size(40.dp)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("Día de descanso 🌟", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text("Recupera y prepárate para el siguiente entrenamiento.", fontSize = 13.sp, color = TextSecondary)
                            }
                        }
                    }
                } else {
                    // Progress bar
                    if (isWorkoutActive && routineExercises.isNotEmpty()) {
                        item {
                            val done = completedExercises.size
                            val total = routineExercises.size
                            val progress = done.toFloat() / total.toFloat()
                            Column(modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Progreso", fontSize = 12.sp, color = TextSecondary, fontWeight = FontWeight.Bold)
                                    Text("$done / $total ejercicios", fontSize = 12.sp, color = if (done == total) AppleEmerald else AppleBlue, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                LinearProgressIndicator(
                                    progress = { progress },
                                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                                    color = if (done == total) AppleEmerald else AppleBlue,
                                    trackColor = GlassBorderWhite
                                )
                            }
                        }
                    }

                    items(routineExercises) { routineEx ->
                        val exercise = exercisesMap[routineEx.exerciseId]
                        val exName = routineEx.name.ifBlank { exercise?.name ?: routineEx.exerciseId }
                        val mediaUrl = routineEx.mediaUrl ?: exercise?.mediaUrl
                        val isDone = completedExercises.contains(routineEx.exerciseId)

                        GlassCard(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    activeWorkoutExercise = Pair(routineEx, exercise)
                                },
                            backgroundColor = if (isDone) AppleEmerald.copy(alpha = 0.07f) else GlassSurfaceWhite,
                            borderColor = if (isDone) AppleEmerald.copy(alpha = 0.4f) else GlassBorderWhite
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Thumbnail or completed checkmark
                                Box(
                                    modifier = Modifier
                                        .size(64.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (isDone) AppleEmerald.copy(alpha = 0.15f) else AppleBlue.copy(alpha = 0.1f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isDone) {
                                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = AppleEmerald, modifier = Modifier.size(36.dp))
                                    } else if (mediaUrl != null) {
                                        coil.compose.AsyncImage(
                                            model = ImageRequest.Builder(context).data(mediaUrl).crossfade(true).build(),
                                            imageLoader = imageLoader,
                                            contentDescription = exName,
                                            modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp))
                                        )
                                    } else {
                                        Icon(Icons.Default.FitnessCenter, contentDescription = null, tint = AppleBlue, modifier = Modifier.size(32.dp))
                                    }
                                }
                                Spacer(modifier = Modifier.width(12.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = exName,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isDone) TextSecondary else TextPrimary
                                    )
                                    Text(
                                        text = "${routineEx.sets} series × ${routineEx.reps} reps · ${routineEx.targetWeightKg}kg",
                                        fontSize = 12.sp,
                                        color = TextSecondary
                                    )
                                    if (routineEx.muscleGroup.isNotBlank()) {
                                        Text(text = routineEx.muscleGroup, fontSize = 11.sp, color = AppleTeal)
                                    }
                                }

                                // Arrow / done indicator
                                Icon(
                                    imageVector = if (isDone) Icons.Default.CheckCircle else Icons.Default.ChevronRight,
                                    contentDescription = null,
                                    tint = if (isDone) AppleEmerald else TextSecondary,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                    }
                }

                // Warmup History
                if (warmupHistory.isNotEmpty()) {
                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Últimos calentamientos",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                    }
                    items(warmupHistory.take(3)) { session ->
                        val durationMins = session.durationSec / 60
                        val daysAgo = ((System.currentTimeMillis() - session.startedAt) / (1000 * 60 * 60 * 24)).toInt()
                        val timeString = when (daysAgo) {
                            0 -> "hoy"
                            1 -> "ayer"
                            else -> "hace $daysAgo días"
                        }
                        
                        GlassCard(
                            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                            backgroundColor = GlassSurfaceWhite,
                            borderColor = GlassBorderWhite
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("🔥", fontSize = 20.sp)
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text("Calentamiento", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                    Text("$durationMins min — $timeString", fontSize = 12.sp, color = TextSecondary)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ─── SET LOG MODAL (legacy quick-log) ────────────────────────────────────
    logModalExercise?.let { exercise ->
        SetLogModal(
            exercise = exercise,
            context = context,
            dao = dao,
            onDismiss = { logModalExercise = null },
            onSaved = { weightKg, reps, rpe, setNumber ->
                logModalExercise = null
                restTimerSeconds = 90
                isRestTimerRunning = true
                SyncWorkoutWorker.scheduleSync(context)
            }
        )
    }

    // ─── GUIDED EXERCISE WORKOUT MODAL ────────────────────────────────────────
    activeWorkoutExercise?.let { (routineEx, exercise) ->
        val allExercises = weeklyRoutine?.schedule?.get(selectedDay)?.exercises ?: emptyList()
        val currentIndex = allExercises.indexOfFirst { it.exerciseId == routineEx.exerciseId }
        val nextExercise = if (currentIndex >= 0 && currentIndex < allExercises.size - 1)
            allExercises[currentIndex + 1] else null

        ExerciseWorkoutModal(
            routineEx = routineEx,
            exercise = exercise,
            exercisesMap = exercisesMap,
            imageLoader = imageLoader,
            context = context,
            dao = dao,
            isCompleted = completedExercises.contains(routineEx.exerciseId),
            nextExerciseName = nextExercise?.let {
                exercisesMap[it.exerciseId]?.name ?: it.name
            },
            onComplete = {
                completedExercises = completedExercises + routineEx.exerciseId
                SyncWorkoutWorker.scheduleSync(context)
                if (nextExercise != null) {
                    activeWorkoutExercise = Pair(nextExercise, exercisesMap[nextExercise.exerciseId])
                } else {
                    activeWorkoutExercise = null
                }
            },
            onSetSaved = {
                restTimerSeconds = 90
                isRestTimerRunning = true
                SyncWorkoutWorker.scheduleSync(context)
            },
            onDismiss = { activeWorkoutExercise = null }
        )
    }

    if (showWarmupSheet) {
        WarmupFinishDialog(
            durationSec = warmupElapsedSec,
            onFinish = { notes ->
                scope.launch {
                    val id = warmupId ?: ""
                    ServerRepository.finishWarmup(id, warmupElapsedSec, notes)
                    isWarmingUp = false
                    warmupElapsedSec = 0
                    warmupId = null
                    showWarmupSheet = false
                    // Refresh history
                    warmupHistory = ServerRepository.getWarmupHistory()
                }
            },
            onDismiss = { showWarmupSheet = false }
        )
    }
}


// ─── EXERCISE WORKOUT MODAL ───────────────────────────────────────────────────
@Composable
fun ExerciseWorkoutModal(
    routineEx: RoutineExercise,
    exercise: Exercise?,
    exercisesMap: Map<String, Exercise>,
    imageLoader: ImageLoader,
    context: Context,
    dao: com.tecti.gymaura.data.local.SetLogDao,
    isCompleted: Boolean,
    nextExerciseName: String?,
    onComplete: () -> Unit,
    onSetSaved: () -> Unit,
    onDismiss: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val exName = routineEx.name.ifBlank { exercise?.name ?: routineEx.exerciseId }
    val mediaUrl = routineEx.mediaUrl ?: exercise?.mediaUrl
    val instructions = exercise?.instructions ?: routineEx.instructions
    val totalSets = routineEx.sets.coerceAtLeast(1)

    val prefs = context.getSharedPreferences("gymaura_prefs", 0)
    var useKg by remember { mutableStateOf(prefs.getBoolean("use_kg_unit", true)) }

    // Track each set completion: list of (weightKg, reps, done)
    var setData by remember {
        mutableStateOf(List(totalSets) { Triple(routineEx.targetWeightKg, routineEx.reps, false) })
    }
    var currentSetIndex by remember { mutableStateOf(0) }
    var weightInput by remember { mutableStateOf(String.format("%.1f", routineEx.targetWeightKg)) }
    var repsInput by remember { mutableStateOf(routineEx.reps.toString()) }
    var saving by remember { mutableStateOf(false) }

    // Load last performance
    LaunchedEffect(routineEx.exerciseId) {
        val local = dao.getLastSetForExercise(routineEx.exerciseId)
        local?.let {
            val w = if (useKg) it.weightKg else it.weightKg / 0.453592
            weightInput = String.format("%.1f", w)
            repsInput = it.reps.toString()
        }
    }

    fun displayToKg(): Double {
        val v = weightInput.toDoubleOrNull() ?: 0.0
        return if (useKg) v else v * 0.453592
    }

    val allSetsDone = setData.all { it.third }
    val scrollState = rememberScrollState()

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.92f),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(8.dp)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {

                // ── Header ──────────────────────────────────────────────────
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(if (mediaUrl != null) 200.dp else 80.dp)
                ) {
                    if (mediaUrl != null) {
                        coil.compose.AsyncImage(
                            model = ImageRequest.Builder(context).data(mediaUrl).crossfade(true).build(),
                            imageLoader = imageLoader,
                            contentDescription = exName,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = androidx.compose.ui.layout.ContentScale.Crop
                        )
                        // Gradient overlay at bottom
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(Color.Transparent, Color.White),
                                        startY = 100f
                                    )
                                )
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(AppleBlue.copy(alpha = 0.15f), AppleTeal.copy(alpha = 0.1f))
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.FitnessCenter, contentDescription = null, tint = AppleBlue, modifier = Modifier.size(56.dp))
                        }
                    }

                    // Close button
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.85f))
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Cerrar", tint = TextPrimary, modifier = Modifier.size(18.dp))
                    }

                    // Completed badge
                    if (isCompleted) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopStart)
                                .padding(8.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(AppleEmerald)
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text("✅ Completado", fontSize = 11.sp, color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                // ── Scrollable content ───────────────────────────────────────
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                ) {
                    // Exercise title
                    Text(exName, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                    Spacer(modifier = Modifier.height(2.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (routineEx.muscleGroup.isNotBlank()) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(AppleTeal.copy(alpha = 0.12f))
                                    .padding(horizontal = 10.dp, vertical = 3.dp)
                            ) {
                                Text(routineEx.muscleGroup, fontSize = 12.sp, color = AppleTeal, fontWeight = FontWeight.Bold)
                            }
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(AppleBlue.copy(alpha = 0.1f))
                                .padding(horizontal = 10.dp, vertical = 3.dp)
                        ) {
                            Text("$totalSets series × ${routineEx.reps} reps", fontSize = 12.sp, color = AppleBlue, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Divider(color = GlassBorderWhite)
                    Spacer(modifier = Modifier.height(12.dp))

                    // ── SERIES TRACKER ─────────────────────────────────────
                    Text("Series", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Spacer(modifier = Modifier.height(8.dp))

                    setData.forEachIndexed { idx, (w, r, done) ->
                        val isActive = idx == currentSetIndex && !allSetsDone
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 6.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    when {
                                        done -> AppleEmerald.copy(alpha = 0.1f)
                                        isActive -> AppleBlue.copy(alpha = 0.07f)
                                        else -> GlassSurfaceWhite
                                    }
                                )
                                .border(
                                    1.dp,
                                    when {
                                        done -> AppleEmerald.copy(alpha = 0.4f)
                                        isActive -> AppleBlue.copy(alpha = 0.4f)
                                        else -> GlassBorderWhite
                                    },
                                    RoundedCornerShape(12.dp)
                                )
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Set number circle
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(CircleShape)
                                    .background(
                                        when {
                                            done -> AppleEmerald
                                            isActive -> AppleBlue
                                            else -> GlassBorderWhite
                                        }
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                if (done) {
                                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                                } else {
                                    Text("${idx + 1}", fontSize = 13.sp, fontWeight = FontWeight.Bold,
                                        color = if (isActive) Color.White else TextSecondary)
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Serie ${idx + 1}",
                                    fontSize = 13.sp, fontWeight = FontWeight.Bold,
                                    color = if (done) AppleEmerald else if (isActive) AppleBlue else TextSecondary
                                )
                                if (done) {
                                    val wDisplay = if (useKg) "${String.format("%.1f", w)} kg" else "${String.format("%.1f", w / 0.453592)} lb"
                                    Text("$wDisplay × $r reps ✓", fontSize = 12.sp, color = AppleEmerald)
                                } else {
                                    Text("Objetivo: ${routineEx.targetWeightKg}kg × ${routineEx.reps} reps",
                                        fontSize = 12.sp, color = TextSecondary)
                                }
                            }
                        }
                    }

                    // ── INPUT SECTION (current active set) ─────────────────
                    if (!allSetsDone) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "Registrar Serie ${currentSetIndex + 1}",
                            fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        // kg/lb toggle
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(GlassSurfaceWhite)
                                .border(1.dp, GlassBorderWhite, RoundedCornerShape(10.dp))
                                .padding(3.dp)
                        ) {
                            listOf(true to "kg", false to "lb").forEach { (isKg, label) ->
                                Box(
                                    modifier = Modifier.weight(1f)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (useKg == isKg) AppleBlue else Color.Transparent)
                                        .clickable { useKg = isKg; prefs.edit().putBoolean("use_kg_unit", isKg).apply() }
                                        .padding(vertical = 6.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                                        color = if (useKg == isKg) Color.White else TextSecondary)
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedTextField(
                                value = weightInput,
                                onValueChange = { weightInput = it },
                                label = { Text("Peso (${if (useKg) "kg" else "lb"})") },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal
                                ),
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = repsInput,
                                onValueChange = { repsInput = it },
                                label = { Text("Reps") },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                                ),
                                singleLine = true
                            )
                        }
                        Spacer(modifier = Modifier.height(10.dp))

                        // LOG SET button
                        Button(
                            onClick = {
                                scope.launch {
                                    saving = true
                                    val weightKg = displayToKg()
                                    val r = repsInput.toIntOrNull() ?: routineEx.reps
                                    // Save locally
                                    val entity = SetLogEntity(
                                        exerciseId = routineEx.exerciseId,
                                        exerciseName = exName,
                                        weightKg = weightKg,
                                        reps = r,
                                        rpe = 7.0,
                                        setNumber = currentSetIndex + 1,
                                        isSynced = false
                                    )
                                    dao.insertSetLog(entity)
                                    // Sync to server
                                    if (ServerRepository.isLoggedIn()) {
                                        try {
                                            ServerRepository.logSetToServer(
                                                exerciseId = routineEx.exerciseId,
                                                exerciseName = exName,
                                                setNumber = currentSetIndex + 1,
                                                reps = r,
                                                weightKg = weightKg,
                                                rpe = 7.0,
                                                sessionId = WorkoutForegroundService.sessionId
                                            )
                                            dao.markSynced(entity.id)
                                        } catch (_: Exception) {}
                                    }
                                    // Mark this set as done
                                    setData = setData.toMutableList().also { list ->
                                        list[currentSetIndex] = Triple(weightKg, r, true)
                                    }
                                    if (currentSetIndex < totalSets - 1) {
                                        currentSetIndex++
                                        // Pre-fill next set with same values
                                        weightInput = String.format("%.1f", if (useKg) weightKg else weightKg / 0.453592)
                                        repsInput = r.toString()
                                    }
                                    saving = false
                                    onSetSaved()
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = AppleBlue),
                            enabled = !saving && weightInput.isNotBlank() && repsInput.isNotBlank()
                        ) {
                            if (saving) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.AddCircle, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("✓ Registrar Serie ${currentSetIndex + 1}", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // ── Instructions ───────────────────────────────────────
                    if (!instructions.isNullOrBlank()) {
                        Divider(color = GlassBorderWhite)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Instrucciones", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Spacer(modifier = Modifier.height(6.dp))
                        val steps = instructions.split(". ").filter { it.isNotBlank() }
                        steps.forEachIndexed { i, step ->
                            Row(
                                modifier = Modifier.padding(bottom = 6.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(22.dp)
                                        .clip(CircleShape)
                                        .background(AppleBlue.copy(alpha = 0.12f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${i + 1}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AppleBlue)
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(step.trim().trimEnd('.'), fontSize = 13.sp, color = TextSecondary, modifier = Modifier.weight(1f))
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // ── COMPLETE / NEXT buttons ────────────────────────────
                    if (allSetsDone || isCompleted) {
                        Button(
                            onClick = onComplete,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = AppleEmerald),
                            enabled = !isCompleted
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (isCompleted) "✅ Ejercicio Completado" else
                                    if (nextExerciseName != null) "Completar → $nextExerciseName" else "✅ Finalizar Ejercicio",
                                fontWeight = FontWeight.Bold, fontSize = 15.sp
                            )
                        }
                    } else {
                        // Skip/complete early button (outline)
                        OutlinedButton(
                            onClick = onComplete,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, AppleEmerald.copy(alpha = 0.5f))
                        ) {
                            Text(
                                text = if (nextExerciseName != null) "Marcar completo → $nextExerciseName" else "Marcar como completado",
                                color = AppleEmerald, fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(20.dp))
                }
            }
        }
    }
}

@Composable
fun SetLogModal(
    exercise: Exercise,
    context: Context,
    dao: com.tecti.gymaura.data.local.SetLogDao,
    onDismiss: () -> Unit,
    onSaved: (Double, Int, Double, Int) -> Unit
) {
    val scope = rememberCoroutineScope()

    // Load saved unit preference from SharedPreferences
    val prefs = context.getSharedPreferences("gymaura_prefs", 0)
    var useKg by remember { mutableStateOf(prefs.getBoolean("use_kg_unit", true)) }

    var weightInput by remember { mutableStateOf("") }
    var reps by remember { mutableStateOf("") }
    var rpe by remember { mutableStateOf("7") }
    var setNumber by remember { mutableStateOf(1) }
    var lastPerformance by remember { mutableStateOf<com.tecti.gymaura.data.model.LastPerformance?>(null) }
    var localLast by remember { mutableStateOf<com.tecti.gymaura.data.local.SetLogEntity?>(null) }
    var loading by remember { mutableStateOf(true) }

    fun kgToDisplay(kg: Double): String {
        return if (useKg) String.format("%.1f", kg)
        else String.format("%.1f", kg / 0.453592)
    }

    fun displayToKg(): Double {
        val v = weightInput.toDoubleOrNull() ?: 0.0
        return if (useKg) v else v * 0.453592
    }

    // Load last performance
    LaunchedEffect(exercise.id) {
        loading = true
        val local = dao.getLastSetForExercise(exercise.id)
        localLast = local
        local?.let {
            weightInput = kgToDisplay(it.weightKg)
            reps = it.reps.toString()
            rpe = it.rpe.toString()
            setNumber = (it.setNumber + 1).coerceAtMost(6)
        }
        if (ServerRepository.isLoggedIn()) {
            val serverLast = ServerRepository.getLastPerformance(exercise.id)
            serverLast?.let {
                lastPerformance = it
                if (local == null) {
                    weightInput = kgToDisplay(it.weightKg)
                    reps = it.reps.toString()
                }
            }
        }
        loading = false
    }

    // When unit changes, convert current input value
    LaunchedEffect(useKg) {
        val current = weightInput.toDoubleOrNull()
        if (current != null && current > 0) {
            weightInput = if (useKg) String.format("%.1f", current * 0.453592)
            else String.format("%.1f", current / 0.453592)
        }
        prefs.edit().putBoolean("use_kg_unit", useKg).apply()
    }

    Dialog(onDismissRequest = onDismiss) {
        GlassCard(
            modifier = Modifier.fillMaxWidth(),
            backgroundColor = GlassSurfaceWhite,
            borderColor = AppleBlue.copy(alpha = 0.3f)
        ) {
            Column {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(text = exercise.name, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                        Text(text = exercise.targetMuscle.ifBlank { "Serie #$setNumber" }, fontSize = 13.sp, color = TextSecondary)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = TextSecondary)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Last performance chip
                val lastToShow = lastPerformance ?: localLast?.let {
                    com.tecti.gymaura.data.model.LastPerformance(it.weightKg, it.reps, it.rpe, "")
                }
                lastToShow?.let { last ->
                    val displayWeight = if (useKg) "${String.format("%.1f", last.weightKg)} kg"
                                       else "${String.format("%.1f", last.weightKg / 0.453592)} lb"
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(AppleTeal.copy(alpha = 0.1f))
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.History, contentDescription = null, tint = AppleTeal, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Última vez: $displayWeight × ${last.reps} reps · RPE ${last.rpe ?: "-"}",
                            fontSize = 12.sp, color = AppleTeal, fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                // Set number selector
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Serie:", fontSize = 14.sp, color = TextSecondary)
                    Spacer(modifier = Modifier.width(8.dp))
                    (1..6).forEach { n ->
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(if (setNumber == n) AppleBlue else GlassSurfaceWhite)
                                .border(1.dp, if (setNumber == n) AppleBlue else GlassBorderWhite, CircleShape)
                                .clickable { setNumber = n },
                            contentAlignment = Alignment.Center
                        ) {
                            Text("$n", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = if (setNumber == n) Color.White else TextPrimary)
                        }
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // kg / lb toggle
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(GlassSurfaceWhite)
                        .border(1.dp, GlassBorderWhite, RoundedCornerShape(12.dp))
                        .padding(3.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    listOf(true to "kg", false to "lb").forEach { (isKg, label) ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (useKg == isKg) AppleBlue else Color.Transparent)
                                .clickable { useKg = isKg }
                                .padding(vertical = 7.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (useKg == isKg) Color.White else TextSecondary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Weight & Reps inputs
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = weightInput,
                        onValueChange = { weightInput = it },
                        label = { Text("Peso (${if (useKg) "kg" else "lb"})") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal)
                    )
                    OutlinedTextField(
                        value = reps,
                        onValueChange = { reps = it },
                        label = { Text("Reps") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // RPE Slider
                Text("Esfuerzo percibido (RPE): $rpe", fontSize = 13.sp, color = TextSecondary)
                Slider(
                    value = rpe.toFloatOrNull() ?: 7f,
                    onValueChange = { rpe = String.format("%.1f", it) },
                    valueRange = 1f..10f,
                    steps = 17,
                    colors = SliderDefaults.colors(thumbColor = AppleBlue, activeTrackColor = AppleBlue)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Save button
                Button(
                    onClick = {
                        scope.launch {
                            val weightKg = displayToKg()  // Always convert to kg for storage
                            val r = reps.toIntOrNull() ?: 0
                            val rpeVal = rpe.toDoubleOrNull() ?: 7.0
                            val entity = SetLogEntity(
                                exerciseId = exercise.id,
                                exerciseName = exercise.name,
                                weightKg = weightKg,
                                reps = r,
                                rpe = rpeVal,
                                setNumber = setNumber,
                                isSynced = false
                            )
                            dao.insertSetLog(entity)
                            // ── Sync to server immediately if online ──────────
                            if (ServerRepository.isLoggedIn()) {
                                try {
                                    ServerRepository.logSetToServer(
                                        exerciseId = exercise.id,
                                        exerciseName = exercise.name,
                                        setNumber = setNumber,
                                        reps = r,
                                        weightKg = weightKg,
                                        rpe = rpeVal,
                                        sessionId = WorkoutForegroundService.sessionId
                                    )
                                    dao.markSynced(entity.id)
                                } catch (e: Exception) {
                                    // Will retry next sync cycle — set stays as isSynced=false
                                }
                            }
                            onSaved(weightKg, r, rpeVal, setNumber)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = AppleBlue)
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Guardar Serie", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
fun WarmupFinishDialog(
    durationSec: Int,
    onFinish: (notes: String) -> Unit,
    onDismiss: () -> Unit
) {
    var notes by remember { mutableStateOf("") }
    val minutes = durationSec / 60
    val seconds = durationSec % 60

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = GlassSurfaceWhite),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("🔥", fontSize = 40.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Calentamiento", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "%02d:%02d".format(minutes, seconds),
                    fontSize = 36.sp, fontWeight = FontWeight.Bold,
                    color = Color(0xFFFF9800)
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notas (opcional)") },
                    placeholder = { Text("Ej: Bici estática 10 min") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp)
                )
                Spacer(modifier = Modifier.height(20.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp)
                    ) { Text("Seguir") }
                    Button(
                        onClick = { onFinish(notes) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF9800))
                    ) { Text("Guardar", color = Color.White, fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

