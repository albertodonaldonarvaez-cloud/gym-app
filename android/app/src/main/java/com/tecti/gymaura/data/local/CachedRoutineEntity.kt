package com.tecti.gymaura.data.local
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "cached_routines")
data class CachedRoutineEntity(
    @PrimaryKey val athleteId: String,
    val routineJson: String,
    val routineId: String = "",           // server routine ID for version check
    val routineUpdatedAt: Long = 0L,      // server updatedAt millis for version check
    val cachedAt: Long = System.currentTimeMillis()
)

@Dao
interface CachedRoutineDao {
    @Query("SELECT * FROM cached_routines WHERE athleteId = :athleteId LIMIT 1")
    suspend fun getByAthleteId(athleteId: String): CachedRoutineEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: CachedRoutineEntity)
}

@Entity(tableName = "warmup_sessions")
data class WarmupSessionEntity(
    @PrimaryKey val id: String = java.util.UUID.randomUUID().toString(),
    val startedAt: Long = System.currentTimeMillis(),
    val finishedAt: Long? = null,
    val durationSec: Int = 0,
    val notes: String = "",
    val isSynced: Boolean = false
)

@Dao
interface WarmupSessionDao {
    @Query("SELECT * FROM warmup_sessions ORDER BY startedAt DESC LIMIT 30")
    suspend fun getRecent(): List<WarmupSessionEntity>

    @Query("SELECT * FROM warmup_sessions ORDER BY startedAt DESC LIMIT 50")
    fun getAllFlow(): Flow<List<WarmupSessionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: WarmupSessionEntity)

    @Query("UPDATE warmup_sessions SET isSynced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)

    @Query("SELECT * FROM warmup_sessions WHERE isSynced = 0")
    suspend fun getUnsynced(): List<WarmupSessionEntity>

    @Query("DELETE FROM warmup_sessions WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM warmup_sessions")
    suspend fun deleteAll()
}
