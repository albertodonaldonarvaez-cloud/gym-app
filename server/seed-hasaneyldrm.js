// seed-hasaneyldrm.js
// Seeds 1,324 exercises from hasaneyldrm/exercises-dataset
// Fields: id, name, category, body_part, equipment, instruction_steps, target, gif_url
const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();
const DATASET_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const GIF_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('⬇️  Downloading exercises from hasaneyldrm/exercises-dataset...');
  const exercises = await fetchJson(DATASET_URL);
  console.log(`📦 Downloaded ${exercises.length} exercises.`);

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
          : (ex.instructions || '');

      // Build full GIF URL
      const mediaUrl = ex.gif_url
        ? `${GIF_BASE}${ex.gif_url}`
        : null;

      // Map fields to DB schema
      // category: use body_part (chest, back, shoulders, etc.)
      // muscleGroup: use target (the specific muscle)
      const data = {
        name: ex.name,
        category: ex.body_part || ex.category || 'General',
        muscleGroup: ex.target || ex.muscle_group || 'General',
        equipment: ex.equipment || 'body weight',
        instructions,
        mediaUrl,
        defaultSets: 4,
        defaultReps: 12,
      };

      const existing = await prisma.exercise.findFirst({ where: { name: ex.name } });
      if (existing) {
        await prisma.exercise.update({ where: { id: existing.id }, data });
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
  console.log(`\n✅ Seed complete!`);
  console.log(`   Created: ${created} | Updated: ${updated} | Failed: ${failed}`);
  console.log(`   Total exercises in DB: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
