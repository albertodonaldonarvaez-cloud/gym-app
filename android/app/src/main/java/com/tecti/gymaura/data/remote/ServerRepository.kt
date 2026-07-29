package com.tecti.gymaura.data.remote

import com.tecti.gymaura.data.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient

object ServerRepository {

    // URL por defecto (puede ser cambiada dinámicamente por el usuario)
    private var baseUrl: String = "http://10.0.2.2:3000/" // Default Android Emulator host / local server

    private val _currentUrlState = MutableStateFlow(baseUrl)
    val currentUrlState: StateFlow<String> = _currentUrlState

    private val _isServerConnected = MutableStateFlow(false)
    val isServerConnected: StateFlow<Boolean> = _isServerConnected

    private var apiService: ApiService? = null

    init {
        updateBaseUrl(baseUrl)
    }

    fun updateBaseUrl(newUrl: String) {
        var formattedUrl = newUrl.trim()
        if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
            formattedUrl = "http://$formattedUrl"
        }
        if (!formattedUrl.endsWith("/")) {
            formattedUrl += "/"
        }
        baseUrl = formattedUrl
        _currentUrlState.value = baseUrl

        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .writeTimeout(5, TimeUnit.SECONDS)
            .build()

        try {
            val retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
            apiService = retrofit.create(ApiService::class.java)
        } catch (e: Exception) {
            e.printStackTrace()
            apiService = null
        }
    }

    // Datos semilla locales en caso de desconexión
    private val localExercises = mutableListOf(
        Exercise("ex_1", "Press de Banca con Barra", "Pecho", "Pectoral Mayor", "Barra y Banco Plano", "Túmbate en el banco, agarre medio, baja la barra al esternón con codos a 45° y empuja explosivo.", 4, 10, "dumbbell"),
        Exercise("ex_2", "Press Inclinado con Mancuernas", "Pecho", "Pectoral Superior", "Banco Inclinado 30° + Mancuernas", "Con el banco a 30 grados, baja las mancuernas al nivel del pecho superior y extiende totalmente.", 4, 12, "dumbbell"),
        Exercise("ex_3", "Aperturas con Mancuernas", "Pecho", "Pectoral Mayor / Estiramiento", "Mancuernas", "Abre los brazos semiflexionados sintiendo el estiramiento profundo en el pecho antes de cerrar.", 3, 15, "dumbbell"),
        Exercise("ex_4", "Fondos en Paralelas (Dips)", "Pecho", "Pectoral Inferior y Tríceps", "Barras Paralelas", "Inclina el torso ligeramente hacia adelante al bajar para enfocar la carga en el pecho inferior.", 3, 10, "bodyweight"),
        Exercise("ex_5", "Crossover en Polea Alta", "Pecho", "Pectoral Inferior e Interior", "Polea Doble", "Cruza los cables al frente abajo manteniendo ligera flexión de codos.", 4, 15, "cable"),
        Exercise("ex_6", "Jalón al Pecho en Polea Alta", "Espalda", "Dorsal Ancho", "Máquina de Polea", "Tracciona el agarre hacia la parte superior del pecho sacando el tórax y apretando omóplatos.", 4, 12, "cable"),
        Exercise("ex_7", "Remo con Barra", "Espalda", "Dorsal y Trapecio", "Barra Olímpica", "Torso inclinado a 45°, lleva la barra hacia el ombligo manteniendo la espalda recta.", 4, 10, "dumbbell"),
        Exercise("ex_8", "Dominadas (Pull-ups)", "Espalda", "Dorsal Ancho", "Barra de Dominadas", "Agarre prono más ancho que los hombros. Eleva tu cuerpo hasta superar la barra.", 4, 8, "bodyweight"),
        Exercise("ex_9", "Remo Gironda en Polea Baja", "Espalda", "Espalda Media", "Polea Baja Agarre V", "Mantén el torso erguido, tira hacia el abdomen y retrae profundamente las escápulas.", 4, 12, "cable"),
        Exercise("ex_10", "Peso Muerto Convencional", "Espalda", "Cadena Posterior Total", "Barra y Discos", "Pies a lo ancho de caderas, espalda neutra, empuja el suelo con las piernas y extiende cadera.", 4, 6, "barbell"),
        Exercise("ex_11", "Sentadilla Trasera con Barra", "Pierna", "Cuádriceps y Glúteo", "Rack y Barra", "Apoya la barra en trapecios, desciende rompiendo el paralelo con rodillas alineadas.", 4, 10, "barbell"),
        Exercise("ex_12", "Prensa de Piernas 45°", "Pierna", "Cuádriceps e Isquios", "Máquina de Prensa", "Coloca pies al ancho de hombros, baja la plataforma a 90° sin despegar la zona lumbar.", 4, 12, "machine"),
        Exercise("ex_13", "Zancadas / Lunges", "Pierna", "Glúteos y Cuádriceps", "Mancuernas", "Da un paso amplio desciendo la rodilla trasera casi al suelo. Torso vertical.", 3, 12, "dumbbell"),
        Exercise("ex_14", "Extensión de Cuádriceps", "Pierna", "Cuádriceps", "Máquina Extensión", "Extiende las piernas completamente con control y aguantando 1s arriba.", 4, 15, "machine"),
        Exercise("ex_15", "Curl Femoral Tumbado", "Pierna", "Isquiotibiales", "Máquina Curl Femoral", "Flexiona las piernas llevando los talones hacia los glúteos.", 4, 12, "machine"),
        Exercise("ex_16", "Peso Muerto Rumano", "Pierna", "Isquiotibiales y Glúteo", "Barra / Mancuernas", "Flexiona ligeramente rodillas y empuja la cadera hacia atrás sintiendo el estiramiento.", 4, 10, "barbell"),
        Exercise("ex_17", "Elevación de Talones", "Pierna", "Gemelos", "Máquina o Escalón", "Sube al máximo sobre la punta de los pies, aguanta 1s y baja estirando.", 4, 20, "machine"),
        Exercise("ex_18", "Press Militar con Barra", "Hombro", "Deltoides Anterior", "Barra Olímpica", "Desde la clavícula, empuja la barra sobre la cabeza bloqueando los brazos.", 4, 8, "barbell"),
        Exercise("ex_19", "Press Arnold con Mancuernas", "Hombro", "Deltoides Completo", "Mancuernas", "Inicia con palmas mirando hacia ti y rota 180° a medida que subes.", 4, 12, "dumbbell"),
        Exercise("ex_20", "Elevaciones Laterales", "Hombro", "Deltoides Lateral", "Mancuernas", "Eleva las mancuernas hacia los lados hasta la altura de los hombros guiando con los codos.", 4, 15, "dumbbell"),
        Exercise("ex_21", "Pájaros para Deltoides Posterior", "Hombro", "Deltoides Posterior", "Mancuernas", "Inclina el torso 90° y abre los brazos lateralmente apretando el hombro posterior.", 4, 15, "dumbbell"),
        Exercise("ex_22", "Curl de Bíceps con Barra Z", "Bíceps", "Bíceps Braquial", "Barra Z", "Mantén codos pegados al costado y flexiona la barra Z con movimiento limpio.", 4, 12, "barbell"),
        Exercise("ex_23", "Curl Martillo con Mancuernas", "Bíceps", "Braquiorradial", "Mancuernas", "Agarre neutro. Eleva las mancuernas manteniendo codos fijos.", 4, 12, "dumbbell"),
        Exercise("ex_24", "Curl Predicador Banco Scott", "Bíceps", "Bíceps Cabeza Corta", "Banco Scott", "Apoya los brazos firmes en el acolchado y sube concentrando la contracción.", 3, 10, "barbell"),
        Exercise("ex_25", "Extensión de Tríceps Polea Cuerda", "Tríceps", "Tríceps Lateral", "Polea Alta", "Empuja la cuerda hacia abajo y abre las manos al final contratando el tríceps.", 4, 15, "cable"),
        Exercise("ex_26", "Press Francés Banco Plano", "Tríceps", "Tríceps Cabeza Larga", "Barra Z", "Baja la barra lentamente hacia la frente manteniendo los codos cerrados.", 4, 10, "barbell"),
        Exercise("ex_27", "Fondos entre Bancos", "Tríceps", "Tríceps Braquial", "Bancos Paralelos", "Manos en el borde del banco y baja doblando codos a 90°.", 3, 15, "bodyweight"),
        Exercise("ex_28", "Elevación de Piernas Colgado", "Abdomen", "Abdomen Inferior", "Barra de Dominadas", "Colgado de la barra, eleva las rodillas o piernas hacia el pecho.", 4, 15, "bodyweight"),
        Exercise("ex_29", "Crunch Banco Inclinado", "Abdomen", "Recto Abdominal", "Banco Inclinado", "Flexiona la columna apretando el abdomen sin jalar del cuello.", 4, 20, "bodyweight"),
        Exercise("ex_30", "Plancha Abdominal Iso", "Abdomen", "Core Transverso", "Tapete", "Mantén el cuerpo recto apoyado en antebrazos y puntas de pies durante 60s.", 4, 60, "timer")
    )

    private val localClients = mutableListOf(
        Client("cli_1", "Carlos Mendoza", "carlos@gmail.com", "+52 55 1234 5678", "Hipertrofia y Fuerza", 78.5, 178, "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80", "rout_carlos_1"),
        Client("cli_2", "Sofía Ramírez", "sofia@gmail.com", "+52 55 9876 5432", "Tonificación y Resistencia", 62.0, 165, "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80", "rout_sofia_1"),
        Client("cli_3", "Mateo Fernández", "mateo@gmail.com", "+52 55 4567 8901", "Pérdida de Grasa", 85.0, 182, "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80", "rout_mateo_1")
    )

    private val localCoach = Coach(
        id = "coach_1",
        name = "Coach Roberto 'Aura' Silva",
        email = "coach@gymaura.com",
        gymName = "Aura Performance Gym",
        avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
    )

    private val localWeightLogs = mutableListOf<WeightLog>()

    suspend fun testConnection(): Boolean {
        return try {
            val response = apiService?.checkHealth()
            val isOk = response != null && response.isSuccessful
            _isServerConnected.value = isOk
            isOk
        } catch (e: Exception) {
            _isServerConnected.value = false
            false
        }
    }

    suspend fun getCoachInfo(): Coach {
        return try {
            val response = apiService?.getCoachInfo()
            if (response != null && response.isSuccessful && response.body() != null) {
                _isServerConnected.value = true
                response.body()!!
            } else {
                _isServerConnected.value = false
                localCoach
            }
        } catch (e: Exception) {
            _isServerConnected.value = false
            localCoach
        }
    }

    suspend fun getExercises(category: String? = null, query: String? = null): List<Exercise> {
        try {
            val catParam = if (category == "Todos") null else category
            val response = apiService?.getExercises(catParam, query)
            if (response != null && response.isSuccessful && response.body() != null) {
                _isServerConnected.value = true
                return response.body()!!
            }
        } catch (e: Exception) {
            _isServerConnected.value = false
        }
        // Fallback local
        var list = localExercises.toList()
        if (category != null && category != "Todos") {
            list = list.filter { it.category.equals(category, ignoreCase = true) }
        }
        if (!query.isNullOrBlank()) {
            val q = query.lowercase()
            list = list.filter { it.name.lowercase().contains(q) || it.targetMuscle.lowercase().contains(q) }
        }
        return list
    }

    suspend fun addExercise(exercise: Exercise): Exercise {
        try {
            val response = apiService?.createExercise(exercise)
            if (response != null && response.isSuccessful && response.body() != null) {
                _isServerConnected.value = true
                return response.body()!!
            }
        } catch (e: Exception) {
            _isServerConnected.value = false
        }
        val created = exercise.copy(id = "ex_" + System.currentTimeMillis())
        localExercises.add(0, created)
        return created
    }

    suspend fun getClients(): List<Client> {
        try {
            val response = apiService?.getClients()
            if (response != null && response.isSuccessful && response.body() != null) {
                _isServerConnected.value = true
                return response.body()!!
            }
        } catch (e: Exception) {
            _isServerConnected.value = false
        }
        return localClients
    }

    suspend fun addClient(client: Client): Client {
        try {
            val response = apiService?.createClient(client)
            if (response != null && response.isSuccessful && response.body() != null) {
                _isServerConnected.value = true
                return response.body()!!
            }
        } catch (e: Exception) {
            _isServerConnected.value = false
        }
        val created = client.copy(id = "cli_" + System.currentTimeMillis())
        localClients.add(0, created)
        return created
    }

    suspend fun getWeeklyRoutine(clientId: String): WeeklyRoutine {
        try {
            val response = apiService?.getWeeklyRoutine(clientId)
            if (response != null && response.isSuccessful && response.body() != null) {
                _isServerConnected.value = true
                return response.body()!!
            }
        } catch (e: Exception) {
            _isServerConnected.value = false
        }
        // Fallback default routine
        val defaultDays = mapOf(
            "Lunes" to DaySchedule("Lunes", "Pecho y Bíceps", listOf(
                RoutineExercise("ex_1", 4, 10, 70.0),
                RoutineExercise("ex_2", 4, 12, 24.0),
                RoutineExercise("ex_22", 4, 12, 30.0)
            )),
            "Martes" to DaySchedule("Martes", "Pierna Completa", listOf(
                RoutineExercise("ex_11", 4, 10, 90.0),
                RoutineExercise("ex_12", 4, 12, 180.0),
                RoutineExercise("ex_15", 4, 12, 45.0)
            )),
            "Miércoles" to DaySchedule("Miércoles", "Descanso Activo", listOf(
                RoutineExercise("ex_30", 4, 60, 0.0)
            )),
            "Jueves" to DaySchedule("Jueves", "Espalda y Tríceps", listOf(
                RoutineExercise("ex_6", 4, 12, 60.0),
                RoutineExercise("ex_7", 4, 10, 65.0),
                RoutineExercise("ex_25", 4, 15, 25.0)
            )),
            "Viernes" to DaySchedule("Viernes", "Hombro y Abdomen", listOf(
                RoutineExercise("ex_18", 4, 8, 45.0),
                RoutineExercise("ex_20", 4, 15, 12.0),
                RoutineExercise("ex_28", 4, 15, 0.0)
            )),
            "Sábado" to DaySchedule("Sábado", "Descanso", emptyList()),
            "Domingo" to DaySchedule("Domingo", "Descanso", emptyList())
        )
        return WeeklyRoutine("rout_$clientId", clientId, "Rutina Semanal Hipertrofia", "Diseñada para máximo rendimiento", defaultDays)
    }

    suspend fun saveWeeklyRoutine(routine: WeeklyRoutine): WeeklyRoutine {
        try {
            val response = apiService?.saveWeeklyRoutine(routine)
            if (response != null && response.isSuccessful && response.body() != null) {
                _isServerConnected.value = true
                return response.body()!!
            }
        } catch (e: Exception) {
            _isServerConnected.value = false
        }
        return routine
    }

    suspend fun getWeightLogs(clientId: String, exerciseId: String? = null): List<WeightLog> {
        try {
            val response = apiService?.getWeightLogs(clientId, exerciseId)
            if (response != null && response.isSuccessful && response.body() != null) {
                _isServerConnected.value = true
                return response.body()!!
            }
        } catch (e: Exception) {
            _isServerConnected.value = false
        }
        var logs = localWeightLogs.filter { it.clientId == clientId }
        if (exerciseId != null) {
            logs = logs.filter { it.exerciseId == exerciseId }
        }
        return logs
    }

    suspend fun logWeight(log: WeightLog): WeightLog {
        try {
            val response = apiService?.logWeight(log)
            if (response != null && response.isSuccessful && response.body() != null) {
                _isServerConnected.value = true
                return response.body()!!
            }
        } catch (e: Exception) {
            _isServerConnected.value = false
        }
        val created = log.copy(id = "log_" + System.currentTimeMillis())
        localWeightLogs.add(0, created)
        return created
    }
}
