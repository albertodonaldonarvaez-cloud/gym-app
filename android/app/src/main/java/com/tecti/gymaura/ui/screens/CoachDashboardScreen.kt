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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sports
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.tecti.gymaura.data.model.*
import com.tecti.gymaura.data.remote.ServerRepository
import com.tecti.gymaura.ui.components.GlassBadge
import com.tecti.gymaura.ui.components.GlassButton
import com.tecti.gymaura.ui.components.GlassCard
import com.tecti.gymaura.ui.components.GlassChip
import com.tecti.gymaura.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun CoachDashboardScreen(
    onNavigateToCatalog: () -> Unit
) {
    var clients by remember { mutableStateOf<List<Client>>(emptyList()) }
    var coachInfo by remember { mutableStateOf<Coach?>(null) }
    var selectedClientForRoutine by remember { mutableStateOf<Client?>(null) }
    var showAddClientModal by remember { mutableStateOf(false) }
    var showRoutineBuilderModal by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }

    val scope = rememberCoroutineScope()

    fun refreshCoachData() {
        scope.launch {
            loading = true
            coachInfo = ServerRepository.getCoachInfo()
            clients = ServerRepository.getClients()
            loading = false
        }
    }

    LaunchedEffect(Unit) {
        refreshCoachData()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        // Coach Profile Glass Banner
        coachInfo?.let { coach ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (coach.avatar.isNotBlank()) {
                        AsyncImage(
                            model = coach.avatar,
                            contentDescription = null,
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(AppleBlue),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(imageVector = Icons.Default.Sports, contentDescription = null, tint = Color.White)
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(text = coach.name, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Text(text = coach.gymName, fontSize = 12.sp, color = AppleBlue, fontWeight = FontWeight.SemiBold)
                    }
                }

                GlassBadge(text = "Modo Coach", color = AppleIndigo)
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Clients Section Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = "Mis Clientes (${clients.size})", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassButton(
                    text = "+ Cliente",
                    onClick = { showAddClientModal = true },
                    modifier = Modifier.height(36.dp),
                    gradientColors = listOf(AppleBlue, AppleTeal)
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AppleBlue)
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(14.dp),
                contentPadding = PaddingValues(bottom = 90.dp)
            ) {
                items(clients) { client ->
                    ClientCardForCoach(
                        client = client,
                        onEditRoutine = {
                            selectedClientForRoutine = client
                            showRoutineBuilderModal = true
                        }
                    )
                }
            }
        }
    }

    // Add Client Modal
    if (showAddClientModal) {
        AddClientModal(
            onDismiss = { showAddClientModal = false },
            onAdded = {
                showAddClientModal = false
                refreshCoachData()
            }
        )
    }

    // Routine Builder Modal
    if (showRoutineBuilderModal && selectedClientForRoutine != null) {
        RoutineBuilderModal(
            client = selectedClientForRoutine!!,
            onDismiss = { showRoutineBuilderModal = false },
            onSaved = {
                showRoutineBuilderModal = false
                refreshCoachData()
            }
        )
    }
}

@Composable
fun ClientCardForCoach(
    client: Client,
    onEditRoutine: () -> Unit
) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        backgroundColor = GlassSurfaceWhite,
        borderColor = GlassBorderWhite
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(
                model = if (client.avatar.isNotBlank()) client.avatar else "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80",
                contentDescription = null,
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(text = client.name, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Spacer(modifier = Modifier.height(2.dp))
                Text(text = "Meta: ${client.goal}", fontSize = 12.sp, color = AppleBlue, fontWeight = FontWeight.SemiBold)
                Text(text = "${client.weightKg} kg • ${client.heightCm} cm", fontSize = 11.sp, color = TextSecondary)
            }

            GlassButton(
                text = "Rutina",
                onClick = onEditRoutine,
                modifier = Modifier.height(38.dp),
                gradientColors = listOf(AppleIndigo, AppleBlue)
            )
        }
    }
}

@Composable
fun AddClientModal(
    onDismiss: () -> Unit,
    onAdded: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var goal by remember { mutableStateOf("Hipertrofia y Fuerza") }
    var weight by remember { mutableStateOf("75") }
    var height by remember { mutableStateOf("175") }
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
                    Icon(imageVector = Icons.Default.PersonAdd, contentDescription = null, tint = AppleBlue)
                }
                Spacer(modifier = Modifier.width(12.dp))
                Text(text = "Registrar Nuevo Cliente", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nombre Completo") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Correo Electrónico") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = goal, onValueChange = { goal = it }, label = { Text("Objetivo Principal") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Spacer(modifier = Modifier.height(8.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = weight, onValueChange = { weight = it }, label = { Text("Peso (kg)") }, modifier = Modifier.weight(1f), singleLine = true)
                OutlinedTextField(value = height, onValueChange = { height = it }, label = { Text("Estatura (cm)") }, modifier = Modifier.weight(1f), singleLine = true)
            }

            Spacer(modifier = Modifier.height(20.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Cancelar") }
                Spacer(modifier = Modifier.width(8.dp))
                GlassButton(
                    text = if (saving) "Guardando..." else "Registrar Cliente",
                    enabled = name.isNotBlank() && email.isNotBlank() && !saving,
                    onClick = {
                        scope.launch {
                            saving = true
                            ServerRepository.addClient(
                                Client(
                                    id = "",
                                    name = name,
                                    email = email,
                                    phone = phone,
                                    goal = goal,
                                    weightKg = weight.toDoubleOrNull() ?: 70.0,
                                    heightCm = height.toIntOrNull() ?: 170
                                )
                            )
                            saving = false
                            onAdded()
                        }
                    }
                )
            }
        }
    }
}

