package com.tecti.gymaura.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.SyncDisabled
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

@Composable
fun HistoryScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var allLogs by remember { mutableStateOf<List<SetLogEntity>>(emptyList()) }
    var dbError by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    val dao = remember {
        try { AppDatabase.getDatabase(context).setLogDao() } catch (e: Exception) { null }
    }

    LaunchedEffect(dao) {
        if (dao == null) { dbError = "No se pudo abrir la BD"; isLoading = false; return@LaunchedEffect }
        try {
            dao.getAllSetLogs().collect { logs -> allLogs = logs; isLoading = false }
        } catch (e: Exception) {
            dbError = "Error: ${e.message}"; isLoading = false
        }
    }

    val grouped = remember(allLogs) {
        try { safeGroupByDay(allLogs) } catch (_: Exception) { emptyList() }
    }
    var showDeleteAllDialog by remember { mutableStateOf(false) }
    var expandedDays by remember { mutableStateOf(setOf<String>()) }
    var expandedGroups by remember { mutableStateOf(setOf<String>()) }

    if (showDeleteAllDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteAllDialog = false },
            icon = { Icon(Icons.Default.DeleteForever, null, tint = Color(0xFFEF4444)) },
            title = { Text("Borrar todo el historial", fontWeight = FontWeight.ExtraBold) },
            text = { Text("Se eliminarán TODAS las series registradas localmente.") },
            confirmButton = {
                Button(
                    onClick = { scope.launch { try { dao?.deleteAll() } catch (_: Exception) {}; showDeleteAllDialog = false } },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) { Text("Borrar todo", color = Color.White, fontWeight = FontWeight.Bold) }
            },
            dismissButton = { TextButton(onClick = { showDeleteAllDialog = false }) { Text("Cancelar") } }
        )
    }

    Column(Modifier.fillMaxSize().background(Color(0xFFF2F6FF))) {
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 20.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Historial", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                Text(if (isLoading) "Cargando..." else "${allLogs.size} series registradas", fontSize = 13.sp, color = TextSecondary)
            }
            if (allLogs.isNotEmpty()) {
                IconButton(onClick = { showDeleteAllDialog = true }) {
                    Icon(Icons.Default.DeleteForever, "Borrar todo", tint = Color(0xFFEF4444))
                }
            }
        }
        Divider(color = GlassBorderWhite, thickness = 0.5.dp)

        when {
            isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = AppleBlue) }
            dbError != null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Default.SyncDisabled, null, tint = AppleOrange, modifier = Modifier.size(56.dp))
                    Text("Error de base de datos", fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(dbError ?: "", fontSize = 13.sp, color = TextSecondary, textAlign = TextAlign.Center)
                }
            }
            allLogs.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Default.FitnessCenter, null, tint = AppleBlue.copy(alpha = 0.25f), modifier = Modifier.size(72.dp))
                    Text("Sin historial todavía", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextSecondary)
                    Text("Registra un entrenamiento para ver tu historial", fontSize = 14.sp, color = TextSecondary, textAlign = TextAlign.Center)
                }
            }
            else -> LazyColumn(
                contentPadding = PaddingValues(bottom = 100.dp, top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(grouped, key = { it.dayKey }) { dayGroup ->
                    val isDayExpanded = dayGroup.dayKey in expandedDays
                    DayCard(
                        dayGroup = dayGroup, isExpanded = isDayExpanded, expandedGroups = expandedGroups,
                        onToggleDay = { expandedDays = if (isDayExpanded) expandedDays - dayGroup.dayKey else expandedDays + dayGroup.dayKey },
                        onToggleExercise = { key -> expandedGroups = if (key in expandedGroups) expandedGroups - key else expandedGroups + key },
                        onDeleteDay = { scope.launch { try { dao?.deleteByDay(dayGroup.dayStart, dayGroup.dayEnd) } catch (_: Exception) {} } },
                        onDeleteExercise = { exId -> scope.launch { try { dao?.deleteByExerciseAndDay(exId, dayGroup.dayStart, dayGroup.dayEnd) } catch (_: Exception) {} } },
                        onDeleteSet = { id -> scope.launch { try { dao?.deleteById(id) } catch (_: Exception) {} } }
                    )
                }
            }
        }
    }
}

