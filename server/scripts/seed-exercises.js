'use strict';

/**
 * seed-exercises.js
 * Pobla la tabla Exercise con el catálogo Open Source de Free Exercise DB
 * Repo: https://github.com/yuhonas/free-exercise-db
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── CDN Base URL ────────────────────────────────────────────────────────────
const FREE_EXERCISE_DB_JSON =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const FREE_EXERCISE_DB_IMAGES_CDN =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

// ─── Mapeo de grupos musculares EN → ES ──────────────────────────────────────
const MUSCLE_TRANSLATIONS = {
  abdominals:         'Abdomen',
  abductors:          'Abductores',
  adductors:          'Aductores',
  biceps:             'Bíceps',
  calves:             'Gemelos',
  chest:              'Pecho',
  forearms:           'Antebrazos',
  glutes:             'Glúteos',
  hamstrings:         'Isquiotibiales',
  'hip flexors':      'Flexores de Cadera',
  'it band':          'Banda IT',
  'lats':             'Espalda (Lat)',
  'lower back':       'Espalda Baja',
  'middle back':      'Espalda Media',
  'neck':             'Cuello',
  'quadriceps':       'Cuádriceps',
  'shoulders':        'Hombros',
  'traps':            'Trapecios',
  'triceps':          'Tríceps',
  'lower body':       'Tren Inferior',
  'upper body':       'Tren Superior',
  'full body':        'Cuerpo Completo',
};

// ─── Mapeo de equipamiento EN → ES ───────────────────────────────────────────
const EQUIPMENT_TRANSLATIONS = {
  'barbell':          'Barra',
  'cable':            'Polea / Cable',
  'dumbbell':         'Mancuernas',
  'e-z curl bar':     'Barra EZ',
  'exercise ball':    'Pelota de Ejercicio',
  'foam roll':        'Foam Roller',
  'kettlebells':      'Kettlebell',
  'machine':          'Máquina',
  'medicine ball':    'Balón Medicinal',
  'other':            'Otro',
  'bands':            'Bandas Elásticas',
  'body only':        'Peso Corporal',
  'none':             'Sin Equipamiento',
};

// ─── Mapeo de categorías EN → ES ─────────────────────────────────────────────
const CATEGORY_TRANSLATIONS = {
  'cardio':           'Cardio',
  'olympic weightlifting': 'Halterofilia',
  'plyometrics':      'Pliométricos',
  'powerlifting':     'Powerlifting',
  'strength':         'Fuerza',
  'stretching':       'Estiramiento',
  'strongman':        'Strongman',
};

// ─── Defaults de series/reps según categoría ─────────────────────────────────
const CATEGORY_DEFAULTS = {
  'cardio':           { sets: 1,  reps: 30 },
  'stretching':       { sets: 3,  reps: 30 },
  'plyometrics':      { sets: 3,  reps: 10 },
  'powerlifting':     { sets: 5,  reps: 5  },
  'olympic weightlifting': { sets: 4, reps: 5 },
  'strength':         { sets: 4,  reps: 10 },
  'strongman':        { sets: 3,  reps: 8  },
};

function translateMuscle(muscle) {
  if (!muscle) return 'General';
  const key = muscle.toLowerCase().trim();
  return MUSCLE_TRANSLATIONS[key] || muscle.charAt(0).toUpperCase() + muscle.slice(1);
}

function translateEquipment(equipment) {
  if (!equipment) return 'Libre';
  const key = equipment.toLowerCase().trim();
  return EQUIPMENT_TRANSLATIONS[key] || equipment.charAt(0).toUpperCase() + equipment.slice(1);
}

function translateCategory(category) {
  if (!category) return 'Fuerza';
  const key = category.toLowerCase().trim();
  return CATEGORY_TRANSLATIONS[key] || category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Construye la URL del CDN para una imagen del Free Exercise DB.
 * Las imágenes están bajo: /exercises/{ExerciseId}/{0,1}.jpg
 */
