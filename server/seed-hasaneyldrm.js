'use strict';

/**
 * seed-hasaneyldrm.js
 * Catálogo unificado de ejercicios en español para GymAura.
 * Combina e idempotiza:
 *   1. sergei-argutin/exercise-dataset (~708 ejercicios con name_es, instructions_es, .webp)
 *   2. hasaneyldrm/exercises-dataset (~1,324 ejercicios con GIFs animados y pasos ES)
 *   3. yuhonas/free-exercise-db (~876 ejercicios con fotos 0.jpg / 1.jpg)
 *
 * Puede ejecutarse como CLI (`node seed-hasaneyldrm.js`) o importarse desde server.js.
 */

const { PrismaClient } = require('@prisma/client');

const SERGEI_URL = 'https://raw.githubusercontent.com/sergei-argutin/exercise-dataset/main/exercises.json';
const SERGEI_CDN = 'https://raw.githubusercontent.com/sergei-argutin/exercise-dataset/main/';

const HASAN_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const HASAN_CDN = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

const FREE_DB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const FREE_DB_CDN = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// ─── Mapas canónicos al Español ──────────────────────────────────────────────
const MUSCLE_MAP = {
  // Pecho
  'pectorals': 'Pecho', 'chest': 'Pecho', 'pectoralis_major': 'Pecho', 'pectoralis_minor': 'Pecho',
  'serratus anterior': 'Pecho', 'serratus_anterior': 'Pecho', 'pecho': 'Pecho', 'pecho superior': 'Pecho',
  // Espalda
  'lats': 'Espalda', 'upper back': 'Espalda', 'upper_back': 'Espalda', 'spine': 'Espalda',
  'back': 'Espalda', 'middle back': 'Espalda', 'middle_back': 'Espalda',
  'lower back': 'Espalda', 'lower_back': 'Espalda', 'traps': 'Espalda',
  'levator scapulae': 'Espalda', 'levator_scapulae': 'Espalda',
  'latissimus_dorsi': 'Espalda', 'rhomboids': 'Espalda', 'erector_spinae': 'Espalda',
  'trapezius': 'Espalda', 'teres_major': 'Espalda', 'teres_minor': 'Espalda',
  'espalda': 'Espalda', 'espalda (lat)': 'Espalda', 'espalda media': 'Espalda',
  'espalda baja': 'Espalda', 'trapecios': 'Espalda', 'serrato': 'Pecho',
  // Hombros
  'delts': 'Hombros', 'shoulders': 'Hombros', 'anterior_deltoid': 'Hombros',
  'lateral_deltoid': 'Hombros', 'posterior_deltoid': 'Hombros', 'deltoids': 'Hombros',
  'infraspinatus': 'Hombros', 'supraspinatus': 'Hombros',
  'hombros': 'Hombros', 'hombros posteriores': 'Hombros', 'manguito rotador': 'Hombros',
  'infraspinatus_teres_minor': 'Hombros',
  // Brazos
  'biceps': 'Bíceps', 'bíceps': 'Bíceps', 'biceps_brachii': 'Bíceps', 'brachialis': 'Bíceps',
  'triceps': 'Tríceps', 'tríceps': 'Tríceps', 'triceps_brachii': 'Tríceps',
  'forearms': 'Antebrazos', 'forearm_flexors': 'Antebrazos', 'forearm_extensors': 'Antebrazos',
  'antebrazos': 'Antebrazos', 'upper arms': 'Bíceps', 'upper_arms': 'Bíceps',
  'lower arms': 'Antebrazos', 'lower_arms': 'Antebrazos', 'brazos': 'Bíceps',
  // Piernas y glúteos
  'quads': 'Cuádriceps', 'quadriceps': 'Cuádriceps', 'vastus_lateralis': 'Cuádriceps',
  'cuadriceps': 'Cuádriceps', 'cuádriceps': 'Cuádriceps',
  'hip flexors': 'Cuádriceps', 'hip_flexors': 'Cuádriceps', 'flexores de cadera': 'Cuádriceps',
  'tensor_fasciae_latae': 'Cuádriceps', 'tensor de la fascia lata': 'Cuádriceps',
  'hamstrings': 'Isquiotibiales', 'biceps_femoris': 'Isquiotibiales', 'isquiotibiales': 'Isquiotibiales',
  'glutes': 'Glúteos', 'gluteos': 'Glúteos', 'glúteos': 'Glúteos',
  'gluteus_maximus': 'Glúteos', 'gluteus_medius': 'Glúteos',
  'calves': 'Gemelos', 'gastrocnemius': 'Gemelos', 'soleus': 'Gemelos',
  'tibialis_anterior': 'Gemelos', 'tibial anterior': 'Gemelos', 'gemelos': 'Gemelos',
  'abductors': 'Abductores', 'hip_abductors': 'Abductores', 'abductores': 'Abductores', 'it band': 'Abductores', 'banda it': 'Abductores',
  'adductors': 'Aductores', 'hip_adductors': 'Aductores', 'aductores': 'Aductores',
  'upper legs': 'Piernas', 'upper_legs': 'Piernas', 'lower legs': 'Gemelos', 'lower_legs': 'Gemelos',
  'lower body': 'Piernas', 'piernas': 'Piernas', 'tren inferior': 'Piernas', 'caderas': 'Glúteos', 'hips': 'Glúteos',
  // Abdomen / Core
  'abs': 'Abdomen', 'abdominals': 'Abdomen', 'waist': 'Abdomen', 'core': 'Abdomen',
  'rectus_abdominis': 'Abdomen', 'transverse_abdominis': 'Abdomen', 'obliques': 'Abdomen',
  'abdomen': 'Abdomen', 'oblicuos': 'Abdomen',
  // Cardio y otros
  'cardiovascular system': 'Cardio', 'cardiovascular': 'Cardio', 'cardio': 'Cardio',
  'neck': 'Cuello', 'cuello': 'Cuello', 'upper body': 'Tren Superior', 'tren superior': 'Tren Superior',
  'full body': 'Cuerpo Completo', 'full_body': 'Cuerpo Completo', 'cuerpo completo': 'Cuerpo Completo',
};

