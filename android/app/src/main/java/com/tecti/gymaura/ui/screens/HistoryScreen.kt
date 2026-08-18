package com.tecti.gymaura.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tecti.gymaura.data.local.AppDatabase
import com.tecti.gymaura.data.local.SetLogEntity
import com.tecti.gymaura.ui.theme.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * HistoryScreen — Pestaña de historial de entrenamiento local.
 *
 * Agrupa los SetLog del Room DB por Día > Ejercicio.
 * Permite borrar: serie individual, grupo por ejercicio+día, día entero, o todo.
 * Útil para pruebas y análisis.
 */
@Composable
fun HistoryScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val dao = remember { AppDatabase.getDatabase(context).setLogDao() }

    // Observe all set logs as Flow
    val allLogs by dao.getAllSetLogs().collectAsState(initial = emptyList())

    // Group by day
    val grouped = remember(allLogs) { groupByDay(allLogs) }

    var showDeleteAllDialog by remember { mutableStateOf(false) }
    var expandedDays by remember { mutableStateOf(setOf<String>()) }     // which day keys are expanded
    var expandedGroups by remember { mutableStateOf(setOf<String>()) }   // which exerciseId+dayKey are expanded

    // ─── Confirm delete all ────────────────────────────────────────────────────
    if (showDeleteAllDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteAllDialog = false },
            icon = { Icon(Icons.Default.DeleteForever, null, tint = Color(0xFFEF4444)) },
            title = { Text("Borrar todo el historial", fontWeight = FontWeight.ExtraBold) },
            text = { Text("Se eliminarán TODAS las series registradas localmente. Esta acción no se puede deshacer.") },
            confirmButton = {
                Button(onClick = {
                    scope.launch { dao.deleteAll(); showDeleteAllDialog = false }
                }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))) {
                    Text("Borrar todo", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteAllDialog = false }) { Text("Cancelar") }
            }
        )
    }

    // ─── LAYOUT ────────────────────────────────────────────────────────────────
    Column(Modifier.fillMaxSize().background(Color(0xFFF2F6FF))) {

        // Header
        Row(
            Modifier.fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 20.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Historial", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                Text("${allLogs.size} series registradas", fontSize = 13.sp, color = TextSecondary)
            }
            if (allLogs.isNotEmpty()) {
                IconButton(onClick = { showDeleteAllDialog = true }) {
                    Icon(Icons.Default.DeleteSweep, "Borrar todo", tint = Color(0xFFEF4444))
                }
            }
        }
        HorizontalDivider(color = GlassBorderWhite)

        if (allLogs.isEmpty()) {
            // Empty state
            Box(Modifier.fillMaxSize(), Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Default.FitnessCenter, null, tint = AppleBlue.copy(alpha = 0.25f), modifier = Modifier.size(72.dp))
                    Text("Sin historial todavía", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextSecondary)
                    Text("Inicia un entrenamiento y registra\ntus series para verlas aquí.",
                        fontSize = 14.sp, color = TextSecondary, textAlign = TextAlign.Center)
                }
            }
            return@Column
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(grouped, key = { it.dayKey }) { dayGroup ->
                DayCard(
                    dayGroup = dayGroup,
                    isExpanded = dayGroup.dayKey in expandedDays,
                    expandedGroups = expandedGroups,
                    onToggleDay = { key ->
                        expandedDays = if (key in expandedDays) expandedDays - key else expandedDays + key
                    },
                    onToggleGroup = { key ->
                        expandedGroups = if (key in expandedGroups) expandedGroups - key else expandedGroups + key
                    },
                    onDeleteSet = { id -> scope.launch { dao.deleteById(id) } },
                    onDeleteExerciseDay = { exId, start, end ->
                        scope.launch { dao.deleteByExerciseAndDay(exId, start, end) }
                    },
                    onDeleteDay = { start, end ->
                        scope.launch { dao.deleteByDay(start, end) }
                    }
                )
            }
        }
    }
}

