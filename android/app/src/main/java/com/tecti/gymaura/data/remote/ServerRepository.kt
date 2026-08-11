package com.tecti.gymaura.data.remote

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.tecti.gymaura.data.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import com.tecti.gymaura.data.local.AppDatabase
import com.tecti.gymaura.data.local.CachedRoutineEntity
import com.tecti.gymaura.data.local.WarmupSessionEntity

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "gymaura_prefs")

object ServerRepository {

    private const val TAG = "ServerRepository"

    // Keys
    private val TOKEN_KEY = stringPreferencesKey("auth_token")
    private val BASE_URL_KEY = stringPreferencesKey("base_url")
    private val USER_ID_KEY = stringPreferencesKey("user_id")
    private val USER_NAME_KEY = stringPreferencesKey("user_name")
    private val USER_ROLE_KEY = stringPreferencesKey("user_role")

    // Default URL
    private var baseUrl: String = "https://gym-app.tecti-cloud.com/"
    private var _token: String? = null
    private var _userId: String? = null
    private var _userRole: String? = null
    private var _userName: String? = null

    private val _currentUrlState = MutableStateFlow(baseUrl)
    val currentUrlState: StateFlow<String> = _currentUrlState

    private val _isServerConnected = MutableStateFlow(false)
    val isServerConnected: StateFlow<Boolean> = _isServerConnected

    private var _appContext: Context? = null

    // Initialize with context (call from Application class)
    fun init(context: Context) {
        _appContext = context.applicationContext
    }

    // ─── RETROFIT INSTANCE ────────────────────────────────────────────────────
    private fun buildApi(url: String): ApiService {
        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
        return Retrofit.Builder()
            .baseUrl(url)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }

    private fun api(): ApiService = buildApi(baseUrl)

    // ─── TOKEN & SESSION ──────────────────────────────────────────────────────
    fun getToken(): String? = _token
    fun getUserId(): String? = _userId
    fun getUserRole(): String? = _userRole
    fun getUserName(): String? = _userName
    fun getUserEmail(): String? = null
    fun isLoggedIn(): Boolean = !_token.isNullOrBlank()

    suspend fun getCoachInfo(): Coach? {
        return try {
            val resp = api().getCoach(authHeader())
            if (resp.isSuccessful) {
                resp.body()?.let { info -> Coach(id = info.id, name = info.name, email = info.email, avatar = info.avatar) }
            } else null
        } catch (e: Exception) { Log.e(TAG, "getCoachInfo error: ${e.message}"); null }
    }

    private fun authHeader(): String = "Bearer ${_token ?: ""}"

    suspend fun loadSession() {
        val ctx = _appContext ?: return
        val prefs = ctx.dataStore.data.first()
        _token = prefs[TOKEN_KEY]
        _userId = prefs[USER_ID_KEY]
        _userRole = prefs[USER_ROLE_KEY]
        _userName = prefs[USER_NAME_KEY]
        baseUrl = prefs[BASE_URL_KEY] ?: baseUrl
        _currentUrlState.value = baseUrl
    }

    private suspend fun saveSession(token: String, user: AuthUser) {
        _token = token
        _userId = user.id
        _userRole = user.role
        _userName = user.name
        _appContext?.dataStore?.edit { prefs ->
            prefs[TOKEN_KEY] = token
            prefs[USER_ID_KEY] = user.id
            prefs[USER_ROLE_KEY] = user.role
            prefs[USER_NAME_KEY] = user.name
        }
    }

    suspend fun clearSession() {
        _token = null; _userId = null; _userRole = null; _userName = null
        _appContext?.dataStore?.edit { it.clear() }
    }

    fun setBaseUrl(url: String) {
        val clean = if (url.endsWith("/")) url else "$url/"
        baseUrl = clean
        _currentUrlState.value = clean
    }

    fun updateBaseUrl(url: String) {
        setBaseUrl(url)
    }