const CATEGORY_MAP = {
  'strength': 'Fuerza', 'fuerza': 'Fuerza', 'calisthenics': 'Fuerza', 'calistenia': 'Fuerza',
  'waist': 'Fuerza', 'upper legs': 'Fuerza', 'upper_legs': 'Fuerza', 'back': 'Fuerza',
  'lower legs': 'Fuerza', 'lower_legs': 'Fuerza', 'chest': 'Fuerza', 'upper arms': 'Fuerza',
  'upper_arms': 'Fuerza', 'shoulders': 'Fuerza', 'lower arms': 'Fuerza', 'lower_arms': 'Fuerza',
  'neck': 'Fuerza', 'general': 'Fuerza', 'core': 'Fuerza', 'glutes': 'Fuerza', 'hips': 'Fuerza',
  'full_body': 'Fuerza', 'full body': 'Fuerza',
  'cardio': 'Cardio',
  'stretching': 'Estiramiento', 'estiramiento': 'Estiramiento', 'mobility': 'Estiramiento', 'movilidad': 'Estiramiento',
  'plyometrics': 'Pliométricos', 'pliométricos': 'Pliométricos', 'pliometricos': 'Pliométricos',
  'powerlifting': 'Powerlifting',
  'olympic weightlifting': 'Halterofilia', 'olympic_weightlifting': 'Halterofilia', 'olympic': 'Halterofilia', 'halterofilia': 'Halterofilia',
  'strongman': 'Strongman',
};

