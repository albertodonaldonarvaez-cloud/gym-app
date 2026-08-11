package com.tecti.gymaura.data.local
import androidx.room.*

@Entity(tableName = "cached_routines")
data class CachedRoutineEntity(
    @PrimaryKey val athleteId: String,
    val routineJson: String,
    val cachedAt: Long = System.currentTimeMillis()
)

@Dao
interface CachedRoutineDao {
    @Query("SELECT * FROM cached_routines WHERE athleteId = :athleteId LIMIT 1")
    suspend fun getByAthleteId(athleteId: String): CachedRoutineEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: CachedRoutineEntity)
}