    // ─── AUTH ──────────────────────────────────────────────────────────────────
    suspend fun login(email: String, password: String): AuthResponse? {
        return try {
            val resp = api().login(LoginRequest(email, password))
            if (resp.isSuccessful) {
                resp.body()?.also { saveSession(it.token, it.user) }
            } else null
        } catch (e: Exception) { Log.e(TAG, "Login error: ${e.message}"); null }
    }

    suspend fun register(email: String, password: String, name: String, role: String = "CLIENT", coachId: String? = null): AuthResponse? {
        return try {
            val resp = api().register(RegisterRequest(email, password, name, role, coachId))
            if (resp.isSuccessful) resp.body()?.also { saveSession(it.token, it.user) } else null
        } catch (e: Exception) { Log.e(TAG, "Register error: ${e.message}"); null }
    }

    // ─── EXERCISES ────────────────────────────────────────────────────────────
    suspend fun getExercises(category: String? = null, search: String? = null): List<Exercise> {
        return try {
            val resp = api().getExercises(category, search)
            if (resp.isSuccessful) resp.body()?.data ?: emptyList() else emptyList()
        } catch (e: Exception) { Log.e(TAG, "getExercises error: ${e.message}"); emptyList() }
    }

    suspend fun addExercise(exercise: Exercise): Exercise? {
        return try {
            val body = mapOf(
                "name" to exercise.name,
                "category" to exercise.category,
                "targetMuscle" to exercise.targetMuscle,
                "equipment" to exercise.equipment,
                "instructions" to exercise.instructions
            )
            val resp = api().createExercise(authHeader(), body)
            if (resp.isSuccessful) resp.body() else null
        } catch (e: Exception) { Log.e(TAG, "addExercise error: ${e.message}"); null }
    }

    // ─── CLIENTS ──────────────────────────────────────────────────────────────
    suspend fun getClients(): List<Client> {
        return try {
            val resp = api().getClients(authHeader())
            if (resp.isSuccessful) resp.body() ?: emptyList() else emptyList()
        } catch (e: Exception) { Log.e(TAG, "getClients error: ${e.message}"); emptyList() }
    }

    suspend fun addClient(client: Client): Client? {
        return try {
            val body = mapOf(
                "name" to client.name,
                "email" to client.email,
                "goal" to client.goal,
                "weightKg" to client.weightKg.toString(),
                "heightCm" to client.heightCm.toString()
            )
            val resp = api().createClient(authHeader(), body)
            if (resp.isSuccessful) resp.body() else null
        } catch (e: Exception) { Log.e(TAG, "addClient error: ${e.message}"); null }
    }

    // ─── ROUTINES ─────────────────────────────────────────────────────────────
    suspend fun getWeeklyRoutine(clientId: String): WeeklyRoutine? {
        return try {
            val resp = api().getWeeklyRoutine(authHeader(), clientId)
            if (resp.isSuccessful) resp.body() else null
        } catch (e: Exception) { Log.e(TAG, "getWeeklyRoutine error: ${e.message}"); null }
    }

    suspend fun getCurrentWeekRoutine(): WeeklyRoutine? {
        return try {
            val resp = api().getCurrentWeekRoutine(authHeader())
            if (resp.isSuccessful) resp.body() else null
        } catch (e: Exception) { Log.e(TAG, "getCurrentWeekRoutine error: ${e.message}"); null }
    }

    suspend fun saveWeeklyRoutine(clientId: String, title: String, description: String, schedule: Map<String, Any>): WeeklyRoutine? {
        return try {
            val body = mapOf("clientId" to clientId, "title" to title, "description" to description, "schedule" to schedule)
            val resp = api().saveWeeklyRoutine(authHeader(), body)
            if (resp.isSuccessful) resp.body() else null
        } catch (e: Exception) { Log.e(TAG, "saveWeeklyRoutine error: ${e.message}"); null }
    }

    suspend fun saveWeeklyRoutine(routine: WeeklyRoutine): WeeklyRoutine? {
        return saveWeeklyRoutine(routine.clientId, routine.title, routine.description, routine.schedule as Map<String, Any>)
    }

