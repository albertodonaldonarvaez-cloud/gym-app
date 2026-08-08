'use strict';

/**
 * seed-exercises-extra.js
 * Agrega ~400 ejercicios adicionales del dataset sergei-argutin/exercise-dataset
 * Estos se suman a los ~900 del free-exercise-db para llegar a 1300+
 * Repo: https://github.com/sergei-argutin/exercise-dataset
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DATASET_URL =
  'https://raw.githubusercontent.com/sergei-argutin/exercise-dataset/main/exercises.json';

const IMAGE_CDN =
  'https://raw.githubusercontent.com/sergei-argutin/exercise-dataset/main/';

// ─── Mapeo muscles → ES ─────────────────────────────────────────────────────
const MUSCLE_MAP = {
  rectus_abdominis: 'Abdomen', transverse_abdominis: 'Abdomen', obliques: 'Oblicuos',
  pectoralis_major: 'Pecho', pectoralis_minor: 'Pecho',
  latissimus_dorsi: 'Espalda (Lat)', rhomboids: 'Espalda Media',
  erector_spinae: 'Espalda Baja', trapezius: 'Trapecios',
  anterior_deltoid: 'Hombros', lateral_deltoid: 'Hombros', posterior_deltoid: 'Hombros', deltoids: 'Hombros',
  biceps_brachii: 'Bíceps', brachialis: 'Bíceps',
  triceps_brachii: 'Tríceps',
  forearm_flexors: 'Antebrazos', forearm_extensors: 'Antebrazos',
  quadriceps: 'Cuádriceps', vastus_lateralis: 'Cuádriceps',
  hamstrings: 'Isquiotibiales', biceps_femoris: 'Isquiotibiales',
  gluteus_maximus: 'Glúteos', gluteus_medius: 'Glúteos',
  calves: 'Gemelos', gastrocnemius: 'Gemelos', soleus: 'Gemelos',
  hip_flexors: 'Flexores de Cadera', hip_adductors: 'Aductores', hip_abductors: 'Abductores',
  serratus_anterior: 'Serrato', 
  levator_scapulae: 'Cuello',
  tensor_fasciae_latae: 'Tensor de la Fascia Lata',
  tibialis_anterior: 'Tibial Anterior',
  infraspinatus: 'Manguito Rotador', supraspinatus: 'Manguito Rotador',
  teres_major: 'Espalda', teres_minor: 'Espalda',
};

// ─── Mapeo body_part → ES ───────────────────────────────────────────────────
const BODY_PART_MAP = {
  core: 'Abdomen', chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros',
  upper_arms: 'Brazos', lower_arms: 'Antebrazos', upper_legs: 'Piernas',
  lower_legs: 'Piernas', full_body: 'Cuerpo Completo', cardio: 'Cardio',
  glutes: 'Glúteos', hips: 'Caderas',
};

// ─── Mapeo equipment → ES ───────────────────────────────────────────────────
const EQUIPMENT_MAP = {
  barbell: 'Barra', dumbbell: 'Mancuernas', cable: 'Polea / Cable',
  machine: 'Máquina', bodyweight: 'Peso Corporal', kettlebell: 'Kettlebell',
  resistance_band: 'Bandas Elásticas', medicine_ball: 'Balón Medicinal',
  exercise_ball: 'Pelota de Ejercicio', foam_roller: 'Foam Roller',
  ez_curl_bar: 'Barra EZ', smith_machine: 'Smith Machine',
  pull_up_bar: 'Barra de Dominadas', bench: 'Banco', dip_bars: 'Barras Paralelas',
  ab_wheel: 'Rueda Abdominal', trx: 'TRX', battle_ropes: 'Cuerdas de Batalla',
  box: 'Cajón', jump_rope: 'Cuerda de Saltar', sled: 'Trineo',
  trap_bar: 'Trap Bar', rings: 'Anillas', landmine: 'Landmine',
  wrist_roller: 'Rodillo de Muñeca', parallettes: 'Parallettes',
  safety_squat_bar: 'Barra Sentadilla Segura', none: 'Sin Equipamiento',
};

// ─── Mapeo category → ES ────────────────────────────────────────────────────
const CATEGORY_MAP = {
  strength: 'Fuerza', stretching: 'Estiramiento', plyometrics: 'Pliométricos',
  cardio: 'Cardio', olympic_weightlifting: 'Halterofilia',
  powerlifting: 'Powerlifting', strongman: 'Strongman',
  calisthenics: 'Calistenia', mobility: 'Movilidad',
};

async function main() {
  console.log('📥 Descargando dataset adicional de ejercicios...');
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const exercises = json.exercises || json;

  console.log(`📦 ${exercises.length} ejercicios adicionales encontrados`);

  let created = 0, skipped = 0;
  const batchSize = 50;

  for (let i = 0; i < exercises.length; i += batchSize) {
    const batch = exercises.slice(i, i + batchSize);
    
    for (const ex of batch) {
      try {
        // Use Spanish name if available, fallback to English
        const name = ex.name_es || ex.name_en || ex.name || 'Sin nombre';
        
        // Check if exercise already exists by name
        const existing = await prisma.exercise.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } }
        });
        
        if (existing) { skipped++; continue; }
        
        // Also check by English name to avoid duplicates from other seeds
        if (ex.name_en) {
          const existingEn = await prisma.exercise.findFirst({
            where: { name: { equals: ex.name_en, mode: 'insensitive' } }
          });
          if (existingEn) { skipped++; continue; }
        }

        const primaryMuscle = ex.primary_muscles?.[0] || '';
        const muscleGroup = MUSCLE_MAP[primaryMuscle] || BODY_PART_MAP[ex.body_part] || ex.body_part || 'General';
        const equipment = EQUIPMENT_MAP[ex.equipment] || ex.equipment || 'Sin Equipamiento';
        const category = CATEGORY_MAP[ex.category] || ex.category || 'Fuerza';

        // Instructions: prefer Spanish
        const instructions = ex.instructions_es
          ? ex.instructions_es.join('\n')
          : ex.instructions_en
            ? ex.instructions_en.join('\n')
            : '';

        // Images
        const imageUrls = [];
        if (ex.images?.flat) {
          const flatObj = ex.images.flat;
          if (typeof flatObj === 'object') {
            for (const key of Object.keys(flatObj)) {
              imageUrls.push(`${IMAGE_CDN}${flatObj[key]}`);
            }
          }
        }

        // Default sets/reps based on category
        let defaultSets = 3, defaultReps = 10;
        if (category === 'Estiramiento' || category === 'Movilidad') { defaultSets = 2; defaultReps = 30; }
        if (category === 'Cardio') { defaultSets = 3; defaultReps = 60; }
        if (category === 'Pliométricos') { defaultSets = 3; defaultReps = 8; }
        if (category === 'Fuerza' && ex.difficulty === 'advanced') { defaultSets = 5; defaultReps = 5; }

        await prisma.exercise.create({
          data: {
            name,
            category,
            targetMuscle: muscleGroup,
            muscleGroup,
            equipment,
            instructions,
            defaultSets,
            defaultReps,
            mediaUrl: imageUrls[0] || null,
            imageUrls,
            icon: 'dumbbell',
          }
        });
        created++;
      } catch (err) {
        // Skip duplicates or errors
        if (err.code === 'P2002') { skipped++; }
        else { console.warn(`⚠️  Error en ${ex.name_en}: ${err.message}`); }
      }
    }
    
    if ((i + batchSize) % 100 === 0 || i + batchSize >= exercises.length) {
      console.log(`   Progreso: ${Math.min(i + batchSize, exercises.length)}/${exercises.length} | Creados: ${created} | Omitidos: ${skipped}`);
    }
  }

  console.log(`\n✅ Seed adicional completado:`);
  console.log(`   📊 Creados: ${created}`);
  console.log(`   ⏭️  Omitidos (duplicados): ${skipped}`);
  
  const total = await prisma.exercise.count();
  console.log(`   💪 Total ejercicios en DB: ${total}`);
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
