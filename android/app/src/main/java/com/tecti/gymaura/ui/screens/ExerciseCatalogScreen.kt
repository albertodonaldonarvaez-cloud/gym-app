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
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Search
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
import com.tecti.gymaura.data.model.Exercise
import com.tecti.gymaura.data.model.UserRole
import com.tecti.gymaura.data.remote.ServerRepository
import com.tecti.gymaura.ui.components.GlassBadge
import com.tecti.gymaura.ui.components.GlassButton
import com.tecti.gymaura.ui.components.GlassCard
import com.tecti.gymaura.ui.components.GlassChip
import com.tecti.gymaura.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun ExerciseCatalogScreen(
    currentRole: UserRole,
    onSelectExerciseForRoutine: ((Exercise) -> Unit)? = null
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("Todos") }
    var exercises by remember { mutableStateOf<List<Exercise>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    var selectedDetailExercise by remember { mutableStateOf<Exercise?>(null) }
    var showAddModal by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    val categories = listOf("Todos", "Pecho", "Espalda", "Pierna", "Hombro", "Bíceps", "Tríceps", "Abdomen", "Cardio")

    fun reloadExercises() {
        scope.launch {
            loading = true
            exercises = ServerRepository.getExercises(selectedCategory, searchQuery)
            loading = false
        }
    }

    LaunchedEffect(selectedCategory, searchQuery) {
        reloadExercises()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Catálogo de Ejercicios",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimary
                )
                Text(
                    text = "Explora los mejores ejercicios de gimnasio",
                    fontSize = 13.sp,
                    color = TextSecondary
                )
            }

            if (currentRole == UserRole.COACH) {
                IconButton(
                    onClick = { showAddModal = true },
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(AppleBlue.copy(alpha = 0.12f))
                ) {
                    Icon(imageVector = Icons.Default.Add, contentDescription = "Añadir Ejercicio", tint = AppleBlue)
                }
            }
        }

        // Search Field
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Buscar ejercicio o músculo...", color = TextTertiary) },
            leadingIcon = { Icon(imageVector = Icons.Default.Search, contentDescription = null, tint = AppleBlue) },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            shape = RoundedCornerShape(20.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = GlassSurfaceElevated,
                unfocusedContainerColor = GlassSurfaceWhite,
                focusedBorderColor = AppleBlue,
                unfocusedBorderColor = GlassBorderWhite
            )
        )

        // Categories Row
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 16.dp)
        ) {
            items(categories) { category ->
                GlassChip(
                    text = category,
                    isSelected = selectedCategory == category,
                    onClick = { selectedCategory = category }
                )
            }
        }

        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AppleBlue)
            }
        } else if (exercises.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(imageVector = Icons.Default.FitnessCenter, contentDescription = null, tint = TextTertiary, modifier = Modifier.size(48.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("No se encontraron ejercicios", color = TextSecondary, fontSize = 15.sp)
                }
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 90.dp)
            ) {
                items(exercises) { exercise ->
                    ExerciseCard(
                        exercise = exercise,
                        onInfoClick = { selectedDetailExercise = exercise },
                        onSelectForRoutine = if (onSelectExerciseForRoutine != null) {
                            { onSelectExerciseForRoutine(exercise) }
                        } else null
                    )
                }
            }
        }
    }

    // Detail Modal
    selectedDetailExercise?.let { exercise ->
        ExerciseDetailModal(
            exercise = exercise,
            onDismiss = { selectedDetailExercise = null }
        )
    }

    // Add Modal (Coach)
    if (showAddModal) {
        AddExerciseModal(
            onDismiss = { showAddModal = false },
            onAdded = {
                showAddModal = false
                reloadExercises()
            }
        )
    }
}