    // ─── WEIGHT LOGS ──────────────────────────────────────────────────────────
    suspend fun getWeightLogs(clientId: String, exerciseId: String? = null): List<WeightLog> {
        return try {
            val resp = api().getWeightLogs(authHeader(), clientId, exerciseId)
            if (resp.isSuccessful) resp.body() ?: emptyList() else emptyList()
        } catch (e: Exception) { Log.e(TAG, "getWeightLogs error: ${e.message}"); emptyList() }
    }

    // ─── SYNC ─────────────────────────────────────────────────────────────────
    suspend fun syncWorkouts(sets: List<ApiService.SyncSetDto>): SyncResponse? {
        return try {
            val resp = api().syncWorkouts(authHeader(), ApiService.SyncRequest(sets))
            if (resp.isSuccessful) resp.body() else null
        } catch (e: Exception) { Log.e(TAG, "syncWorkouts error: ${e.message}"); null }
    }

    // ─── HISTORY & RECORDS ────────────────────────────────────────────────────
    suspend fun getWorkoutHistory(): List<WorkoutHistoryItem> {
        return try {
            val resp = api().getWorkoutHistory(authHeader())
            if (resp.isSuccessful) resp.body() ?: emptyList() else emptyList()
        } catch (e: Exception) { Log.e(TAG, "getWorkoutHistory error: ${e.message}"); emptyList() }
    }

    suspend fun getLastPerformance(exerciseId: String): LastPerformance? {
        return try {
            val resp = api().getLastPerformance(authHeader(), exerciseId)
            if (resp.isSuccessful) resp.body() else null
        } catch (e: Exception) { Log.e(TAG, "getLastPerformance error: ${e.message}"); null }
    }

    // ─── HUAWEI HEALTH ────────────────────────────────────────────────────────
    suspend fun syncHuaweiWorkout(data: HuaweiWorkoutData): Boolean {
        return try {
            val resp = api().syncHuaweiWorkout(authHeader(), data)
            resp.isSuccessful
        } catch (e: Exception) { Log.e(TAG, "syncHuaweiWorkout error: ${e.message}"); false }
    }

    // ─── HEALTH CHECK ─────────────────────────────────────────────────────────
    suspend fun checkHealth(): Boolean {
        return try {
            val resp = api().getHealth()
            resp.isSuccessful
        } catch (e: Exception) { false }
    }

    suspend fun testConnection(): Boolean {
        val result = checkHealth()
        _isServerConnected.value = result
        return result
    }

    // ─── ROUTINE TEMPLATES ────────────────────────────────────────────────────
    suspend fun getTemplates(): List<RoutineTemplate> {
        return try {
            val resp = api().getTemplates(authHeader())
            if (resp.isSuccessful) resp.body() ?: emptyList() else emptyList()
        } catch (e: Exception) { Log.e(TAG, "getTemplates error: ${e.message}"); emptyList() }
    }

    suspend fun saveTemplate(template: RoutineTemplate): RoutineTemplate? {
        return try {
            val resp = api().saveTemplate(authHeader(), template)
            if (resp.isSuccessful) resp.body() else null
        } catch (e: Exception) { Log.e(TAG, "saveTemplate error: ${e.message}"); null }
    }

    suspend fun deleteTemplate(id: String): Boolean {
        return try {
            val resp = api().deleteTemplate(authHeader(), id)
            resp.isSuccessful
        } catch (e: Exception) { Log.e(TAG, "deleteTemplate error: ${e.message}"); false }
    }

    suspend fun assignTemplate(templateId: String, clientIds: List<String>): AssignTemplateResponse? {
        return try {
            val resp = api().assignTemplate(authHeader(), templateId, AssignTemplateRequest(clientIds))
            if (resp.isSuccessful) resp.body() else null
        } catch (e: Exception) { Log.e(TAG, "assignTemplate error: ${e.message}"); null }
    }
    // ─── OFFLINE CACHE ────────────────────────────────────────────────────────────
    private fun getDb(): AppDatabase = AppDatabase.getDatabase(_appContext!!)