@Composable
private fun DayCard(
    dayGroup: DayGroup, isExpanded: Boolean, expandedGroups: Set<String>,
    onToggleDay: () -> Unit, onToggleExercise: (String) -> Unit,
    onDeleteDay: () -> Unit, onDeleteExercise: (String) -> Unit, onDeleteSet: (String) -> Unit
) {
    var showDeleteDayDialog by remember { mutableStateOf(false) }
    if (showDeleteDayDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDayDialog = false },
            title = { Text("Borrar dia", fontWeight = FontWeight.ExtraBold) },
            text = { Text("Borrar todas las series del ${dayGroup.label}?") },
            confirmButton = { Button(onClick = { onDeleteDay(); showDeleteDayDialog = false }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))) { Text("Borrar", color = Color.White) } },
            dismissButton = { TextButton(onClick = { showDeleteDayDialog = false }) { Text("Cancelar") } }
        )
    }
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column {
            Row(
                Modifier.fillMaxWidth().clickable { onToggleDay() }.padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.size(42.dp).clip(CircleShape).background(AppleBlue.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                        Text(dayGroup.dayNumber, fontWeight = FontWeight.ExtraBold, color = AppleBlue, fontSize = 16.sp)
                    }
                    Column {
                        Text(dayGroup.label, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                        Text("${dayGroup.exercises.size} ejercicios - ${dayGroup.totalSets} series - ${String.format("%.0f", dayGroup.totalVolume)}kg", fontSize = 12.sp, color = TextSecondary)
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { showDeleteDayDialog = true }, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Delete, null, tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                    }
                    Icon(if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, null, tint = TextSecondary)
                }
            }
            AnimatedVisibility(visible = isExpanded, enter = expandVertically(), exit = shrinkVertically()) {
                Column(Modifier.padding(bottom = 8.dp)) {
                    dayGroup.exercises.forEach { exGroup ->
                        val groupKey = "${exGroup.exerciseId}_${dayGroup.dayKey}"
                        ExerciseGroupRow(
                            exGroup = exGroup,
                            isExpanded = groupKey in expandedGroups,
                            onToggle = { onToggleExercise(groupKey) },
                            onDeleteExercise = { onDeleteExercise(exGroup.exerciseId) },
                            onDeleteSet = onDeleteSet
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ExerciseGroupRow(
    exGroup: ExerciseGroup, isExpanded: Boolean,
    onToggle: () -> Unit, onDeleteExercise: () -> Unit, onDeleteSet: (String) -> Unit
) {
    var showDialog by remember { mutableStateOf(false) }
    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            title = { Text("Borrar ejercicio", fontWeight = FontWeight.ExtraBold) },
            text = { Text("Borrar todas las series de ${exGroup.exerciseName}?") },
            confirmButton = { Button(onClick = { onDeleteExercise(); showDialog = false }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))) { Text("Borrar", color = Color.White) } },
            dismissButton = { TextButton(onClick = { showDialog = false }) { Text("Cancelar") } }
        )
    }
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 3.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFFF8FAFF))) {
        Row(
            Modifier.fillMaxWidth().clickable { onToggle() }.padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(exGroup.exerciseName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = TextPrimary)
                val vol = exGroup.sets.sumOf { it.weightKg * it.reps }
                val best = exGroup.sets.maxByOrNull { it.weightKg }
                Text("${exGroup.sets.size} series - vol ${String.format("%.0f", vol)}kg" + (best?.let { " - mejor ${String.format("%.0f", it.weightKg)}kgx${it.reps}" } ?: ""), fontSize = 11.sp, color = TextSecondary)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { showDialog = true }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Delete, null, tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                }
                Icon(if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, null, tint = TextSecondary, modifier = Modifier.size(20.dp))
            }
        }
        AnimatedVisibility(visible = isExpanded, enter = expandVertically(), exit = shrinkVertically()) {
            Column(Modifier.padding(start = 14.dp, end = 14.dp, bottom = 10.dp)) {
                exGroup.sets.forEachIndexed { index, set ->
                    SetRow(index = index, set = set, onDelete = { onDeleteSet(set.id) })
                }
            }
        }
    }
}

