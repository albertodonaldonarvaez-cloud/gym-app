package com.tecti.gymaura.data.remote

import com.tecti.gymaura.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ─── HEALTH ────────────────────────────────────────────────────────────────
    @GET("api/health")
    suspend fun getHealth(): Response<Map<String, String>>

    // ─── AUTH ──────────────────────────────────────────────────────────────────
    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("api/v1/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    // ─── COACH & CLIENTS ───────────────────────────────────────────────────────
    @GET("api/coach")
    suspend fun getCoach(@Header("Authorization") token: String): Response<CoachInfo>

    @GET("api/clients")
    suspend fun getClients(@Header("Authorization") token: String): Response<List<Client>>

    @POST("api/clients")
    suspend fun createClient(
        @Header("Authorization") token: String,
        @Body client: Map<String, String>
    ): Response<Client>

    // ─── EXERCISES ─────────────────────────────────────────────────────────────
    @GET("api/exercises")
    suspend fun getExercises(
        @Query("category") category: String? = null,
        @Query("search") search: String? = null,
        @Query("limit") limit: Int = 1000
    ): Response<ExercisesResponse>

    @POST("api/exercises")
    suspend fun createExercise(
        @Header("Authorization") token: String,
        @Body exercise: Map<String, String>
    ): Response<Exercise>

    // ─── ROUTINES ──────────────────────────────────────────────────────────────
    @GET("api/routines/weekly/{clientId}")
    suspend fun getWeeklyRoutine(
        @Header("Authorization") token: String,
        @Path("clientId") clientId: String
    ): Response<WeeklyRoutine>

    @POST("api/routines/weekly")
    suspend fun saveWeeklyRoutine(
        @Header("Authorization") token: String,
        @Body body: Map<String, Any>
    ): Response<WeeklyRoutine>

    // V1: current user's own routine (enriched with media URLs)
    @GET("api/v1/routines/current-week")
    suspend fun getCurrentWeekRoutine(
        @Header("Authorization") token: String
    ): Response<WeeklyRoutine>

    // ─── LOGS (LEGACY) ─────────────────────────────────────────────────────────
    @GET("api/logs/{clientId}")
    suspend fun getWeightLogs(
        @Header("Authorization") token: String,
        @Path("clientId") clientId: String,
        @Query("exerciseId") exerciseId: String? = null
    ): Response<List<WeightLog>>

    @POST("api/logs")
    suspend fun logSet(
        @Header("Authorization") token: String,
        @Body log: Map<String, Any>
    ): Response<WeightLog>

    // ─── V1 SYNC ───────────────────────────────────────────────────────────────
    data class SyncSetDto(
        val clientLogId: String,
        val exerciseId: String,
        val workoutLogId: String?,
        val weightKg: Double,
        val reps: Int,
        val rpe: Double,
        val setNumber: Int,
        val notes: String
    )

    data class SyncRequest(val sets: List<SyncSetDto>)

    @POST("api/v1/workouts/sync")
    suspend fun syncWorkouts(
        @Header("Authorization") token: String,
        @Body body: SyncRequest
    ): Response<SyncResponse>

    // ─── V1 HISTORY & RECORDS ──────────────────────────────────────────────────
    @GET("api/v1/user/workout-history")
    suspend fun getWorkoutHistory(
        @Header("Authorization") token: String
    ): Response<List<WorkoutHistoryItem>>

    @GET("api/v1/exercises/{id}/last-performance")
    suspend fun getLastPerformance(
        @Header("Authorization") token: String,
        @Path("id") exerciseId: String
    ): Response<LastPerformance>

    // ─── HUAWEI HEALTH ─────────────────────────────────────────────────────────────
    @POST("api/v1/huawei/sync-workout")
    suspend fun syncHuaweiWorkout(
        @Header("Authorization") token: String,
        @Body data: HuaweiWorkoutData
    ): Response<Map<String, Any>>

    // ─── ROUTINE TEMPLATES ─────────────────────────────────────────────────────────
    @GET("api/v1/coach/templates")
    suspend fun getTemplates(
        @Header("Authorization") token: String
    ): Response<List<RoutineTemplate>>

    @POST("api/v1/coach/templates")
    suspend fun saveTemplate(
        @Header("Authorization") token: String,
        @Body template: RoutineTemplate
    ): Response<RoutineTemplate>

    @DELETE("api/v1/coach/templates/{id}")
    suspend fun deleteTemplate(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): Response<Map<String, Any>>

    @POST("api/v1/coach/templates/{id}/assign")
    suspend fun assignTemplate(
        @Header("Authorization") token: String,
        @Path("id") templateId: String,
        @Body body: AssignTemplateRequest
    ): Response<AssignTemplateResponse>
}