// ─── Day Card ─────────────────────────────────────────────────────────────────
@Composable
private fun DayCard(
    dayGroup: DayGroup,
    isExpanded: Boolean,
    expandedGroups: Set<String>,
    onToggleDay: (String) -> Unit,
    onToggleGroup: (String) -> Unit,
    onDeleteSet: (String) -> Unit,
    onDeleteExerciseDay: (String, Long, Long) -> Unit,
    onDeleteDay: (Long, Long) -> Unit
) {
    var showDeleteDayDialog by remember { mutableStateOf(false) }

    if (showDeleteDayDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDayDialog = false },
            title = { Text("Borrar día completo", fontWeight = FontWeight.ExtraBold) },
            text = { Text("¿Borrar todas las series del ${dayGroup.label}?") },
            confirmButton = {
                Button(onClick = {
                    onDeleteDay(dayGroup.dayStart, dayGroup.dayEnd)
                    showDeleteDayDialog = false
                }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))) {
                    Text("Borrar", color = Color.White)
                }
            },
            dismissButton = { TextButton(onClick = { showDeleteDayDialog = false }) { Text("Cancelar") } }
        )
    }

    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .border(1.dp, GlassBorderWhite, RoundedCornerShape(20.dp))
    ) {
        // Day header
        Row(
            Modifier.fillMaxWidth()
                .clickable { onToggleDay(dayGroup.dayKey) }
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                        .background(AppleBlue.copy(alpha = 0.1f)),
                    Alignment.Center
                ) {
                    Text(dayGroup.dayNumber, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = AppleBlue)
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(dayGroup.label, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = TextPrimary)
                    Text("${dayGroup.exercises.size} ejercicios · ${dayGroup.totalSets} series · ${String.format("%.1f", dayGroup.totalVolume)}kg vol.",
                        fontSize = 12.sp, color = TextSecondary)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { showDeleteDayDialog = true }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Delete, null, tint = Color(0xFFEF4444).copy(alpha = 0.6f), modifier = Modifier.size(18.dp))
                }
                Icon(if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, null, tint = TextSecondary)
            }
        }

        // Exercises in the day
        AnimatedVisibility(isExpanded) {
            Column(Modifier.padding(bottom = 8.dp)) {
                HorizontalDivider(color = GlassBorderWhite, modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(Modifier.height(6.dp))
                dayGroup.exercises.forEach { exGroup ->
                    ExerciseGroup(
                        exGroup = exGroup,
                        dayGroup = dayGroup,
                        isExpanded = "${exGroup.exerciseId}_${dayGroup.dayKey}" in expandedGroups,
                        onToggle = { onToggleGroup("${exGroup.exerciseId}_${dayGroup.dayKey}") },
                        onDeleteSet = onDeleteSet,
                        onDeleteExerciseDay = onDeleteExerciseDay
                    )
                }
            }
        }
    }
}

// ─── Exercise Group within a day ──────────────────────────────────────────────
@Composable
private fun ExerciseGroup(
    exGroup: ExerciseGroup,
    dayGroup: DayGroup,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    onDeleteSet: (String) -> Unit,
    onDeleteExerciseDay: (String, Long, Long) -> Unit
) {
    var showDeleteExDialog by remember { mutableStateOf(false) }

    if (showDeleteExDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteExDialog = false },
            title = { Text("Borrar ejercicio", fontWeight = FontWeight.ExtraBold) },
            text = { Text("¿Borrar todas las series de \"${exGroup.exerciseName}\" del ${dayGroup.label}?") },
            confirmButton = {
                Button(onClick = {
                    onDeleteExerciseDay(exGroup.exerciseId, dayGroup.dayStart, dayGroup.dayEnd)
                    showDeleteExDialog = false
                }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))) {
                    Text("Borrar", color = Color.White)
                }
            },
            dismissButton = { TextButton(onClick = { showDeleteExDialog = false }) { Text("Cancelar") } }
        )
    }

    Column(Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
        // Exercise row header
        Row(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(Color(0xFFF5F8FF))
                .clickable { onToggle() }
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(28.dp).clip(CircleShape).background(AppleTeal.copy(alpha = 0.12f)), Alignment.Center) {
                    Icon(Icons.Default.FitnessCenter, null, tint = AppleTeal, modifier = Modifier.size(14.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(exGroup.exerciseName, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    // Summary: best set + volume
                    val best = exGroup.sets.maxByOrNull { it.weightKg * it.reps }
                    val vol = exGroup.sets.sumOf { it.weightKg * it.reps }
                    Text("${exGroup.sets.size} series · vol ${String.format("%.0f", vol)}kg" +
                        (best?.let { " · mejor ${String.format("%.1f", it.weightKg)}kg×${it.reps}" } ?: ""),
                        fontSize = 11.sp, color = TextSecondary)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { showDeleteExDialog = true }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Delete, null, tint = Color(0xFFEF4444).copy(alpha = 0.55f), modifier = Modifier.size(16.dp))
                }
                Icon(if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, null, tint = TextSecondary, modifier = Modifier.size(18.dp))
            }
        }

        // Individual sets
        AnimatedVisibility(isExpanded) {
            Column(Modifier.padding(start = 12.dp, top = 4.dp)) {
                exGroup.sets.forEachIndexed { idx, set ->
                    SetRow(
                        index = idx,
                        set = set,
                        onDelete = { onDeleteSet(set.id) }
                    )
                }
            }
        }
    }
}