const EQUIPMENT_MAP = {
  'barbell': 'Barra', 'olympic barbell': 'Barra', 'barra': 'Barra',
  'trap bar': 'Barra', 'trap_bar': 'Barra', 'safety_squat_bar': 'Barra', 'landmine': 'Barra',
  'dumbbell': 'Mancuernas', 'mancuernas': 'Mancuernas', 'mancuerna': 'Mancuernas',
  'machine': 'Máquina', 'leverage machine': 'Máquina', 'sled machine': 'Máquina', 'sled': 'Máquina',
  'skierg machine': 'Máquina', 'upper body ergometer': 'Máquina', 'elliptical machine': 'Máquina',
  'stepmill machine': 'Máquina', 'stationary bike': 'Máquina', 'máquina': 'Máquina', 'maquina': 'Máquina',
  'air_bike': 'Máquina', 'bicycle': 'Máquina', 'elliptical': 'Máquina', 'glute_ham_developer': 'Máquina',
  'hack_squat': 'Máquina', 'leg_curl': 'Máquina', 'leg_extension': 'Máquina', 'leg_press': 'Máquina',
  'pec_deck': 'Máquina', 'rower': 'Máquina', 'ski_erg': 'Máquina', 'stair_climber': 'Máquina',
  'stationary_bike': 'Máquina', 'treadmill': 'Máquina',
  'body weight': 'Peso Corporal', 'body only': 'Peso Corporal', 'bodyweight': 'Peso Corporal',
  'assisted': 'Peso Corporal', 'peso corporal': 'Peso Corporal', 'libre': 'Peso Corporal',
  'dip_bars': 'Peso Corporal', 'dip_station': 'Peso Corporal', 'pull_up_bar': 'Peso Corporal',
  'barra de dominadas': 'Peso Corporal', 'barra dominadas': 'Peso Corporal',
  'paralelas': 'Peso Corporal', 'barras paralelas': 'Peso Corporal', 'climbing_rope': 'Peso Corporal',
  'rings': 'Peso Corporal', 'anillas': 'Peso Corporal', 'parallettes': 'Peso Corporal',
  'trx': 'Peso Corporal', 'suspension_trainer': 'Peso Corporal',
  'cable': 'Polea / Cable', 'rope': 'Polea / Cable', 'polea / cable': 'Polea / Cable', 'cables': 'Polea / Cable',
  'kettlebell': 'Kettlebell', 'kettlebells': 'Kettlebell',
  'band': 'Bandas Elásticas', 'bands': 'Bandas Elásticas', 'resistance_band': 'Bandas Elásticas',
  'resistance band': 'Bandas Elásticas', 'loop_band': 'Bandas Elásticas', 'bandas elásticas': 'Bandas Elásticas', 'bandas': 'Bandas Elásticas',
  'ez barbell': 'Barra EZ', 'e-z curl bar': 'Barra EZ', 'ez_curl_bar': 'Barra EZ', 'ez_bar': 'Barra EZ', 'barra ez': 'Barra EZ',
  'smith machine': 'Smith Machine', 'smith_machine': 'Smith Machine',
  'medicine ball': 'Balón Medicinal', 'medicine_ball': 'Balón Medicinal', 'slam_ball': 'Balón Medicinal', 'wall_ball': 'Balón Medicinal', 'balón medicinal': 'Balón Medicinal',
  'stability ball': 'Pelota de Ejercicio', 'stability_ball': 'Pelota de Ejercicio', 'exercise ball': 'Pelota de Ejercicio', 'exercise_ball': 'Pelota de Ejercicio',
  'bosu ball': 'Pelota de Ejercicio', 'bosu_ball': 'Pelota de Ejercicio', 'pelota de ejercicio': 'Pelota de Ejercicio',
  'roller': 'Foam Roller / Rueda', 'foam roll': 'Foam Roller / Rueda', 'foam_roller': 'Foam Roller / Rueda',
  'foam roller': 'Foam Roller / Rueda', 'wheel roller': 'Foam Roller / Rueda', 'ab_wheel': 'Foam Roller / Rueda',
  'rueda abdominal': 'Foam Roller / Rueda', 'foam roller / rueda': 'Foam Roller / Rueda',
  'hammer': 'Otro', 'tire': 'Otro', 'weighted': 'Otro', 'other': 'Otro', 'otro': 'Otro', 'plates': 'Otro', 'sandbag': 'Otro',
  'bench': 'Banco', 'flat_bench': 'Banco', 'banco': 'Banco', 'box': 'Otro', 'plyo_box': 'Otro', 'cajón': 'Otro', 'jump_rope': 'Otro',
  'cuerda de saltar': 'Otro', 'battle_ropes': 'Otro', 'battle_rope': 'Otro', 'cuerdas de batalla': 'Otro', 'wrist_roller': 'Otro',
  'none': 'Sin Equipamiento', 'sin equipamiento': 'Sin Equipamiento',
};

function normalizeMuscle(val) {
  if (!val) return 'General';
  const k = String(val).toLowerCase().trim();
  return MUSCLE_MAP[k] || (val.charAt(0).toUpperCase() + val.slice(1));
}

function normalizeCategory(val) {
  if (!val) return 'Fuerza';
  const k = String(val).toLowerCase().trim();
  return CATEGORY_MAP[k] || (val.charAt(0).toUpperCase() + val.slice(1));
}

function normalizeEquipment(val) {
  if (!val) return 'Peso Corporal';
  const k = String(val).toLowerCase().trim();
  if (EQUIPMENT_MAP[k]) return EQUIPMENT_MAP[k];
  if (k.endsWith('_machine') || k.endsWith(' machine')) return 'Máquina';
  return val.charAt(0).toUpperCase() + val.slice(1);
}

