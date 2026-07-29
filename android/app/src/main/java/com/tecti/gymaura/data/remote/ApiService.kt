package com.tecti.gymaura.data.remote

import com.tecti.gymaura.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    @GET("api/health")
    suspend fun checkHealth(): Response<ServerHealth>

    @GET("api/coach")
    suspend fun getCoachInfo(): Response<Coach>

    @GET("api/exercises")
    suspend fun getExercises(
        @Query("category") category: String? = null,
        @Query("search") search: String? = null
    ): Response<List<Exercise>>

    @POST("api/exercises")
    suspend fun createExercise(@Body exercise: Exercise): Response<Exercise>

    @GET("api/clients")
    suspend fun getClients(): Response<List<Client>>

    @POST("api/clients")
    suspend fun createClient(@Body client: Client): Response<Client>

    @GET("api/routines/weekly/{clientId}")
    suspend fun getWeeklyRoutine(@Path("clientId") clientId: String): Response<WeeklyRoutine>

    @POST("api/routines/weekly")
    suspend fun saveWeeklyRoutine(@Body routine: WeeklyRoutine): Response<WeeklyRoutine>

    @GET("api/logs/{clientId}")
    suspend fun getWeightLogs(
        @Path("clientId") clientId: String,
        @Query("exerciseId") exerciseId: String? = null
    ): Response<List<WeightLog>>

    @POST("api/logs")
    suspend fun logWeight(@Body log: WeightLog): Response<WeightLog>
}
