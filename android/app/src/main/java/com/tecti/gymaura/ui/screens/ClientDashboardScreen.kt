package com.tecti.gymaura.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAlert
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.tecti.gymaura.data.model.*
import com.tecti.gymaura.data.remote.ServerRepository
import com.tecti.gymaura.ui.components.GlassBadge
import com.tecti.gymaura.ui.components.GlassButton
import com.tecti.gymaura.ui.components.GlassCard
import com.tecti.gymaura.ui.components.GlassChip
import com.tecti.gymaura.ui.theme.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ClientDashboardScreen(
    onNavigateToCatalog: () -> Unit
) {
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
    var weightLogs by remember { mutableStateOf<List<WeightLog>>(emptyList()) }
    var exercisesMap by remember { mutableStateOf<Map<String, Exercise>>(emptyMap()) }

    var logModalExercise by remember { mutableStateOf<Exercise?>(null) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun loadData() {
        scope.launch {
            loading = true
            val clientList = ServerRepository.getClients()
            clients = clientList
            if (selectedClient == null && clientList.isNotEmpty()) {
                selectedClient = clientList.first()
            }

            // Load exercise map for names/icons
            val exList = ServerRepository.getExercises()
            exercisesMap = exList.associateBy { it.id }

            selectedClient?.let { cli ->
                weeklyRoutine = ServerRepository.getWeeklyRoutine(cli.id)
                weightLogs = ServerRepository.getWeightLogs(cli.id)
            }
            loading = false
        }
    }

    LaunchedEffect(selectedClient) {
        loadData()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        // Top Header Client Switcher
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(text = "Mi Entrenamiento", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                Text(text = "Registra tus cargas y supera tus récords", fontSize = 13.sp, color = TextSecondary)
            }

            // Client selector dropdown / avatar
            selectedClient?.let { cli ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(GlassSurfaceWhite)
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    if (cli.avatar.isNotBlank()) {
                        AsyncImage(
                            model = cli.avatar,
                            contentDescription = null,
                            modifier = Modifier.size(32.dp).clip(CircleShape)
                        )
                    } else {
                        Box(
                            modifier = Modifier.size(32.dp).clip(CircleShape).background(AppleBlue),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(imageVector = Icons.Default.Person, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = cli.name.split(" ").first(), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                }
            }
        }

        // Days Bar
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 12.dp)
        ) {
            items(daysOfWeek) { day ->
                GlassChip(
                    text = day,
                    isSelected = selectedDay == day,
                    onClick = { selectedDay = day }
                )
            }
        }

        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AppleBlue)
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
                                Text(text = "RUTINA DE $selectedDay", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AppleBlue)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = daySchedule?.focus ?: "Rutina General",
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = TextPrimary
                                )
                            }
                            GlassBadge(
                                text = "${routineExercises.size} Ejercicios",
                                color = AppleTeal
                            )
                        }
                    }
                }

                // Exercise List for Today
                if (routineExercises.isEmpty()) {
                    item {
                        GlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            backgroundColor = GlassSurfaceWhite
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(imageVector = Icons.Default.DirectionsRun, contentDescription = null, tint = AppleEmerald, modifier = Modifier.size(40.dp))
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("Día de Descanso o Sin Asignar", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text("Aprovecha para recuperar músculos o hacer cardio ligero.", fontSize = 12.sp, color = TextSecondary)
                            }
                        }
                    }
                } else {
                    items(routineExercises) { itemEx ->
                        val fullEx = exercisesMap[itemEx.exerciseId]
                        val exerciseName = fullEx?.name ?: "Ejercicio #${itemEx.exerciseId}"
                        val targetMuscle = fullEx?.targetMuscle ?: "Músculo"

                        val exerciseLogs = weightLogs.filter { it.exerciseId == itemEx.exerciseId }

                        GlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            backgroundColor = GlassSurfaceWhite
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(CircleShape)
                                        .background(AppleBlue.copy(alpha = 0.12f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(imageVector = Icons.Default.FitnessCenter, contentDescription = null, tint = AppleBlue)
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(text = exerciseName, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(text = "$targetMuscle • ${itemEx.sets} series x ${itemEx.reps} reps", fontSize = 12.sp, color = TextSecondary)

                                    if (itemEx.targetWeightKg > 0) {
                                        Text(text = "Meta Coach: ${itemEx.targetWeightKg} kg", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = AppleTeal)
                                    }
                                }

                                GlassButton(
                                    text = "+ Subir Peso",
                                    onClick = {
                                        logModalExercise = fullEx ?: Exercise(itemEx.exerciseId, exerciseName, "General", targetMuscle)
                                    },
                                    modifier = Modifier.height(38.dp),
                                    gradientColors = listOf(AppleBlue, AppleIndigo)
                                )
                            }

                            // Render logged weight history for this exercise if any
                            if (exerciseLogs.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(10.dp))
                                Divider(color = GlassBorderOutline.copy(alpha = 0.5f))
                                Spacer(modifier = Modifier.height(8.dp))

                                Text("Cargas Registradas Recientemente:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                                Spacer(modifier = Modifier.height(4.dp))
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    exerciseLogs.take(3).forEach { log ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(GlassSurfaceElevated)
                                                .padding(horizontal = 8.dp, vertical = 4.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text("Serie ${log.setNumber}: ${log.weightKg} kg x ${log.repsCompleted} reps", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                                            Text(log.date, fontSize = 11.sp, color = TextTertiary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Recent Weight Logs Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(imageVector = Icons.Default.History, contentDescription = null, tint = AppleBlue, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Historial Reciente de Peso", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    }
                }

                if (weightLogs.isEmpty()) {
                    item {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Text("Aún no has registrado pesos esta semana. ¡Pulsa '+ Subir Peso' en un ejercicio para empezar!", fontSize = 12.sp, color = TextSecondary)
                        }
                    }
                } else {
                    items(weightLogs.take(5)) { log ->
                        GlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            backgroundColor = GlassSurfaceWhite
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(text = log.exerciseName, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    Text(text = "Serie ${log.setNumber} • ${log.date}", fontSize = 11.sp, color = TextSecondary)
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(AppleBlue.copy(alpha = 0.12f))
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(text = "${log.weightKg} kg  (${log.repsCompleted} reps)", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = AppleBlue)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Weight Logger Modal
    logModalExercise?.let { ex ->
        LogWeightModal(
            exercise = ex,
            clientId = selectedClient?.id ?: "cli_1",
            dayName = selectedDay,
            onDismiss = { logModalExercise = null },
            onLogged = {
                logModalExercise = null
                loadData()
            }
        )
    }
}

@Composable
fun LogWeightModal(
    exercise: Exercise,
    clientId: String,
    dayName: String,
    onDismiss: () -> Unit,
    onLogged: () -> Unit
) {
    var setNumber by remember { mutableStateOf("1") }
    var weightInput by remember { mutableStateOf("") }
    var repsInput by remember { mutableStateOf("${exercise.defaultReps}") }
    var notesInput by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    Dialog(onDismissRequest = onDismiss) {
        GlassCard(
            modifier = Modifier.fillMaxWidth(),
            backgroundColor = GlassSurfaceWhite,
            borderColor = GlassBorderWhite
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier.size(44.dp).clip(CircleShape).background(AppleBlue.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(imageVector = Icons.Default.Upload, contentDescription = null, tint = AppleBlue)
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(text = "Subir Peso Cargado", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(text = exercise.name, fontSize = 13.sp, color = AppleBlue, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = setNumber,
                    onValueChange = { setNumber = it },
                    label = { Text("Serie #") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = weightInput,
                    onValueChange = { weightInput = it },
                    label = { Text("Peso (kg)") },
                    placeholder = { Text("75.5") },
                    modifier = Modifier.weight(1.5f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = repsInput,
                    onValueChange = { repsInput = it },
                    label = { Text("Reps") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = notesInput,
                onValueChange = { notesInput = it },
                label = { Text("Notas (Opcional)") },
                placeholder = { Text("Sintió bien, sin molestia...") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(20.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Cancelar") }
                Spacer(modifier = Modifier.width(8.dp))
                GlassButton(
                    text = if (saving) "Guardando..." else "Guardar Carga",
                    enabled = weightInput.isNotBlank() && !saving,
                    onClick = {
                        scope.launch {
                            saving = true
                            val todayDate = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                            ServerRepository.logWeight(
                                WeightLog(
                                    clientId = clientId,
                                    exerciseId = exercise.id,
                                    exerciseName = exercise.name,
                                    date = todayDate,
                                    dayName = dayName,
                                    setNumber = setNumber.toIntOrNull() ?: 1,
                                    weightKg = weightInput.toDoubleOrNull() ?: 0.0,
                                    repsCompleted = repsInput.toIntOrNull() ?: exercise.defaultReps,
                                    notes = notesInput
                                )
                            )
                            saving = false
                            onLogged()
                        }
                    }
                )
            }
        }
    }
}
