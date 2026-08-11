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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import coil.request.ImageRequest
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign

fun getSpanishCategoryName(category: String): String {
    return when (category) {
        "chest" -> "Pecho"
        "back" -> "Espalda"
        "waist" -> "Cintura/Abdomen"
        "shoulders" -> "Hombros"
        "upper arms" -> "Brazos"
        "lower arms" -> "Antebrazos"
        "upper legs" -> "Piernas"
        "lower legs" -> "Pantorrillas"
        "cardio" -> "Cardio"
        "neck" -> "Cuello"
        else -> category
    }
}

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

    val categories = listOf("Todos", "chest", "back", "waist", "shoulders", "upper arms", "lower arms", "upper legs", "lower legs", "cardio", "neck")

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
                    text = getSpanishCategoryName(category),
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
            if (!exercise.mediaUrl.isNullOrEmpty()) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(exercise.mediaUrl)
                        .crossfade(true)
                        .build(),
                    imageLoader = buildCoilLoader(LocalContext.current),
                    contentDescription = exercise.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(16.dp))
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(AppleBlue.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.FitnessCenter,
                        contentDescription = null,
                        tint = AppleBlue,
                        modifier = Modifier.size(32.dp)
                    )
                }
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
                    GlassBadge(text = getSpanishCategoryName(exercise.category), color = AppleBlue)
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
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 600.dp),
            backgroundColor = GlassSurfaceWhite,
            borderColor = GlassBorderWhite
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                // GIF at the top
                if (!exercise.mediaUrl.isNullOrEmpty()) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(exercise.mediaUrl)
                            .crossfade(true)
                            .build(),
                        imageLoader = buildCoilLoader(LocalContext.current),
                        contentDescription = exercise.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .clip(RoundedCornerShape(16.dp))
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(androidx.compose.ui.graphics.Brush.verticalGradient(
                                listOf(AppleBlue.copy(alpha = 0.2f), AppleTeal.copy(alpha = 0.05f))
                            )),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(imageVector = Icons.Default.FitnessCenter, contentDescription = null, tint = AppleBlue, modifier = Modifier.size(64.dp))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(text = exercise.name, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                GlassBadge(text = exercise.targetMuscle, color = AppleBlue)

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(GlassSurfaceElevated)
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Categoría", fontSize = 10.sp, color = TextSecondary)
                            Text(getSpanishCategoryName(exercise.category), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary, textAlign = TextAlign.Center)
                        }
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(GlassSurfaceElevated)
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Equipo", fontSize = 10.sp, color = TextSecondary)
                            Text(exercise.equipment, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary, textAlign = TextAlign.Center)
                        }
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(GlassSurfaceElevated)
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Sets × Reps", fontSize = 10.sp, color = TextSecondary)
                            Text("${exercise.defaultSets} × ${exercise.defaultReps}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AppleTeal)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text("Instrucciones", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Spacer(modifier = Modifier.height(12.dp))

                val instructions = if (exercise.instructions.isNotBlank()) exercise.instructions else "Mantén una ejecución controlada y respiración constante."
                val steps = instructions.split(". ").filter { it.isNotBlank() }

                steps.forEachIndexed { index, step ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(AppleBlue),
                            contentAlignment = Alignment.Center
                        ) {
                            Text((index + 1).toString(), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = if (step.endsWith(".")) step else "$step.",
                            fontSize = 14.sp,
                            color = TextSecondary,
                            lineHeight = 20.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                GlassButton(
                    text = "Cerrar",
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(),
                    gradientColors = listOf(AppleBlue, AppleBlue)
                )
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
    var category by remember { mutableStateOf("chest") }
    var targetMuscle by remember { mutableStateOf("") }
    var equipment by remember { mutableStateOf("") }
    var instructions by remember { mutableStateOf("") }

    val categories = listOf("chest", "back", "waist", "shoulders", "upper arms", "lower arms", "upper legs", "lower legs", "cardio", "neck")
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
                    GlassChip(text = getSpanishCategoryName(cat), isSelected = category == cat, onClick = { category = cat })
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