@Composable
private fun SetRow(index: Int, set: SetLogEntity, onDelete: () -> Unit) {
    var showDialog by remember { mutableStateOf(false) }
    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            title = { Text("Borrar serie", fontWeight = FontWeight.ExtraBold) },
            text = { Text("Serie ${index + 1}: ${String.format("%.1f", set.weightKg)}kg x ${set.reps} reps") },
            confirmButton = { Button(onClick = { onDelete(); showDialog = false }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))) { Text("Borrar", color = Color.White) } },
            dismissButton = { TextButton(onClick = { showDialog = false }) { Text("Cancelar") } }
        )
    }
    Row(
        Modifier.fillMaxWidth().padding(vertical = 3.dp).clip(RoundedCornerShape(8.dp))
            .background(if (set.isSynced) AppleEmerald.copy(alpha = 0.05f) else AppleOrange.copy(alpha = 0.05f))
            .padding(horizontal = 10.dp, vertical = 7.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(22.dp).clip(CircleShape).background(AppleBlue), contentAlignment = Alignment.Center) {
                Text("${index + 1}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
            Text("${String.format("%.1f", set.weightKg)} kg x ${set.reps} reps", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = TextPrimary)
            if (set.rpe > 0) Text("RPE ${set.rpe}", fontSize = 11.sp, color = TextSecondary)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(if (set.isSynced) Icons.Default.Sync else Icons.Default.SyncDisabled, null,
                tint = if (set.isSynced) AppleEmerald else AppleOrange, modifier = Modifier.size(14.dp))
            val fmt = SimpleDateFormat("HH:mm", Locale.getDefault())
            Text(try { fmt.format(Date(set.timestamp)) } catch (_: Exception) { "--:--" }, fontSize = 11.sp, color = TextSecondary)
            IconButton(onClick = { showDialog = true }, modifier = Modifier.size(24.dp)) {
                Icon(Icons.Default.Delete, null, tint = Color(0xFFEF4444), modifier = Modifier.size(14.dp))
            }
        }
    }
}

private data class DayGroup(val dayKey: String, val label: String, val dayNumber: String, val dayStart: Long, val dayEnd: Long, val exercises: List<ExerciseGroup>, val totalSets: Int, val totalVolume: Double)
private data class ExerciseGroup(val exerciseId: String, val exerciseName: String, val sets: List<SetLogEntity>)

private fun safeGroupByDay(logs: List<SetLogEntity>): List<DayGroup> {
    if (logs.isEmpty()) return emptyList()
    val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val labelFmt = SimpleDateFormat("EEEE d MMMM", Locale("es", "MX"))
    val numFmt = SimpleDateFormat("d", Locale.getDefault())
    val cal = Calendar.getInstance()
    return logs
        .groupBy { try { dayFmt.format(Date(it.timestamp)) } catch (_: Exception) { "1970-01-01" } }
        .entries.sortedByDescending { it.key }
        .mapNotNull { (dayKey, daySets) ->
            try {
                val date = dayFmt.parse(dayKey) ?: return@mapNotNull null
                cal.time = date; cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0)
                val dayStart = cal.timeInMillis; cal.add(Calendar.DAY_OF_YEAR, 1); val dayEnd = cal.timeInMillis
                val exercises = daySets.groupBy { it.exerciseId.ifBlank { "sin-ejercicio" } }.map { (exId, exSets) ->
                    ExerciseGroup(exerciseId = exId, exerciseName = exSets.firstOrNull()?.exerciseName?.ifBlank { null } ?: exId.ifBlank { "Ejercicio" }, sets = exSets.sortedBy { it.setNumber })
                }
                DayGroup(dayKey = dayKey,
                    label = try { labelFmt.format(date).replaceFirstChar { it.uppercase() } } catch (_: Exception) { dayKey },
                    dayNumber = try { numFmt.format(date) } catch (_: Exception) { "?" },
                    dayStart = dayStart, dayEnd = dayEnd, exercises = exercises,
                    totalSets = daySets.size, totalVolume = daySets.sumOf { it.weightKg * it.reps })
            } catch (_: Exception) { null }
        }
}