// ─── Traductor heurístico de nombres de ejercicio EN → ES ────────────────────
const NAME_REPLACEMENTS = [
  [/\be-?z\s*barbell\b|\be-?z\s*curl\s*bar\b|\bez\s*bar\b/gi, 'con Barra EZ'],
  [/\bolympic\s+barbell\b/gi, 'con Barra Olímpica'],
  [/\bsmith\s+machine\b/gi, 'en Máquina Smith'],
  [/\blever(?:age)?(?:\s+machine)?\b/gi, 'en Máquina'],
  [/\bexercise\s+ball\b|\bstability\s+ball\b|\bswiss\s+ball\b/gi, 'con Pelota'],
  [/\bmedicine\s+ball\b/gi, 'con Balón Medicinal'],
  [/\bresistance\s+band\b/gi, 'con Banda Elástica'],
  [/\bbosu\s+ball\b/gi, 'con Bosu'],
  [/\bkettlebell\b/gi, 'con Kettlebell'],
  [/\bdumbbell\b/gi, 'con Mancuernas'],
  [/\bbarbell\b/gi, 'con Barra'],
  [/\bcable\b/gi, 'en Polea'],
  [/\bmachine\b/gi, 'en Máquina'],
  [/\bsmith\b/gi, 'en Smith'],
  [/\bband\b/gi, 'con Banda'],
  [/\bbodyweight\b|\bbody\s*weight\b/gi, 'con Peso Corporal'],
  [/\bweighted\b/gi, 'Lastrado'],
  [/\bassisted\b/gi, 'Asistido'],

  [/\bromanian\s+deadlift\b/gi, 'Peso Muerto Rumano'],
  [/\bsumo\s+deadlift\b/gi, 'Peso Muerto Sumo'],
  [/\bstiff[- ]leg(?:ged)?\s+deadlift\b/gi, 'Peso Muerto Piernas Rígidas'],
  [/\bdeadlift\b/gi, 'Peso Muerto'],
  [/\bbench\s+press\b/gi, 'Press de Banca'],
  [/\bmilitary\s+press\b/gi, 'Press Militar'],
  [/\bshoulder\s+press\b/gi, 'Press de Hombros'],
  [/\boverhead\s+press\b/gi, 'Press Sobre la Cabeza'],
  [/\bchest\s+press\b/gi, 'Press de Pecho'],
  [/\bleg\s+press\b/gi, 'Prensa de Piernas'],
  [/\bhip\s+thrust\b/gi, 'Hip Thrust'],
  [/\bglute\s+bridge\b/gi, 'Puente de Glúteos'],
  [/\bhack\s+squat\b/gi, 'Sentadilla Hack'],
  [/\bgoblet\s+squat\b/gi, 'Sentadilla Goblet'],
  [/\bfront\s+squat\b/gi, 'Sentadilla Frontal'],
  [/\bsplit\s+squat\b/gi, 'Sentadilla Búlgara'],
  [/\bsquat\b/gi, 'Sentadilla'],
  [/\blunge\b/gi, 'Zancada'],
  [/\bstep[- ]up\b/gi, 'Subida al Cajón'],
  [/\bleg\s+extension\b/gi, 'Extensión de Cuádriceps'],
  [/\bleg\s+curl\b|\bhamstring\s+curl\b/gi, 'Curl Femoral'],
  [/\bcalf\s+raise\b/gi, 'Elevación de Talones'],
  [/\blat\s+pulldown\b|\bpull\s*down\b/gi, 'Jalón al Pecho'],
  [/\bpull[- ]?up\b/gi, 'Dominadas'],
  [/\bchin[- ]?up\b/gi, 'Dominadas Supinas'],
  [/\bpush[- ]?up\b/gi, 'Flexiones'],
  [/\btriceps?\s+extension\b/gi, 'Extensión de Tríceps'],
  [/\bpushdown\b|\bpush\s*down\b/gi, 'Extensión en Polea'],
  [/\bskull\s*crusher\b/gi, 'Press Francés'],
  [/\bhammer\s+curl\b/gi, 'Curl Martillo'],
  [/\bpreacher\s+curl\b/gi, 'Curl Predicador'],
  [/\bconcentration\s+curl\b/gi, 'Curl Concentrado'],
  [/\bbiceps?\s+curl\b/gi, 'Curl de Bíceps'],
  [/\bcurl\b/gi, 'Curl'],
  [/\blateral\s+raise\b/gi, 'Elevación Lateral'],
  [/\bfront\s+raise\b/gi, 'Elevación Frontal'],
  [/\brear\s+delt(?:oid)?\b/gi, 'Deltoides Posterior'],
  [/\bface\s+pull\b/gi, 'Face Pull'],
  [/\bshrug\b/gi, 'Encogimientos de Hombros'],
  [/\bupright\s+row\b/gi, 'Remo al Mentón'],
  [/\bbent[- ]over\s+row\b/gi, 'Remo Inclinado'],
  [/\brow\b/gi, 'Remo'],
  [/\bfly(?:e|es)?\b/gi, 'Aperturas'],
  [/\bdips?\b/gi, 'Fondos'],
  [/\bpullover\b/gi, 'Pullover'],
  [/\bsit[- ]?up\b/gi, 'Abdominal Sit-Up'],
  [/\bcrunch\b/gi, 'Crunch Abdominal'],
  [/\bside\s+plank\b/gi, 'Plancha Lateral'],
  [/\bplank\b/gi, 'Plancha'],
  [/\bleg\s+raise\b/gi, 'Elevación de Piernas'],
  [/\bknee\s+raise\b/gi, 'Elevación de Rodillas'],
  [/\brussian\s+twist\b/gi, 'Giro Ruso'],
  [/\bmountain\s+climber\b/gi, 'Escaladores'],
  [/\bburpee\b/gi, 'Burpees'],
  [/\bstretch\b/gi, 'Estiramiento'],
  [/\bwarm[- ]up\b/gi, 'Calentamiento'],
  [/\bpress\b/gi, 'Press'],
  [/\bextension\b/gi, 'Extensión'],
  [/\braise\b/gi, 'Elevación'],
  [/\babduction\b/gi, 'Abducción'],
  [/\badduction\b/gi, 'Aducción'],
  [/\brotation\b/gi, 'Rotación'],
  [/\btwist\b/gi, 'Giro'],

  [/\bincline\b/gi, 'Inclinado'],
  [/\bdecline\b/gi, 'Declinado'],
  [/\bseated\b/gi, 'Sentado'],
  [/\bstanding\b/gi, 'de Pie'],
  [/\blying\b/gi, 'Acostado'],
  [/\bkneeling\b/gi, 'Arrodillado'],
  [/\bone[- ]arm\b|\bsingle[- ]arm\b/gi, 'a una Mano'],
  [/\bone[- ]leg\b|\bsingle[- ]leg\b/gi, 'a una Pierna'],
  [/\balternat(?:e|ing)\b/gi, 'Alternado'],
  [/\bclose[- ]grip\b|\bnarrow[- ]grip\b/gi, 'Agarre Cerrado'],
  [/\bwide[- ]grip\b/gi, 'Agarre Amplio'],
  [/\breverse[- ]grip\b|\breverse\b/gi, 'Agarre Inverso'],
  [/\bneutral[- ]grip\b/gi, 'Agarre Neutro'],
  [/\boverhead\b/gi, 'Sobre la Cabeza'],
  [/\bbiceps\b/gi, 'Bíceps'],
  [/\btriceps\b/gi, 'Tríceps'],
  [/\bchest\b/gi, 'Pecho'],
  [/\bback\b/gi, 'Espalda'],
  [/\bshoulder\b|\bshoulders\b/gi, 'Hombros'],
  [/\bglutes?\b/gi, 'Glúteos'],
  [/\bcalf\b|\bcalves\b/gi, 'Gemelos'],
  [/\babs\b/gi, 'Abdomen'],
  [/\bwrist\b/gi, 'Muñeca'],
  [/\bforearm\b/gi, 'Antebrazo'],
  [/\bthigh\b/gi, 'Muslo'],
  [/\bneck\b/gi, 'Cuello'],
];