    suspend fun downloadAndCacheRoutine() {
        try {
            val routine = getCurrentWeekRoutine() ?: return
            val json = com.google.gson.Gson().toJson(routine)
            val athleteId = _userId ?: return
            getDb().cachedRoutineDao().upsert(
                com.tecti.gymaura.data.local.CachedRoutineEntity(athleteId = athleteId, routineJson = json)
            )
        } catch (e: Exception) { Log.e(TAG, "Cache routine error: ${e.message}") }
    }

    suspend fun getCachedRoutine(): com.tecti.gymaura.data.model.WeeklyRoutine? {
        return try {
            val athleteId = _userId ?: return null
            val entity = getDb().cachedRoutineDao().getByAthleteId(athleteId) ?: return null
            com.google.gson.Gson().fromJson(entity.routineJson, com.tecti.gymaura.data.model.WeeklyRoutine::class.java)
        } catch (e: Exception) { null }
    }

    // ─── WARMUP ───────────────────────────────────────────────────────────────────
    suspend fun startWarmup(startedAt: Long): String? {
        return try {
            val localId = java.util.UUID.randomUUID().toString()
            getDb().warmupSessionDao().insert(
                com.tecti.gymaura.data.local.WarmupSessionEntity(id = localId, startedAt = startedAt)
            )
            // Try server sync
            try {
                val resp = api().startWarmup(authHeader(), mapOf("startedAt" to java.util.Date(startedAt).toString()))
                if (resp.isSuccessful) resp.body()?.get("id")?.toString() else localId
            } catch (_: Exception) { localId }
        } catch (e: Exception) { Log.e(TAG, "startWarmup: ${e.message}"); null }
    }

    suspend fun finishWarmup(warmupId: String, durationSec: Int, notes: String) {
        try {
            getDb().warmupSessionDao().insert(
                com.tecti.gymaura.data.local.WarmupSessionEntity(
                    id = warmupId, durationSec = durationSec, notes = notes,
                    finishedAt = System.currentTimeMillis(), isSynced = false
                )
            )
            // Try server
            val body = mapOf("warmupId" to warmupId, "durationSec" to durationSec, "notes" to notes)
            try { api().finishWarmup(authHeader(), body) } catch (_: Exception) {}
        } catch (e: Exception) { Log.e(TAG, "finishWarmup: ${e.message}") }
    }

    suspend fun getWarmupHistory(): List<com.tecti.gymaura.data.local.WarmupSessionEntity> {
        return try {
            getDb().warmupSessionDao().getRecent()
        } catch (e: Exception) { emptyList() }
    }

    // ─── WORKOUT SESSION ──────────────────────────────────────────────────────────
    suspend fun saveWorkoutSession(sessionId: String, dayName: String, startedAt: Long, finishedAt: Long, durationSeconds: Int): Boolean {
        return try {
            val body = mapOf(
                "sessionId" to sessionId,
                "dayName" to dayName,
                "startedAt" to java.util.Date(startedAt).toString(),
                "finishedAt" to java.util.Date(finishedAt).toString(),
                "durationSeconds" to durationSeconds
            )
            val resp = api().saveWorkoutSession(authHeader(), body)
            resp.isSuccessful
        } catch (e: Exception) { Log.e(TAG, "saveWorkoutSession: ${e.message}"); false }
    }

    // ─── CUSTOM EXERCISES ─────────────────────────────────────────────────────────
    suspend fun createCustomExercise(
        name: String, muscleGroup: String, category: String,
        equipment: String, instructions: String, videoUrl: String
    ): Map<String, Any>? {
        return try {
            val body = mapOf(
                "name" to name, "muscleGroup" to muscleGroup,
                "category" to category, "equipment" to equipment,
                "instructions" to instructions, "videoUrl" to videoUrl
            )
            val resp = api().createCustomExercise(authHeader(), body)
            @Suppress("UNCHECKED_CAST")
            if (resp.isSuccessful) resp.body() as? Map<String, Any> else null
        } catch (e: Exception) { Log.e(TAG, "createCustomExercise: ${e.message}"); null }
    }
}