function buildImageUrl(imagePath) {
  if (!imagePath) return null;
  // imagePath ya viene como "ExerciseName/0.jpg"
  return `${FREE_EXERCISE_DB_IMAGES_CDN}/${imagePath}`;
}

/**
 * Mapea un ejercicio del Free Exercise DB al modelo Prisma Exercise.
 */
function mapExercise(rawEx) {
  const primaryMuscle = rawEx.primaryMuscles?.[0] || null;
  const muscleGroup   = translateMuscle(primaryMuscle);
  const category      = translateCategory(rawEx.category);
  const equipment     = translateEquipment(rawEx.equipment);

  // Instructions: array de strings → texto unido
  const instructions  = Array.isArray(rawEx.instructions)
    ? rawEx.instructions.join('\n')
    : (rawEx.instructions || '');

  // Imagen principal (primer elemento del array images)
  const firstImage    = rawEx.images?.[0] || null;
  const mediaFilename = firstImage;
  const mediaUrl      = buildImageUrl(firstImage);

  const defaults = CATEGORY_DEFAULTS[rawEx.category?.toLowerCase()] || { sets: 4, reps: 12 };

  return {
    name:         rawEx.name,
    muscleGroup,
    category,
    equipment,
    instructions,
    defaultSets:  defaults.sets,
    defaultReps:  defaults.reps,
    mediaFilename,
    mediaUrl,
    hashMd5:      rawEx.id || null,  // Usamos el id del repo como hash para idempotencia
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seedExercises() {
  console.log('🌐 Descargando catálogo Free Exercise DB...');
  console.log(`   URL: ${FREE_EXERCISE_DB_JSON}`);

  let rawData;
  try {
    const response = await fetch(FREE_EXERCISE_DB_JSON);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    rawData = await response.json();
  } catch (err) {
    console.error('❌ Error al descargar el catálogo:', err.message);
    console.log('⚠️  Saltando seed de Free Exercise DB (sin internet o URL inválida).');
    return { inserted: 0, skipped: 0 };
  }

  if (!Array.isArray(rawData)) {
    console.error('❌ El formato del catálogo no es el esperado (se esperaba un array).');
    return { inserted: 0, skipped: 0 };
  }

  console.log(`📦 ${rawData.length} ejercicios encontrados en el catálogo.`);

  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;

  // Procesamos en lotes de 50 para no saturar la DB
  const BATCH_SIZE = 50;
  for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
    const batch = rawData.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (rawEx) => {
        if (!rawEx.name) { skipped++; return; }

        const data = mapExercise(rawEx);

        try {
          // Usamos hashMd5 (= id del repo) para upsert idempotente.
          // Si ya existe un ejercicio con ese hashMd5, no lo tocamos.
          const existing = await prisma.exercise.findFirst({
            where: { hashMd5: data.hashMd5 },
            select: { id: true },
          });

          if (existing) {
            skipped++;
          } else {
            await prisma.exercise.create({ data });
            inserted++;
          }
        } catch (err) {
          console.error(`  ⚠️  Error con "${rawEx.name}":`, err.message);
          errors++;
        }
      })
    );

    // Progreso cada 200 ejercicios
    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= rawData.length) {
      const done = Math.min(i + BATCH_SIZE, rawData.length);
      process.stdout.write(`   ↳ Procesados: ${done}/${rawData.length}\r`);
    }
  }

  process.stdout.write('\n');
  return { inserted, skipped, errors };
}

// ─── Entry point (puede ejecutarse standalone o ser importado) ────────────────
async function main() {
  console.log('\n🏋️  GymAura — Seed de Ejercicios (Free Exercise DB)');
  console.log('══════════════════════════════════════════════════\n');

  const { inserted, skipped, errors } = await seedExercises();

  console.log('\n✅ Seed completado:');
  console.log(`   Insertados : ${inserted}`);
  console.log(`   Ya existían: ${skipped}`);
  if (errors) console.log(`   Errores    : ${errors}`);
  console.log('══════════════════════════════════════════════════\n');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}

module.exports = { seedExercises };