function translateExerciseName(rawName) {
  if (!rawName) return 'Ejercicio';
  const orig = String(rawName).trim();
  // Si ya trae formato "Español (English)" o tiene acentos / palabras españolas claras, no duplicar
  if (/\([^)]+\)$/.test(orig) || /[áéíóúñÁÉÍÓÚÑ]/.test(orig)) {
    return orig;
  }
  let es = orig;
  for (const [re, rep] of NAME_REPLACEMENTS) {
    es = es.replace(re, rep);
  }
  es = es.replace(/\s+/g, ' ').trim();
  es = es.replace(/\b(con|en)\s+\1\b/gi, '$1');
  // Reordenar modificador de equipo al final: "con Barra Press de Banca" -> "Press de Banca con Barra"
  es = es.replace(/^(con\s+(?:Barra Olímpica|Barra EZ|Barra|Mancuernas|Kettlebell|Banda Elástica|Banda|Pelota|Balón Medicinal|Bosu|Peso Corporal)|en\s+(?:Máquina Smith|Máquina|Polea|Smith))\s+(.+)$/i, '$2 $1');
  if (es.toLowerCase() === orig.toLowerCase()) {
    return orig.charAt(0).toUpperCase() + orig.slice(1);
  }
  const titled = es.charAt(0).toUpperCase() + es.slice(1);
  return `${titled} (${orig})`;
}

function formatInstructions(raw) {
  if (!raw) return '';
  if (Array.isArray(raw)) {
    return raw.map(s => String(s).trim()).filter(Boolean).join('\n');
  }
  const str = String(raw).trim();
  if (!str) return '';
  if (str.includes('\n')) {
    return str.split('\n').map(s => s.trim()).filter(Boolean).join('\n');
  }
  // Si viene en un solo párrafo largo, separar por oraciones para mostrar pasos claros
  return str.replace(/\.\s+(?=[A-ZÁÉÍÓÚÑ¿])/g, '.\n');
}