// ─── Individual set row ───────────────────────────────────────────────────────
@Composable
private fun SetRow(index: Int, set: SetLogEntity, onDelete: () -> Unit) {
    var showDeleteDialog by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Borrar serie", fontWeight = FontWeight.ExtraBold) },
            text = { Text("¿Borrar la Serie ${index + 1}: ${String.format("%.1f", set.weightKg)}kg × ${set.reps} reps?") },
            confirmButton = {
                Button(onClick = { onDelete(); showDeleteDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))) {
                    Text("Borrar", color = Color.White)
                }
            },
            dismissButton = { TextButton(onClick = { showDeleteDialog = false }) { Text("Cancelar") } }
        )
    }

    Row(
        Modifier.fillMaxWidth()
            .padding(vertical = 3.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (set.isSynced) AppleEmerald.copy(alpha = 0.05f) else AppleOrange.copy(alpha = 0.05f))
            .padding(horizontal = 10.dp, vertical = 7.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Set number badge
        Box(Modifier.size(22.dp).clip(CircleShape).background(AppleBlue.copy(alpha = 0.12f)), Alignment.Center) {
            Text("${index + 1}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AppleBlue)
        }
        Spacer(Modifier.width(8.dp))
        // Weight × reps
        Text(
            "${String.format("%.1f", set.weightKg)} kg  ×  ${set.reps} reps",
            fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = TextPrimary,
            modifier = Modifier.weight(1f)
        )
        // Sync state badge
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (set.isSynced) {
                Icon(Icons.Default.CloudDone, "Sincronizado", tint = AppleEmerald, modifier = Modifier.size(14.dp))
            } else {
                Icon(Icons.Default.CloudOff, "Pendiente sync", tint = AppleOrange, modifier = Modifier.size(14.dp))
            }
            Spacer(Modifier.width(6.dp))
            // Time
            Text(
                SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(set.timestamp)),
                fontSize = 11.sp, color = TextSecondary
            )
            Spacer(Modifier.width(4.dp))
            IconButton(onClick = { showDeleteDialog = true }, modifier = Modifier.size(24.dp)) {
                Icon(Icons.Default.Close, null, tint = Color(0xFFEF4444).copy(alpha = 0.5f), modifier = Modifier.size(14.dp))
            }
        }
    }
}

// ─── Data models ──────────────────────────────────────────────────────────────
private data class DayGroup(
    val dayKey: String,            // "2024-08-17"
    val label: String,             // "Domingo 17 agosto"
    val dayNumber: String,         // "17"
    val dayStart: Long,
    val dayEnd: Long,
    val exercises: List<ExerciseGroup>,
    val totalSets: Int,
    val totalVolume: Double
)

private data class ExerciseGroup(
    val exerciseId: String,
    val exerciseName: String,
    val sets: List<SetLogEntity>
)

private fun groupByDay(logs: List<SetLogEntity>): List<DayGroup> {
    if (logs.isEmpty()) return emptyList()
    val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val labelFmt = SimpleDateFormat("EEEE d MMMM", Locale("es", "MX"))
    val numFmt = SimpleDateFormat("d", Locale.getDefault())
    val cal = Calendar.getInstance()

    return logs
        .groupBy { runCatching { dayFmt.format(Date(it.timestamp)) }.getOrElse { "1970-01-01" } }
        .entries
        .sortedByDescending { it.key }
        .mapNotNull { (dayKey, daySets) ->
            runCatching {
                val date = dayFmt.parse(dayKey) ?: return@mapNotNull null
                cal.time = date
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                val dayStart = cal.timeInMillis
                cal.add(Calendar.DAY_OF_YEAR, 1)
                val dayEnd = cal.timeInMillis

                val exercises = daySets
                    .groupBy { it.exerciseId.ifBlank { "sin-ejercicio" } }
                    .map { (exId, exSets) ->
                        ExerciseGroup(
                            exerciseId = exId,
                            exerciseName = exSets.firstOrNull()
                                ?.exerciseName?.ifBlank { null }
                                ?: exId.ifBlank { "Ejercicio" },
                            sets = exSets.sortedBy { it.setNumber }
                        )
                    }

                DayGroup(
                    dayKey = dayKey,
                    label = runCatching {
                        labelFmt.format(date).replaceFirstChar { it.uppercase() }
                    }.getOrElse { dayKey },
                    dayNumber = runCatching { numFmt.format(date) }.getOrElse { "?" },
                    dayStart = dayStart,
                    dayEnd = dayEnd,
                    exercises = exercises,
                    totalSets = daySets.size,
                    totalVolume = daySets.sumOf { it.weightKg * it.reps }
                )
            }.getOrNull()
        }
}
