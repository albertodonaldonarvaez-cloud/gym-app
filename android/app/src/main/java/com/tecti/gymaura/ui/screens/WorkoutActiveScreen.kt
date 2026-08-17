package com.tecti.gymaura.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.tecti.gymaura.data.local.AppDatabase
import com.tecti.gymaura.data.local.SetLogEntity
import com.tecti.gymaura.data.model.Exercise
import com.tecti.gymaura.data.model.RoutineExercise
import com.tecti.gymaura.data.remote.ServerRepository
import com.tecti.gymaura.service.WorkoutForegroundService
import com.tecti.gymaura.ui.components.GlassCard
import com.tecti.gymaura.ui.theme.*
import com.tecti.gymaura.ui.viewmodel.WorkoutViewModel
import com.tecti.gymaura.worker.SyncWorkoutWorker
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * WorkoutActiveScreen v2
 *
 * Cambios vs v1:
 * - Selector de ejercicio: botón en TopBar abre sheet con lista de todos los ejercicios del día
 * - Timer configurable: tap en el timer abre dialog con presets (30/60/90/120/180s) + input libre
 * - restSeconds se guarda al server con cada serie para análisis de datos
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutActiveScreen(
    routineExercises: List<RoutineExercise>,
    exercisesMap: Map<String, Exercise>,
    imageLoader: ImageLoader,
    workoutViewModel: WorkoutViewModel,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val dao = remember { AppDatabase.getDatabase(context).setLogDao() }
    val prefs = context.getSharedPreferences("gymaura_prefs", 0)

    var currentIndex by remember {
        mutableStateOf(
            workoutViewModel.activeExerciseId?.let { id ->
                routineExercises.indexOfFirst { it.exerciseId == id }.takeIf { it >= 0 }
            } ?: 0
        )
    }

    if (routineExercises.isEmpty()) {
        Box(Modifier.fillMaxSize().background(Color(0xFFF2F6FF)), Alignment.Center) {
            Text("Sin ejercicios para hoy", color = TextSecondary)
        }
        return
    }

    val routineEx = routineExercises[currentIndex.coerceIn(0, routineExercises.size - 1)]
    val exercise = exercisesMap[routineEx.exerciseId]
    val exName = routineEx.name.ifBlank { exercise?.name ?: routineEx.exerciseId }
    val mediaUrl = routineEx.mediaUrl ?: exercise?.mediaUrl
    val instructions = routineEx.instructions.ifBlank { exercise?.instructions ?: "" }
    val totalSets = routineEx.sets.coerceAtLeast(1)
    val isDone = workoutViewModel.completedExercises.contains(routineEx.exerciseId)

    val savedProgress = workoutViewModel.getSetProgress(routineEx.exerciseId)
    var setData by remember(currentIndex) {
        mutableStateOf(
            savedProgress?.takeIf { it.size == totalSets }
                ?: List(totalSets) { Triple(routineEx.targetWeightKg, routineEx.reps, false) }
        )
    }
    var currentSetIndex by remember(currentIndex) {
        mutableStateOf(savedProgress?.indexOfFirst { !it.third }?.takeIf { it >= 0 } ?: 0)
    }
    var useKg by remember { mutableStateOf(prefs.getBoolean("use_kg_unit", true)) }
    val lastDone = savedProgress?.lastOrNull { it.third }
    var weightInput by remember(currentIndex) {
        mutableStateOf(
            lastDone?.let { String.format("%.1f", if (useKg) it.first else it.first / 0.453592) }
                ?: String.format("%.1f", routineEx.targetWeightKg)
        )
    }
    var repsInput by remember(currentIndex) {
        mutableStateOf(lastDone?.second?.toString() ?: routineEx.reps.toString())
    }
    var saving by remember(currentIndex) { mutableStateOf(false) }
    var showInstructions by remember { mutableStateOf(false) }
    val allSetsDone = setData.all { it.third }

    // ─── UI State ──────────────────────────────────────────────────────────────
    var showExerciseSelector by remember { mutableStateOf(false) }
    var showRestConfig by remember { mutableStateOf(false) }

    val restTimer = workoutViewModel.restTimerSeconds
    val restRunning = workoutViewModel.isRestTimerRunning
    val defaultRest = workoutViewModel.defaultRestSeconds
    val scrollState = rememberScrollState()

    // Load last performance from local DB if no saved progress
    LaunchedEffect(routineEx.exerciseId) {
        if (savedProgress == null) {
            val local = dao.getLastSetForExercise(routineEx.exerciseId)
            local?.let {
                weightInput = String.format("%.1f", if (useKg) it.weightKg else it.weightKg / 0.453592)
                repsInput = it.reps.toString()
            }
        }
    }

    // Elapsed session timer
    var elapsedDisplay by remember { mutableStateOf(WorkoutForegroundService.elapsedSeconds) }
    LaunchedEffect(Unit) {
        while (true) {
            kotlinx.coroutines.delay(1000)
            elapsedDisplay = WorkoutForegroundService.elapsedSeconds
        }
    }

    fun fmt(s: Int) = String.format("%02d:%02d", s / 60, s % 60)
    fun toKg(): Double { val v = weightInput.toDoubleOrNull() ?: 0.0; return if (useKg) v else v * 0.453592 }

    // ─── Exercise selector BottomSheet ─────────────────────────────────────────
    if (showExerciseSelector) {
        ModalBottomSheet(
            onDismissRequest = { showExerciseSelector = false },
            containerColor = Color.White,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                Text("Seleccionar ejercicio", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = TextPrimary)
                Text("Día: ${routineExercises.size} ejercicios", fontSize = 13.sp, color = TextSecondary)
                Spacer(Modifier.height(12.dp))
                LazyColumn(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 32.dp)
                ) {
                    itemsIndexed(routineExercises) { idx, re ->
                        val isSelected = idx == currentIndex
                        val exDone = workoutViewModel.completedExercises.contains(re.exerciseId)
                        val name = re.name.ifBlank { exercisesMap[re.exerciseId]?.name ?: re.exerciseId }
                        val muscle = re.muscleGroup.ifBlank { exercisesMap[re.exerciseId]?.targetMuscle ?: "" }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(when {
                                    isSelected -> AppleBlue.copy(alpha = 0.1f)
                                    exDone -> AppleEmerald.copy(alpha = 0.07f)
                                    else -> Color(0xFFF5F5F7)
                                })
                                .border(1.dp, when {
                                    isSelected -> AppleBlue.copy(alpha = 0.5f)
                                    exDone -> AppleEmerald.copy(alpha = 0.35f)
                                    else -> GlassBorderWhite
                                }, RoundedCornerShape(16.dp))
                                .clickable {
                                    currentIndex = idx
                                    workoutViewModel.openExercise(re.exerciseId)
                                    showExerciseSelector = false
                                }
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Number / status
                            Box(
                                Modifier.size(32.dp).clip(CircleShape).background(when {
                                    isSelected -> AppleBlue
                                    exDone -> AppleEmerald
                                    else -> GlassBorderWhite
                                }),
                                Alignment.Center
                            ) {
                                if (exDone) Icon(Icons.Default.Check, null, tint = Color.White, modifier = Modifier.size(16.dp))
                                else Text("${idx+1}", fontSize = 13.sp, fontWeight = FontWeight.Bold,
                                    color = if (isSelected) Color.White else TextSecondary)
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(name, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                                    color = if (isSelected) AppleBlue else TextPrimary)
                                if (muscle.isNotBlank())
                                    Text(muscle, fontSize = 12.sp, color = TextSecondary)
                            }
                            // Series badge
                            Box(Modifier.clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) AppleBlue.copy(alpha=0.1f) else Color(0xFFEEEEEE))
                                .padding(horizontal=8.dp, vertical=3.dp)) {
                                Text("${re.sets}x${re.reps}", fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                    color = if (isSelected) AppleBlue else TextSecondary)
                            }
                        }
                    }
                }
            }
        }
    }

    // ─── Rest timer config dialog ───────────────────────────────────────────────
    if (showRestConfig) {
        RestTimerConfigDialog(
            current = defaultRest,
            onConfirm = { secs ->
                workoutViewModel.setDefaultRest(secs)
                prefs.edit().putInt("default_rest_seconds", secs).apply()
                showRestConfig = false
            },
            onDismiss = { showRestConfig = false }
        )
    }

    // ─── MAIN LAYOUT ────────────────────────────────────────────────────────────
    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF2F6FF))) {

        // TOP BAR
        Box(
            modifier = Modifier.fillMaxWidth()
                .background(Brush.linearGradient(listOf(AppleBlue.copy(alpha = 0.1f), AppleTeal.copy(alpha = 0.06f))))
                .statusBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp)
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver", tint = TextPrimary)
                }
                // Center: exercise counter + elapsed + tap to open selector
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.clip(RoundedCornerShape(12.dp))
                        .clickable { showExerciseSelector = true }
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Ejercicio ${currentIndex + 1} / ${routineExercises.size}",
                            fontSize = 13.sp, fontWeight = FontWeight.Bold, color = AppleBlue)
                        Spacer(Modifier.width(4.dp))
                        Icon(Icons.Default.SwapVert, null, tint = AppleBlue, modifier = Modifier.size(14.dp))
                    }
                    if (WorkoutForegroundService.isRunning)
                        Text("${fmt(elapsedDisplay)}", fontSize = 11.sp, color = AppleEmerald)
                }
                val doneSets = setData.count { it.third }
                WChip(if (isDone) "✅ Listo" else "$doneSets/$totalSets", if (isDone) AppleEmerald else AppleBlue)
            }
        }

        // DAY PROGRESS BAR
        val dayDone = workoutViewModel.completedExercises.count { id -> routineExercises.any { it.exerciseId == id } }
        LinearProgressIndicator(
            progress = { if (routineExercises.isNotEmpty()) dayDone.toFloat() / routineExercises.size else 0f },
            modifier = Modifier.fillMaxWidth().height(3.dp),
            color = AppleEmerald, trackColor = GlassBorderWhite
        )

        // SCROLLABLE CONTENT
        Column(modifier = Modifier.weight(1f).verticalScroll(scrollState).padding(horizontal = 16.dp)) {
            Spacer(Modifier.height(12.dp))

            // GIF
            Box(
                modifier = Modifier.fillMaxWidth().height(210.dp).clip(RoundedCornerShape(20.dp))
                    .background(AppleBlue.copy(alpha = 0.07f)),
                contentAlignment = Alignment.Center
            ) {
                if (mediaUrl != null) {
                    AsyncImage(
                        model = ImageRequest.Builder(context).data(mediaUrl).crossfade(true).build(),
                        imageLoader = imageLoader,
                        contentDescription = exName,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(20.dp))
                    )
                } else {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.FitnessCenter, null, tint = AppleBlue.copy(alpha = 0.35f), modifier = Modifier.size(56.dp))
                        Text("Sin animacion", fontSize = 12.sp, color = TextSecondary)
                    }
                }
                if (isDone) {
                    Box(Modifier.fillMaxSize().background(AppleEmerald.copy(alpha = 0.78f)).clip(RoundedCornerShape(20.dp)),
                        contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.CheckCircle, null, tint = Color.White, modifier = Modifier.size(56.dp))
                            Text("Completado!", fontWeight = FontWeight.ExtraBold, color = Color.White, fontSize = 18.sp)
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))
            Text(exName, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                if (routineEx.muscleGroup.isNotBlank()) WChip(routineEx.muscleGroup, AppleTeal)
                WChip("${routineEx.sets}x${routineEx.reps} reps", AppleBlue)
                if (routineEx.targetWeightKg > 0) WChip("Meta: ${String.format("%.1f", routineEx.targetWeightKg)}kg", AppleIndigo)
            }
            Spacer(Modifier.height(12.dp))

            // INSTRUCTIONS
            if (instructions.isNotBlank()) {
                GlassCard(modifier = Modifier.fillMaxWidth().clickable { showInstructions = !showInstructions },
                    backgroundColor = GlassSurfaceWhite, borderColor = GlassBorderWhite) {
                    Column {
                        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.MenuBook, null, tint = AppleBlue, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(8.dp))
                                Text("Instrucciones", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                            }
                            Icon(if (showInstructions) Icons.Default.ExpandLess else Icons.Default.ExpandMore, null, tint = TextSecondary)
                        }
                        AnimatedVisibility(showInstructions) {
                            Column(Modifier.padding(top = 10.dp)) {
                                instructions.split(". ").filter { it.isNotBlank() }.forEachIndexed { i, step ->
                                    Row(Modifier.padding(bottom = 8.dp), verticalAlignment = Alignment.Top) {
                                        Box(Modifier.size(22.dp).clip(CircleShape).background(AppleBlue.copy(alpha=0.12f)), Alignment.Center) {
                                            Text("${i+1}", fontSize=11.sp, fontWeight=FontWeight.Bold, color=AppleBlue)
                                        }
                                        Spacer(Modifier.width(10.dp))
                                        Text(step.trimEnd('.').trim().replaceFirstChar { it.uppercase() } + ".",
                                            fontSize=13.sp, color=TextSecondary, lineHeight=18.sp, modifier=Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
            }

            // SETS TRACKER
            Text("Series", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
            Spacer(Modifier.height(8.dp))
            setData.forEachIndexed { idx, (w, r, done) ->
                val isActive = idx == currentSetIndex && !allSetsDone && !isDone
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(when { done -> AppleEmerald.copy(alpha=0.1f); isActive -> AppleBlue.copy(alpha=0.08f); else -> Color(0xFFF0F4FF) })
                        .border(1.dp, when { done -> AppleEmerald.copy(alpha=0.4f); isActive -> AppleBlue.copy(alpha=0.4f); else -> GlassBorderWhite }, RoundedCornerShape(14.dp))
                        .padding(horizontal=14.dp, vertical=10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(Modifier.size(28.dp).clip(CircleShape).background(when { done->AppleEmerald; isActive->AppleBlue; else->GlassBorderWhite }), Alignment.Center) {
                        if (done) Icon(Icons.Default.Check, null, tint=Color.White, modifier=Modifier.size(16.dp))
                        else Text("${idx+1}", fontSize=12.sp, fontWeight=FontWeight.Bold, color=if(isActive) Color.White else TextSecondary)
                    }
                    Spacer(Modifier.width(12.dp))
                    when {
                        done -> { val dw = if (useKg) w else w/0.453592; Text("${String.format("%.1f",dw)}${if(useKg)"kg" else "lbs"}  ×  $r reps",
                            fontSize=14.sp, fontWeight=FontWeight.SemiBold, color=AppleEmerald, modifier=Modifier.weight(1f)) }
                        isActive -> Text("Serie activa", fontSize=13.sp, color=AppleBlue, fontWeight=FontWeight.Bold, modifier=Modifier.weight(1f))
                        else -> Text("Pendiente", fontSize=13.sp, color=TextSecondary, modifier=Modifier.weight(1f))
                    }
                }
            }
            Spacer(Modifier.height(12.dp))

            // INPUT CARD
            if (!isDone && !allSetsDone) {
                GlassCard(modifier=Modifier.fillMaxWidth(), backgroundColor=GlassSurfaceWhite, borderColor=AppleBlue.copy(alpha=0.2f)) {
                    Column {
                        Text("Registrar Serie ${currentSetIndex + 1} de $totalSets",
                            fontWeight=FontWeight.Bold, fontSize=14.sp, color=AppleBlue)
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                            Column(Modifier.weight(1f)) {
                                Text("Peso (${if(useKg)"kg" else "lbs"})", fontSize=12.sp, color=TextSecondary, fontWeight=FontWeight.Bold)
                                Spacer(Modifier.height(4.dp))
                                Row(verticalAlignment=Alignment.CenterVertically) {
                                    WStepBtn("-") { val v=weightInput.toDoubleOrNull()?:0.0; weightInput=String.format("%.1f",(v-2.5).coerceAtLeast(0.0)) }
                                    Spacer(Modifier.width(4.dp))
                                    OutlinedTextField(value=weightInput, onValueChange={ weightInput=it.filter{c->c.isDigit()||c=='.'} },
                                        modifier=Modifier.weight(1f),
                                        textStyle=TextStyle(textAlign=TextAlign.Center, fontSize=17.sp, fontWeight=FontWeight.Bold),
                                        singleLine=true, shape=RoundedCornerShape(12.dp),
                                        colors=OutlinedTextFieldDefaults.colors(focusedBorderColor=AppleBlue, unfocusedBorderColor=GlassBorderWhite),
                                        keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal))
                                    Spacer(Modifier.width(4.dp))
                                    WStepBtn("+") { val v=weightInput.toDoubleOrNull()?:0.0; weightInput=String.format("%.1f",v+2.5) }
                                }
                            }
                            Column(Modifier.weight(1f)) {
                                Text("Reps", fontSize=12.sp, color=TextSecondary, fontWeight=FontWeight.Bold)
                                Spacer(Modifier.height(4.dp))
                                Row(verticalAlignment=Alignment.CenterVertically) {
                                    WStepBtn("-") { val v=repsInput.toIntOrNull()?:1; repsInput=(v-1).coerceAtLeast(1).toString() }
                                    Spacer(Modifier.width(4.dp))
                                    OutlinedTextField(value=repsInput, onValueChange={ repsInput=it.filter{c->c.isDigit()} },
                                        modifier=Modifier.weight(1f),
                                        textStyle=TextStyle(textAlign=TextAlign.Center, fontSize=17.sp, fontWeight=FontWeight.Bold),
                                        singleLine=true, shape=RoundedCornerShape(12.dp),
                                        colors=OutlinedTextFieldDefaults.colors(focusedBorderColor=AppleBlue, unfocusedBorderColor=GlassBorderWhite),
                                        keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number))
                                    Spacer(Modifier.width(4.dp))
                                    WStepBtn("+") { val v=repsInput.toIntOrNull()?:0; repsInput=(v+1).toString() }
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(Modifier.fillMaxWidth(), Arrangement.End, Alignment.CenterVertically) {
                            Text("lbs", fontSize=12.sp, color=if(!useKg) AppleBlue else TextSecondary)
                            Switch(checked=useKg, onCheckedChange={ isKg ->
                                val cur=weightInput.toDoubleOrNull()?:0.0
                                useKg=isKg
                                weightInput=if(isKg) String.format("%.1f",cur*0.453592) else String.format("%.1f",cur/0.453592)
                                prefs.edit().putBoolean("use_kg_unit",isKg).apply()
                            }, colors=SwitchDefaults.colors(checkedThumbColor=AppleBlue, checkedTrackColor=AppleBlue.copy(alpha=0.4f)),
                                modifier=Modifier.padding(horizontal=6.dp))
                            Text("kg", fontSize=12.sp, color=if(useKg) AppleBlue else TextSecondary)
                        }
                        Spacer(Modifier.height(8.dp))
                        Button(
                            onClick = {
                                if (saving) return@Button
                                saving = true
                                val weightKg = toKg()
                                val r = repsInput.toIntOrNull() ?: routineEx.reps
                                // Actual rest taken since last set
                                val actualRest = workoutViewModel.getActualRestTaken().takeIf { it > 0 }
                                scope.launch {
                                    try {
                                        val entity = SetLogEntity(
                                            id = UUID.randomUUID().toString(),
                                            exerciseId = routineEx.exerciseId,
                                            exerciseName = exName,
                                            weightKg = weightKg,
                                            reps = r, rpe = 7.0,
                                            setNumber = currentSetIndex + 1,
                                            isSynced = false
                                        )
                                        dao.insertSetLog(entity)
                                        if (ServerRepository.isLoggedIn()) {
                                            try {
                                                ServerRepository.logSetToServer(
                                                    exerciseId = routineEx.exerciseId,
                                                    exerciseName = exName,
                                                    setNumber = currentSetIndex + 1,
                                                    reps = r, weightKg = weightKg, rpe = 7.0,
                                                    sessionId = WorkoutForegroundService.sessionId,
                                                    restSeconds = actualRest
                                                )
                                                dao.markSynced(entity.id)
                                            } catch (_: Exception) {}
                                        }
                                        val updated = setData.toMutableList().also { it[currentSetIndex] = Triple(weightKg, r, true) }
                                        setData = updated
                                        workoutViewModel.updateSetProgress(routineEx.exerciseId, updated)
                                        if (currentSetIndex < totalSets - 1) {
                                            currentSetIndex++
                                            weightInput = String.format("%.1f", if(useKg) weightKg else weightKg/0.453592)
                                            repsInput = r.toString()
                                        }
                                        workoutViewModel.startRestTimer()
                                        SyncWorkoutWorker.scheduleSync(context)
                                    } finally { saving = false }
                                }
                            },
                            modifier=Modifier.fillMaxWidth().height(52.dp), shape=RoundedCornerShape(16.dp),
                            colors=ButtonDefaults.buttonColors(containerColor=AppleBlue),
                            enabled=!saving && weightInput.isNotBlank() && repsInput.isNotBlank()
                        ) {
                            if (saving) CircularProgressIndicator(color=Color.White, modifier=Modifier.size(20.dp), strokeWidth=2.dp)
                            else {
                                Icon(Icons.Default.Check, null, tint=Color.White, modifier=Modifier.size(20.dp))
                                Spacer(Modifier.width(8.dp))
                                Text("Registrar Serie ${currentSetIndex + 1}", color=Color.White, fontWeight=FontWeight.Bold, fontSize=15.sp)
                            }
                        }
                    }
                }
            }

            // MARK COMPLETE / NEXT
            if (allSetsDone && !isDone) {
                Spacer(Modifier.height(10.dp))
                val hasNext = currentIndex + 1 < routineExercises.size
                Button(
                    onClick = {
                        workoutViewModel.markCompleted(routineEx.exerciseId)
                        SyncWorkoutWorker.scheduleSync(context)
                        if (hasNext) { currentIndex++; workoutViewModel.openExercise(routineExercises[currentIndex].exerciseId) }
                        else onBack()
                    },
                    modifier=Modifier.fillMaxWidth().height(52.dp), shape=RoundedCornerShape(16.dp),
                    colors=ButtonDefaults.buttonColors(containerColor=AppleEmerald)
                ) {
                    Icon(if(currentIndex+1<routineExercises.size) Icons.AutoMirrored.Filled.ArrowForward else Icons.Default.CheckCircle,
                        null, tint=Color.White, modifier=Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if(currentIndex+1<routineExercises.size) "Completar y siguiente" else "Terminar entrenamiento!",
                        color=Color.White, fontWeight=FontWeight.ExtraBold, fontSize=15.sp)
                }
            }
            Spacer(Modifier.height(16.dp))
        }

        // ─── BOTTOM: REST TIMER + NAV ─────────────────────────────────────────
        Column(Modifier.fillMaxWidth().background(Color.White).navigationBarsPadding()) {

            // REST TIMER — tap anywhere to configure
            AnimatedVisibility(restRunning || restTimer > 0) {
                val timerColor = when { restTimer > 30 -> AppleTeal; restTimer > 10 -> AppleOrange; else -> AppleRose }
                Column(Modifier.fillMaxWidth().background(timerColor.copy(alpha=0.08f))
                    .clickable { showRestConfig = true }
                    .padding(horizontal=16.dp, vertical=8.dp)
                ) {
                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                        Row(verticalAlignment=Alignment.CenterVertically) {
                            Icon(Icons.Default.Timer, null, tint=timerColor, modifier=Modifier.size(20.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Descanso: ${fmt(restTimer)}", fontWeight=FontWeight.ExtraBold, fontSize=16.sp, color=timerColor)
                        }
                        Row(verticalAlignment=Alignment.CenterVertically) {
                            TextButton(onClick={ workoutViewModel.addRestTime(30) }) { Text("+30s", color=AppleTeal, fontWeight=FontWeight.Bold) }
                            // Settings icon → config
                            IconButton(onClick={ showRestConfig=true }, modifier=Modifier.size(32.dp)) {
                                Icon(Icons.Default.Settings, null, tint=TextSecondary, modifier=Modifier.size(18.dp))
                            }
                            IconButton(onClick={ workoutViewModel.cancelRestTimer() }, modifier=Modifier.size(32.dp)) {
                                Icon(Icons.Default.Close, null, tint=TextSecondary, modifier=Modifier.size(18.dp))
                            }
                        }
                    }
                    LinearProgressIndicator(
                        progress={ (restTimer.toFloat()/defaultRest.toFloat().coerceAtLeast(1f)).coerceIn(0f,1f) },
                        modifier=Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(2.dp)),
                        color=timerColor, trackColor=GlassBorderWhite
                    )
                    Text("Descanso por defecto: ${fmt(defaultRest)}  •  Toca para cambiar",
                        fontSize=11.sp, color=timerColor.copy(alpha=0.7f), textAlign=TextAlign.Center,
                        modifier=Modifier.fillMaxWidth().padding(top=3.dp))
                }
            }

            // REST TIMER COLLAPSED — show config button when no timer
            AnimatedVisibility(!restRunning && restTimer == 0) {
                Row(Modifier.fillMaxWidth().padding(horizontal=16.dp, vertical=4.dp), Arrangement.End) {
                    TextButton(onClick={ showRestConfig=true }) {
                        Icon(Icons.Default.Timer, null, modifier=Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Descanso: ${fmt(defaultRest)}", fontSize=12.sp, color=TextSecondary)
                        Spacer(Modifier.width(4.dp))
                        Icon(Icons.Default.Settings, null, modifier=Modifier.size(12.dp))
                    }
                }
            }

            HorizontalDivider(color=GlassBorderWhite)

            // PREV / DOTS / NEXT
            Row(Modifier.fillMaxWidth().padding(horizontal=12.dp, vertical=6.dp), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                TextButton(onClick={if(currentIndex>0){currentIndex--;workoutViewModel.openExercise(routineExercises[currentIndex].exerciseId)}}, enabled=currentIndex>0) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, null, modifier=Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp)); Text("Anterior")
                }
                Row(horizontalArrangement=Arrangement.spacedBy(5.dp), verticalAlignment=Alignment.CenterVertically) {
                    routineExercises.forEachIndexed { idx, re ->
                        val exDone = workoutViewModel.completedExercises.contains(re.exerciseId)
                        Box(Modifier.size(if(idx==currentIndex) 10.dp else 7.dp).clip(CircleShape)
                            .background(when{exDone->AppleEmerald;idx==currentIndex->AppleBlue;else->GlassBorderWhite})
                            .clickable{currentIndex=idx;workoutViewModel.openExercise(re.exerciseId)})
                    }
                }
                TextButton(onClick={if(currentIndex<routineExercises.size-1){currentIndex++;workoutViewModel.openExercise(routineExercises[currentIndex].exerciseId)}}, enabled=currentIndex<routineExercises.size-1) {
                    Text("Siguiente"); Spacer(Modifier.width(4.dp))
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, null, modifier=Modifier.size(16.dp))
                }
            }
        }
    }
}

