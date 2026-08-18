package com.tecti.gymaura.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface SetLogDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSetLog(setLog: SetLogEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(setLogs: List<SetLogEntity>)

    @Query("SELECT * FROM set_logs WHERE isSynced = 0 ORDER BY timestamp ASC")
    suspend fun getPendingSetLogs(): List<SetLogEntity>

    @Query("UPDATE set_logs SET isSynced = 1 WHERE clientLogId IN (:clientLogIds)")
    suspend fun markAsSynced(clientLogIds: List<String>)

    @Query("SELECT * FROM set_logs WHERE exerciseId = :exerciseId ORDER BY timestamp DESC LIMIT 1")
    suspend fun getLastSetForExercise(exerciseId: String): SetLogEntity?

    @Query("SELECT * FROM set_logs WHERE exerciseId = :exerciseId ORDER BY timestamp DESC LIMIT :limit")
    fun getSetLogsForExercise(exerciseId: String, limit: Int = 20): Flow<List<SetLogEntity>>

    @Query("SELECT * FROM set_logs ORDER BY timestamp DESC")
    fun getAllSetLogs(): Flow<List<SetLogEntity>>

    @Query("SELECT COUNT(*) FROM set_logs")
    suspend fun count(): Int

    @Query("UPDATE set_logs SET isSynced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)

    @Query("DELETE FROM set_logs WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM set_logs WHERE exerciseId = :exerciseId AND timestamp >= :dayStart AND timestamp < :dayEnd")
    suspend fun deleteByExerciseAndDay(exerciseId: String, dayStart: Long, dayEnd: Long)

    @Query("DELETE FROM set_logs WHERE timestamp >= :dayStart AND timestamp < :dayEnd")
    suspend fun deleteByDay(dayStart: Long, dayEnd: Long)

    @Query("DELETE FROM set_logs")
    suspend fun deleteAll()
}