@Composable
fun RoutineBuilderModal(
    client: Client,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    val daysOfWeek = listOf("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")
    var selectedDay by remember { mutableStateOf("Lunes") }

    var routineTitle by remember { mutableStateOf("Rutina Semanal de ${client.name.split(" ").first()}") }
    var currentSchedule by remember { mutableStateOf<MutableMap<String, DaySchedule>>(mutableMapOf()) }
    var allExercises by remember { mutableStateOf<List<Exercise>>(emptyList()) }
    var showSelectExerciseModal by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    LaunchedEffect(client.id) {
        scope.launch {
            loading = true
            allExercises = ServerRepository.getExercises()
            val existingRoutine = ServerRepository.getWeeklyRoutine(client.id)
            routineTitle = existingRoutine?.title ?: "Rutina Semanal de ${client.name.split(" ").first()}"

            val schedMap = mutableMapOf<String, DaySchedule>()
            daysOfWeek.forEach { day ->
                schedMap[day] = existingRoutine?.schedule?.get(day) ?: DaySchedule(day, "Sin asignar", emptyList())
            }
            currentSchedule = schedMap
            loading = false
        }
    }

    val currentDaySchedule = currentSchedule[selectedDay] ?: DaySchedule(selectedDay, "Rutina General", emptyList())
    val exercisesMap = remember(allExercises) { allExercises.associateBy { it.id } }

    Dialog(onDismissRequest = onDismiss) {
        GlassCard(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.85f),
            backgroundColor = GlassSurfaceWhite,
            borderColor = GlassBorderWhite
        ) {
            Text("Modificar Rutina: ${client.name}", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(10.dp))

            // Day Selector Tabs
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(daysOfWeek) { day ->
                    GlassChip(text = day, isSelected = selectedDay == day, onClick = { selectedDay = day })
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (loading) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AppleBlue)
                }
            } else {
                Column(modifier = Modifier.weight(1f)) {
                    // Day Focus Input
                    OutlinedTextField(
                        value = currentDaySchedule.focus,
                        onValueChange = { newFocus ->
                            val updated = currentSchedule.toMutableMap()
                            updated[selectedDay] = currentDaySchedule.copy(focus = newFocus)
                            currentSchedule = updated
                        },
                        label = { Text("Enfoque del Día (ej: Pecho y Bíceps)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Ejercicios del $selectedDay", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        TextButton(onClick = { showSelectExerciseModal = true }) {
                            Icon(imageVector = Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Añadir Ejercicio")
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    if (currentDaySchedule.exercises.isEmpty()) {
                        Box(modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp), contentAlignment = Alignment.Center) {
                            Text("No hay ejercicios agregados a este día.", fontSize = 12.sp, color = TextSecondary)
                        }
                    } else {
                        val ctx = LocalContext.current
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(currentDaySchedule.exercises) { itemEx ->
                                val exInfo = exercisesMap[itemEx.exerciseId]
                                val exName = exInfo?.name ?: "Ejercicio #${itemEx.exerciseId}"

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(GlassSurfaceElevated)
                                        .padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    // GIF / image thumbnail
                                    val gifUrl = exInfo?.mediaUrl
                                    if (!gifUrl.isNullOrBlank()) {
                                        AsyncImage(
                                            model = ImageRequest.Builder(ctx)
                                                .data(gifUrl)
                                                .crossfade(true)
                                                .build(),
                                            imageLoader = buildCoilLoader(ctx),
                                            contentDescription = exName,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier
                                                .size(44.dp)
                                                .clip(RoundedCornerShape(10.dp))
                                        )
                                    } else {
                                        Box(
                                            modifier = Modifier
                                                .size(44.dp)
                                                .clip(RoundedCornerShape(10.dp))
                                                .background(AppleBlue.copy(alpha = 0.12f)),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Icon(Icons.Default.FitnessCenter, contentDescription = null, tint = AppleBlue, modifier = Modifier.size(22.dp))
                                        }
                                    }

                                    Spacer(modifier = Modifier.width(10.dp))

                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(exName, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                        Text("${itemEx.sets} series × ${itemEx.reps} reps ${if (itemEx.targetWeightKg > 0) "• ${itemEx.targetWeightKg} kg" else ""}", fontSize = 12.sp, color = TextSecondary)
                                    }

                                    IconButton(
                                        onClick = {
                                            val updatedList = currentDaySchedule.exercises.filter { it.exerciseId != itemEx.exerciseId }
                                            val updated = currentSchedule.toMutableMap()
                                            updated[selectedDay] = currentDaySchedule.copy(exercises = updatedList)
                                            currentSchedule = updated
                                        }
                                    ) {
                                        Icon(imageVector = Icons.Default.Delete, contentDescription = "Eliminar", tint = AppleRose)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Cancelar") }
                Spacer(modifier = Modifier.width(8.dp))
                GlassButton(
                    text = if (saving) "Guardando..." else "Guardar Rutina",
                    enabled = !saving,
                    onClick = {
                        scope.launch {
                            saving = true
                            ServerRepository.saveWeeklyRoutine(
                                WeeklyRoutine(
                                    id = "rout_" + client.id,
                                    clientId = client.id,
                                    title = routineTitle,
                                    description = "Plan semanal configurado por el Coach",
                                    schedule = currentSchedule
                                )
                            )
                            saving = false
                            onSaved()
                        }
                    }
                )
            }
        }
    }

    // Modal to pick exercise to add to day — with search + GIF preview
    if (showSelectExerciseModal) {
        var exerciseSearch by remember { mutableStateOf("") }
        val filteredExercises = remember(exerciseSearch, allExercises) {
            if (exerciseSearch.isBlank()) allExercises
            else allExercises.filter { ex ->
                ex.name.contains(exerciseSearch, ignoreCase = true) ||
                ex.targetMuscle.contains(exerciseSearch, ignoreCase = true) ||
                ex.category.contains(exerciseSearch, ignoreCase = true)
            }
        }
        val pickerCtx = LocalContext.current

        Dialog(onDismissRequest = { showSelectExerciseModal = false }) {
            GlassCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.82f),
                backgroundColor = GlassSurfaceWhite
            ) {
                // Header
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier.size(36.dp).clip(CircleShape)
                            .background(AppleBlue.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.FitnessCenter, contentDescription = null, tint = AppleBlue, modifier = Modifier.size(18.dp))
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("Agregar ejercicio", fontSize = 17.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                        Text(selectedDay, fontSize = 12.sp, color = AppleBlue, fontWeight = FontWeight.SemiBold)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Search bar
                OutlinedTextField(
                    value = exerciseSearch,
                    onValueChange = { exerciseSearch = it },
                    placeholder = { Text("Buscar por nombre, músculo...", color = TextTertiary, fontSize = 13.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = AppleBlue) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = GlassSurfaceElevated,
                        unfocusedContainerColor = GlassSurfaceWhite,
                        focusedBorderColor = AppleBlue,
                        unfocusedBorderColor = GlassBorderWhite
                    )
                )

                Spacer(modifier = Modifier.height(4.dp))
                Text("${filteredExercises.size} ejercicios", fontSize = 11.sp, color = TextTertiary)
                Spacer(modifier = Modifier.height(8.dp))

                // Exercise list with GIF thumbnails
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    items(filteredExercises, key = { it.id }) { ex ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(GlassSurfaceElevated)
                                .clickable {
                                    val newExList = currentDaySchedule.exercises +
                                        RoutineExercise(ex.id, ex.defaultSets, ex.defaultReps, 0.0)
                                    val updated = currentSchedule.toMutableMap()
                                    updated[selectedDay] = currentDaySchedule.copy(exercises = newExList)
                                    currentSchedule = updated
                                    showSelectExerciseModal = false
                                }
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // GIF / image thumbnail
                            if (!ex.mediaUrl.isNullOrBlank()) {
                                AsyncImage(
                                    model = ImageRequest.Builder(pickerCtx)
                                        .data(ex.mediaUrl)
                                        .crossfade(true)
                                        .build(),
                                    imageLoader = buildCoilLoader(pickerCtx),
                                    contentDescription = ex.name,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .size(56.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                )
                            } else {
                                Box(
                                    modifier = Modifier
                                        .size(56.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(AppleBlue.copy(alpha = 0.1f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.FitnessCenter, contentDescription = null, tint = AppleBlue, modifier = Modifier.size(26.dp))
                                }
                            }

                            Spacer(modifier = Modifier.width(12.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Text(ex.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary, maxLines = 2)
                                Spacer(modifier = Modifier.height(3.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    GlassBadge(text = ex.category, color = AppleBlue)
                                    GlassBadge(text = ex.targetMuscle, color = AppleTeal)
                                }
                            }

                            // Add indicator
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(CircleShape)
                                    .background(AppleBlue.copy(alpha = 0.12f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, tint = AppleBlue, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))
                TextButton(onClick = { showSelectExerciseModal = false }, modifier = Modifier.align(Alignment.End)) {
                    Text("Cerrar", color = TextSecondary)
                }
            }
        }
    }
}