// ─── Rest Timer Config Dialog ─────────────────────────────────────────────────
@Composable
private fun RestTimerConfigDialog(current: Int, onConfirm: (Int) -> Unit, onDismiss: () -> Unit) {
    val presets = listOf(30 to "30s", 45 to "45s", 60 to "1 min", 90 to "1:30", 120 to "2 min", 180 to "3 min", 240 to "4 min")
    var selected by remember { mutableStateOf(current) }
    var customInput by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Color.White).padding(24.dp)
        ) {
            Text("Tiempo de descanso", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = TextPrimary)
            Text("Se aplicará al registrar cada serie", fontSize = 13.sp, color = TextSecondary)
            Spacer(Modifier.height(16.dp))

            // Presets grid
            val rows = presets.chunked(4)
            rows.forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { (secs, label) ->
                        val isSel = selected == secs
                        Box(
                            Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
                                .background(if (isSel) AppleBlue else Color(0xFFF0F4FF))
                                .border(1.dp, if (isSel) AppleBlue else GlassBorderWhite, RoundedCornerShape(12.dp))
                                .clickable { selected = secs; customInput = "" }
                                .padding(vertical = 10.dp),
                            Alignment.Center
                        ) {
                            Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                                color = if (isSel) Color.White else TextPrimary, textAlign = TextAlign.Center)
                        }
                    }
                    // Fill remaining cells if row is not full
                    repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
                }
                Spacer(Modifier.height(8.dp))
            }

            // Custom input
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = customInput,
                    onValueChange = { v ->
                        customInput = v.filter { it.isDigit() }
                        v.toIntOrNull()?.let { selected = it }
                    },
                    modifier = Modifier.weight(1f),
                    label = { Text("Personalizado (seg)") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AppleBlue, unfocusedBorderColor = GlassBorderWhite),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
                Text(String.format("%02d:%02d", selected/60, selected%60),
                    fontWeight = FontWeight.ExtraBold, fontSize = 22.sp, color = AppleBlue)
            }
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick=onDismiss, modifier=Modifier.weight(1f), shape=RoundedCornerShape(14.dp)) { Text("Cancelar") }
                Button(onClick={ onConfirm(selected) }, modifier=Modifier.weight(1f), shape=RoundedCornerShape(14.dp),
                    colors=ButtonDefaults.buttonColors(containerColor=AppleBlue)) {
                    Text("Guardar", color=Color.White, fontWeight=FontWeight.Bold)
                }
            }
        }
    }
}

// ─── Private helpers ──────────────────────────────────────────────────────────
@Composable
private fun WChip(text: String, color: Color) {
    Box(Modifier.clip(RoundedCornerShape(20.dp)).background(color.copy(alpha=0.12f)).padding(horizontal=10.dp, vertical=4.dp)) {
        Text(text, fontSize=12.sp, color=color, fontWeight=FontWeight.Bold)
    }
}

@Composable
private fun WStepBtn(label: String, onClick: () -> Unit) {
    Box(Modifier.size(34.dp).clip(CircleShape).background(AppleBlue.copy(alpha=0.1f)).clickable(onClick=onClick), Alignment.Center) {
        Text(label, fontSize=18.sp, fontWeight=FontWeight.Bold, color=AppleBlue)
    }
}