function defaultSetsReps(category) {
  switch (category) {
    case 'Cardio': return { defaultSets: 1, defaultReps: 30 };
    case 'Estiramiento': return { defaultSets: 2, defaultReps: 30 };
    case 'Pliométricos': return { defaultSets: 3, defaultReps: 10 };
    case 'Powerlifting': return { defaultSets: 5, defaultReps: 5 };
    case 'Halterofilia': return { defaultSets: 4, defaultReps: 5 };
    case 'Strongman': return { defaultSets: 3, defaultReps: 8 };
    default: return { defaultSets: 4, defaultReps: 12 };
  }
}

async function fetchJson(url) {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(45000),
    headers: { 'User-Agent': 'GymAura/2.0' },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

function encodeRelPath(rel) {
  return String(rel || '')
    .replace(/^\/+/, '')
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/');
}

/**
 * Sincroniza y normaliza el catálogo de ejercicios desde las 3 fuentes Open Source.
 * @param {{ prisma?: PrismaClient, force?: boolean }} opts
 */
async function syncExerciseCatalog(opts = {}) {
  const ownPrisma = !opts.prisma;
  const prisma = opts.prisma || new PrismaClient();
  const force = !!opts.force;

  const stats = { repaired: 0, created: 0, updated: 0, total: 0, sources: [] };

  try {
    // 1. Inspeccionar ejercicios actuales y reparar campos en inglés / saltos de línea
    const existing = await prisma.exercise.findMany({
      select: {
        id: true, name: true, category: true, muscleGroup: true,
        equipment: true, instructions: true, instructionsEs: true,
        mediaUrl: true, mediaFilename: true, hashMd5: true, isCustom: true,
      },
    });

    const CANONICAL_CATS = new Set(['Fuerza', 'Cardio', 'Estiramiento', 'Pliométricos', 'Powerlifting', 'Halterofilia', 'Strongman', 'General']);
    const toRepair = [];
    for (const ex of existing) {
      if (ex.isCustom) continue;
      const nc = normalizeCategory(ex.category);
      const nm = normalizeMuscle(ex.muscleGroup);
      const ne = normalizeEquipment(ex.equipment);
      const ni = formatInstructions(ex.instructions);
      const needName = !/[áéíóúñÁÉÍÓÚÑ]/.test(ex.name) && !/\([^)]+\)$/.test(ex.name) && translateExerciseName(ex.name) !== ex.name;
      if (nc !== ex.category || nm !== ex.muscleGroup || ne !== ex.equipment || ni !== ex.instructions || !CANONICAL_CATS.has(ex.category) || needName) {
        const nextName = needName ? translateExerciseName(ex.name).slice(0, 120) : ex.name;
        toRepair.push({
          id: ex.id,
          data: {
            category: nc,
            muscleGroup: nm,
            equipment: ne,
            instructions: ni,
            name: nextName,
          },
        });
        ex.category = nc;
        ex.muscleGroup = nm;
        ex.equipment = ne;
        ex.instructions = ni;
        ex.name = nextName;
      }
    }

    if (toRepair.length > 0) {
      console.log(`🔧 Reparando ${toRepair.length} ejercicios con categorías/músculos/nombres en inglés...`);
      for (let i = 0; i < toRepair.length; i += 50) {
        const chunk = toRepair.slice(i, i + 50);
        await Promise.all(chunk.map(r => prisma.exercise.update({ where: { id: r.id }, data: r.data }).catch(() => {})));
      }
      stats.repaired = toRepair.length;
    }

    // Fast skip si ya tenemos catálogo completo y no había filas en inglés ni force
    if (!force && existing.length >= 1800 && stats.repaired === 0) {
      stats.total = existing.length;
      console.log(`✅ Catálogo completo (${existing.length} ejercicios).`);
      return stats;
    }

    // Índices en memoria para deduplicación y updates rápidos
    const byHash = new Map();
    const byName = new Map();
    for (const ex of existing) {
      if (ex.hashMd5) byHash.set(ex.hashMd5, ex);
      const low = ex.name.toLowerCase().trim();
      byName.set(low, ex);
      const paren = low.match(/\(([^)]+)\)$/);
      if (paren) byName.set(paren[1].trim(), ex);
    }

    const toCreate = [];
    const toUpdate = [];

    const registerRow = (row, aliases = []) => {
      let match = (row.hashMd5 && byHash.get(row.hashMd5)) || byName.get(row.name.toLowerCase().trim());
      if (!match) {
        for (const a of aliases) {
          const al = String(a || '').toLowerCase().trim();
          if (al && byName.has(al)) { match = byName.get(al); break; }
        }
      }
      if (match) {
        if (!match.isCustom && match.id) {
          const needsUpdate =
            (!match.mediaUrl && row.mediaUrl) ||
            (!match.hashMd5 && row.hashMd5) ||
            (row.instructionsEs && !match.instructionsEs) ||
            (row.mediaFilename && !match.mediaFilename) ||
            (row.preferSpanishName && !match.name.toLowerCase().includes(row.name.toLowerCase()));
          if (needsUpdate) {
            toUpdate.push({
              id: match.id,
              data: {
                ...(row.preferSpanishName ? { name: row.name } : {}),
                category: row.category,
                muscleGroup: row.muscleGroup,
                equipment: row.equipment,
                ...(row.instructions ? { instructions: row.instructions } : {}),
                ...(row.instructionsEs ? { instructionsEs: row.instructionsEs } : {}),
                ...(row.mediaUrl ? { mediaUrl: row.mediaUrl } : {}),
                ...(row.mediaFilename ? { mediaFilename: row.mediaFilename } : {}),
                ...(row.hashMd5 ? { hashMd5: row.hashMd5 } : {}),
              },
            });
          }
        }
        if (row.hashMd5 && !byHash.has(row.hashMd5)) byHash.set(row.hashMd5, match);
        return;
      }

      toCreate.push({
        name: row.name,
        muscleGroup: row.muscleGroup,
        category: row.category,
        equipment: row.equipment,
        instructions: row.instructions || '',
        instructionsEs: row.instructionsEs || null,
        defaultSets: row.defaultSets,
        defaultReps: row.defaultReps,
        mediaFilename: row.mediaFilename || null,
        mediaUrl: row.mediaUrl || null,
        hashMd5: row.hashMd5 || null,
        isCustom: false,
      });

      const stub = { id: null, isCustom: false, ...row };
      if (row.hashMd5) byHash.set(row.hashMd5, stub);
      byName.set(row.name.toLowerCase().trim(), stub);
      for (const a of aliases) {
        const al = String(a || '').toLowerCase().trim();
        if (al) byName.set(al, stub);
      }
    };

    // ── Fuente 1: sergei-argutin/exercise-dataset (708 con español nativo) ──
    try {
      console.log('🌐 Descargando sergei-argutin/exercise-dataset...');
      const j = await fetchJson(SERGEI_URL);
      const arr = Array.isArray(j) ? j : (j.exercises || []);
      for (const ex of arr) {
        const nameEs = String(ex.name_es || '').trim();
        const nameEn = String(ex.name_en || ex.name || '').trim();
        if (!nameEs && !nameEn) continue;
        const name = nameEs
          ? (nameEn && nameEs.toLowerCase() !== nameEn.toLowerCase() ? `${nameEs} (${nameEn})` : nameEs)
          : translateExerciseName(nameEn);
        const category = normalizeCategory(ex.category);
        const primaryMuscle = ex.primary_muscles?.[0] || ex.body_part || '';
        const muscleGroup = normalizeMuscle(primaryMuscle);
        const equipment = normalizeEquipment(ex.equipment);

        const steps = Array.isArray(ex.instructions_es) && ex.instructions_es.length
          ? ex.instructions_es
          : (Array.isArray(ex.instructions_en) ? ex.instructions_en : []);
        const tips = Array.isArray(ex.tips_es) && ex.tips_es.length ? ex.tips_es.map(t => `Consejo: ${t}`) : [];
        const instructions = formatInstructions([...steps, ...tips]);
        const instructionsEs = Array.isArray(ex.instructions_es) && ex.instructions_es.length
          ? formatInstructions([...ex.instructions_es, ...tips])
          : null;

        let mediaUrl = null;
        if (ex.images?.flat && typeof ex.images.flat === 'object') {
          const rel = ex.images.flat.main || Object.values(ex.images.flat)[0];
          if (rel) mediaUrl = `${SERGEI_CDN}${encodeRelPath(rel)}`;
        }
        const defs = defaultSetsReps(category);
        registerRow({
          name: name.slice(0, 120),
          category,
          muscleGroup,
          equipment,
          instructions,
          instructionsEs,
          mediaUrl,
          mediaFilename: null,
          hashMd5: `sa:${ex.id || nameEn}`,
          preferSpanishName: !!nameEs,
          ...defs,
        }, [nameEn, nameEs]);
      }
      stats.sources.push(`sergei-argutin:${arr.length}`);
    } catch (e) {
      console.warn('⚠️ Fuente sergei-argutin falló:', e.message);
    }

    // ── Fuente 2: hasaneyldrm/exercises-dataset (1,324 con GIF + pasos ES) ──
    try {
      console.log('🌐 Descargando hasaneyldrm/exercises-dataset...');
      const arr = await fetchJson(HASAN_URL);
      if (Array.isArray(arr)) {
        for (const ex of arr) {
          const nameEn = String(ex.name || '').trim();
          if (!nameEn) continue;
          const name = translateExerciseName(nameEn).slice(0, 120);
          const category = normalizeCategory(ex.category || ex.body_part);
          const muscleGroup = normalizeMuscle(ex.target || ex.muscle_group || ex.body_part);
          const equipment = normalizeEquipment(ex.equipment);

          const stepsEs = ex.instruction_steps?.es;
          const stepsEn = ex.instruction_steps?.en;
          const instructionsEs = Array.isArray(stepsEs) && stepsEs.length
            ? formatInstructions(stepsEs)
            : (ex.instructions?.es ? formatInstructions(ex.instructions.es) : null);
          const instructions = instructionsEs
            || (Array.isArray(stepsEn) && stepsEn.length ? formatInstructions(stepsEn) : formatInstructions(ex.instructions?.en || ex.instructions));

          const mediaUrl = ex.gif_url ? `${HASAN_CDN}${encodeRelPath(ex.gif_url)}` : null;
          const mediaFilename = ex.image ? `hy:${encodeRelPath(ex.image)}` : null;
          const defs = defaultSetsReps(category);

          registerRow({
            name,
            category,
            muscleGroup,
            equipment,
            instructions,
            instructionsEs,
            mediaUrl,
            mediaFilename,
            hashMd5: `hy:${ex.id || nameEn}`,
            preferSpanishName: true,
            ...defs,
          }, [nameEn]);
        }
        stats.sources.push(`hasaneyldrm:${arr.length}`);
      }
    } catch (e) {
      console.warn('⚠️ Fuente hasaneyldrm falló:', e.message);
    }

    // ── Fuente 3: yuhonas/free-exercise-db (876 con 0.jpg / 1.jpg) ──
    try {
      console.log('🌐 Descargando yuhonas/free-exercise-db...');
      const arr = await fetchJson(FREE_DB_URL);
      if (Array.isArray(arr)) {
        for (const rawEx of arr) {
          const nameEn = String(rawEx.name || '').trim();
          if (!nameEn) continue;
          const name = translateExerciseName(nameEn).slice(0, 120);
          const category = normalizeCategory(rawEx.category);
          const muscleGroup = normalizeMuscle(rawEx.primaryMuscles?.[0]);
          const equipment = normalizeEquipment(rawEx.equipment);
          const instructions = formatInstructions(rawEx.instructions);
          const firstImage = rawEx.images?.[0] || null;
          const mediaFilename = firstImage;
          const mediaUrl = firstImage ? `${FREE_DB_CDN}${encodeRelPath(firstImage)}` : null;
          const defs = defaultSetsReps(category);

          registerRow({
            name,
            category,
            muscleGroup,
            equipment,
            instructions,
            instructionsEs: null,
            mediaUrl,
            mediaFilename,
            hashMd5: rawEx.id || `fedb:${nameEn}`,
            preferSpanishName: false,
            ...defs,
          }, [nameEn]);
        }
        stats.sources.push(`free-exercise-db:${arr.length}`);
      }
    } catch (e) {
      console.warn('⚠️ Fuente free-exercise-db falló:', e.message);
    }

    // ── Aplicar updates y creates en lotes ──
    for (let i = 0; i < toUpdate.length; i += 50) {
      const chunk = toUpdate.slice(i, i + 50);
      await Promise.all(chunk.map(u => prisma.exercise.update({ where: { id: u.id }, data: u.data }).catch(() => {})));
      stats.updated += chunk.length;
    }

    for (let i = 0; i < toCreate.length; i += 200) {
      const chunk = toCreate.slice(i, i + 200);
      const res = await prisma.exercise.createMany({ data: chunk, skipDuplicates: true });
      stats.created += res.count || chunk.length;
    }

    stats.total = await prisma.exercise.count();
    console.log(`✅ Catálogo sincronizado: +${stats.created} nuevos, ${stats.updated} actualizados, ${stats.repaired} reparados. Total DB: ${stats.total}`);
    return stats;
  } finally {
    if (ownPrisma) await prisma.$disconnect();
  }
}

if (require.main === module) {
  syncExerciseCatalog()
    .then(() => process.exit(0))
    .catch((e) => { console.error('❌ Error sincronizando catálogo:', e); process.exit(1); });
}

module.exports = {
  syncExerciseCatalog,
  translateExerciseName,
  normalizeMuscle,
  normalizeCategory,
  normalizeEquipment,
  formatInstructions,
};
