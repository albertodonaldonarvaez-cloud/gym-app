// seed-hasaneyldrm.js
// Seeds 1,324 exercises from hasaneyldrm/exercises-dataset
// Uses batch upsert by name for performance
const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();
const DATASET_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const GIF_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

async function main() {
  // ── FAST CHECK: skip if already seeded ────────────────────────────────────
  const existingCount = await prisma.exercise.count();
  if (existingCount >= 100) {
    console.log(`✅ hasaneyldrm seed skipped — ${existingCount} exercises already in DB.`);
    return;
  }

  console.log('⬇️  Downloading exercises from hasaneyldrm/exercises-dataset...');
  
  let exercises;
  try {
    exercises = await fetchJson(DATASET_URL);
  } catch (e) {
    console.error(`❌ Failed to download dataset: ${e.message}`);
    console.log('⚠️  Skipping hasaneyldrm seed — server will start with existing exercises.');
    return;
  }
  
  console.log(`📦 Downloaded ${exercises.length} exercises.`);

  // Get existing exercise names for efficient lookup
  const existing = await prisma.exercise.findMany({ select: { id: true, name: true } });
  const existingMap = new Map(existing.map(e => [e.name.toLowerCase(), e.id]));
  console.log(`📊 Found ${existingMap.size} existing exercises in DB.`);

  let created = 0, updated = 0, failed = 0;

  for (const ex of exercises) {
    try {
      // Prefer Spanish instructions, fallback to English
      const stepsEs = ex.instruction_steps?.es;
      const stepsEn = ex.instruction_steps?.en;
      const instructions = Array.isArray(stepsEs) && stepsEs.length > 0
        ? stepsEs.join(' ')
        : Array.isArray(stepsEn) && stepsEn.length > 0
          ? stepsEn.join(' ')
          : (typeof ex.instructions === 'string' ? ex.instructions : '');

      // Build full GIF URL pointing to GitHub raw content
      const mediaUrl = ex.gif_url
        ? `${GIF_BASE}${ex.gif_url}`
        : null;

      // Map fields to DB schema:
      //   body_part  → category   (chest, back, shoulders, waist, etc.)
      //   target     → muscleGroup (abs, pectorals, delts, etc.)
      const data = {
        name:         ex.name,
        category:     ex.body_part || ex.category || 'General',
        muscleGroup:  ex.target || ex.muscle_group || 'General',
        equipment:    ex.equipment || 'body weight',
        instructions,
        mediaUrl,
        defaultSets:  4,
        defaultReps:  12,
      };

      const existingId = existingMap.get(ex.name.toLowerCase());
      if (existingId) {
        await prisma.exercise.update({ where: { id: existingId }, data });
        updated++;
      } else {
        await prisma.exercise.create({ data });
        created++;
      }
    } catch (e) {
      console.error(`❌ Failed: ${ex.name} — ${e.message}`);
      failed++;
    }
  }

  const total = await prisma.exercise.count();
  console.log(`\n✅ hasaneyldrm seed complete!`);
  console.log(`   Created: ${created} | Updated: ${updated} | Failed: ${failed}`);
  console.log(`   Total exercises in DB: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
