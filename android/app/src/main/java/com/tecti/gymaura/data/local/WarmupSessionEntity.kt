package com.tecti.gymaura.data.local
import androidx.room.*
import java.util.UUID

@Entity(tableName = "warmup_sessions")
data class WarmupSessionEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
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
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: WarmupSessionEntity)
    
    @Query("UPDATE warmup_sessions SET isSynced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)
    
    @Query("SELECT * FROM warmup_sessions WHERE isSynced = 0")
    suspend fun getUnsynced(): List<WarmupSessionEntity>
}