@Composable
fun ExerciseCard(
    exercise: Exercise,
    onInfoClick: () -> Unit,
    onSelectForRoutine: (() -> Unit)? = null
) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onInfoClick,
        backgroundColor = GlassSurfaceWhite,
        borderColor = GlassBorderWhite
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(AppleBlue.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.FitnessCenter,
                    contentDescription = null,
                    tint = AppleBlue,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = exercise.name,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    GlassBadge(text = exercise.category, color = AppleBlue)
                    GlassBadge(text = exercise.targetMuscle, color = AppleTeal)
                }
            }

            if (onSelectForRoutine != null) {
                Spacer(modifier = Modifier.width(8.dp))
                GlassButton(
                    text = "Añadir",
                    onClick = onSelectForRoutine,
                    modifier = Modifier.height(36.dp),
                    gradientColors = listOf(AppleEmerald, AppleTeal)
                )
            } else {
                IconButton(onClick = onInfoClick) {
                    Icon(imageVector = Icons.Default.Info, contentDescription = "Detalles", tint = TextSecondary)
                }
            }
        }
    }
}

@Composable
fun ExerciseDetailModal(
    exercise: Exercise,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        GlassCard(
            modifier = Modifier.fillMaxWidth(),
            backgroundColor = GlassSurfaceWhite,
            borderColor = GlassBorderWhite
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(AppleBlue.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(imageVector = Icons.Default.FitnessCenter, contentDescription = null, tint = AppleBlue, modifier = Modifier.size(28.dp))
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(text = exercise.name, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(text = exercise.targetMuscle, fontSize = 13.sp, color = AppleBlue, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Categoría", fontSize = 11.sp, color = TextSecondary)
                    Text(exercise.category, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                }
                Column {
                    Text("Equipamiento", fontSize = 11.sp, color = TextSecondary)
                    Text(exercise.equipment, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                }
                Column {
                    Text("Sets x Reps", fontSize = 11.sp, color = TextSecondary)
                    Text("${exercise.defaultSets} x ${exercise.defaultReps}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = AppleTeal)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text("Técnica e Instrucciones:", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = if (exercise.instructions.isNotBlank()) exercise.instructions else "Mantén una ejecución controlada y respiración constante.",
                fontSize = 13.sp,
                color = TextSecondary,
                lineHeight = 18.sp
            )

            Spacer(modifier = Modifier.height(24.dp))

            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                GlassButton(text = "Cerrar", onClick = onDismiss)
            }
        }
    }
}

@Composable
fun AddExerciseModal(
    onDismiss: () -> Unit,
    onAdded: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Pecho") }
    var targetMuscle by remember { mutableStateOf("") }
    var equipment by remember { mutableStateOf("") }
    var instructions by remember { mutableStateOf("") }

    val categories = listOf("Pecho", "Espalda", "Pierna", "Hombro", "Bíceps", "Tríceps", "Abdomen", "Cardio")
    val scope = rememberCoroutineScope()
    var saving by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        GlassCard(
            modifier = Modifier.fillMaxWidth(),
            backgroundColor = GlassSurfaceWhite,
            borderColor = GlassBorderWhite
        ) {
            Text("Añadir Nuevo Ejercicio", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Nombre del Ejercicio") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))

            Text("Categoría", fontSize = 12.sp, color = TextSecondary)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(categories) { cat ->
                    GlassChip(text = cat, isSelected = category == cat, onClick = { category = cat })
                }
            }
            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = targetMuscle,
                onValueChange = { targetMuscle = it },
                label = { Text("Músculo Principal") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = equipment,
                onValueChange = { equipment = it },
                label = { Text("Equipamiento (Barra, Mancuerna, etc.)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = instructions,
                onValueChange = { instructions = it },
                label = { Text("Instrucciones de ejecución") },
                maxLines = 3,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(20.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Cancelar") }
                Spacer(modifier = Modifier.width(8.dp))
                GlassButton(
                    text = if (saving) "Guardando..." else "Guardar Ejercicio",
                    enabled = name.isNotBlank() && !saving,
                    onClick = {
                        scope.launch {
                            saving = true
                            ServerRepository.addExercise(
                                Exercise(
                                    id = "",
                                    name = name,
                                    category = category,
                                    targetMuscle = if (targetMuscle.isNotBlank()) targetMuscle else category,
                                    equipment = if (equipment.isNotBlank()) equipment else "Libre",
                                    instructions = instructions
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
