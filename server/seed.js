'use strict';
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding GymAura database...');

  // Create coach
  const coachHash = await bcrypt.hash('Coach2025!', 12);
  const coach = await prisma.user.upsert({
    where: { email: 'coach@gymaura.com' },
    update: {},
    create: { email: 'coach@gymaura.com', passwordHash: coachHash, name: 'Coach Principal', role: 'COACH' }
  });
  console.log('✅ Coach created:', coach.email);

  // Create demo client
  const clientHash = await bcrypt.hash('Client2025!', 12);
  const client = await prisma.user.upsert({
    where: { email: 'cliente@gymaura.com' },
    update: {},
    create: { email: 'cliente@gymaura.com', passwordHash: clientHash, name: 'Atleta Demo', role: 'CLIENT', coachId: coach.id, goal: 'Hipertrofia', weightKg: 75, heightCm: 175 }
  });
  console.log('✅ Client created:', client.email);

  // Create exercises
  const exercises = [
    { name: 'Press de Banca con Barra', muscleGroup: 'Pecho', category: 'Pecho', equipment: 'Barra', instructions: 'Acostado en banco, baja la barra hasta el pecho y empuja hacia arriba.', defaultSets: 4, defaultReps: 10 },
    { name: 'Sentadilla con Barra', muscleGroup: 'Piernas', category: 'Piernas', equipment: 'Barra', instructions: 'Baja hasta que los muslos queden paralelos al suelo.', defaultSets: 4, defaultReps: 8 },
    { name: 'Peso Muerto', muscleGroup: 'Espalda Baja', category: 'Espalda', equipment: 'Barra', instructions: 'Mantén la espalda recta, agarra la barra y levanta desde el piso.', defaultSets: 4, defaultReps: 6 },
    { name: 'Dominadas', muscleGroup: 'Espalda', category: 'Espalda', equipment: 'Barra Dominadas', instructions: 'Cuélgate y jala tu cuerpo hacia arriba.', defaultSets: 4, defaultReps: 10 },
    { name: 'Press Militar', muscleGroup: 'Hombros', category: 'Hombros', equipment: 'Barra', instructions: 'Empuja la barra desde los hombros hacia arriba.', defaultSets: 4, defaultReps: 10 },
    { name: 'Remo con Barra', muscleGroup: 'Espalda', category: 'Espalda', equipment: 'Barra', instructions: 'Inclina el tronco y jala la barra hacia el abdomen.', defaultSets: 4, defaultReps: 10 },
    { name: 'Remo en Polea', muscleGroup: 'Espalda', category: 'Espalda', equipment: 'Máquina', instructions: 'Jala la polea hacia ti manteniendo la espalda recta.', defaultSets: 4, defaultReps: 12 },
    { name: 'Curl de Bíceps con Barra', muscleGroup: 'Bíceps', category: 'Bíceps', equipment: 'Barra', instructions: 'Flexiona el codo levantando la barra hacia los hombros.', defaultSets: 4, defaultReps: 12 },
    { name: 'Extensión de Tríceps en Polea', muscleGroup: 'Tríceps', category: 'Tríceps', equipment: 'Máquina', instructions: 'Empuja hacia abajo la cuerda de la polea extendiendo el brazo.', defaultSets: 4, defaultReps: 12 },
    { name: 'Fondos en Paralelas', muscleGroup: 'Tríceps', category: 'Tríceps', equipment: 'Paralelas', instructions: 'Baja el cuerpo doblando los codos y empuja hacia arriba.', defaultSets: 4, defaultReps: 12 },
    { name: 'Press Inclinado con Mancuernas', muscleGroup: 'Pecho Superior', category: 'Pecho', equipment: 'Mancuernas', instructions: 'En banco inclinado, empuja las mancuernas hacia arriba.', defaultSets: 4, defaultReps: 10 },
    { name: 'Apertura con Mancuernas', muscleGroup: 'Pecho', category: 'Pecho', equipment: 'Mancuernas', instructions: 'Baja los brazos a los lados y júntalos en la parte superior.', defaultSets: 4, defaultReps: 12 },
    { name: 'Jalón al Pecho', muscleGroup: 'Espalda', category: 'Espalda', equipment: 'Máquina', instructions: 'Jala la barra hasta la altura del pecho.', defaultSets: 4, defaultReps: 12 },
    { name: 'Leg Press', muscleGroup: 'Piernas', category: 'Piernas', equipment: 'Máquina', instructions: 'Empuja la plataforma hacia arriba extendiendo las piernas.', defaultSets: 4, defaultReps: 12 },
    { name: 'Curl Femoral', muscleGroup: 'Isquiotibiales', category: 'Piernas', equipment: 'Máquina', instructions: 'Flexiona las piernas hacia atrás.', defaultSets: 4, defaultReps: 12 },
    { name: 'Extensión de Piernas', muscleGroup: 'Cuádriceps', category: 'Piernas', equipment: 'Máquina', instructions: 'Extiende las piernas hacia adelante.', defaultSets: 4, defaultReps: 15 },
    { name: 'Elevación de Talones de Pie', muscleGroup: 'Gemelos', category: 'Piernas', equipment: 'Libre', instructions: 'Elévate sobre las puntas de los pies.', defaultSets: 4, defaultReps: 20 },
    { name: 'Press de Hombro con Mancuernas', muscleGroup: 'Hombros', category: 'Hombros', equipment: 'Mancuernas', instructions: 'Empuja las mancuernas hacia arriba.', defaultSets: 4, defaultReps: 10 },
    { name: 'Elevación Lateral', muscleGroup: 'Hombros', category: 'Hombros', equipment: 'Mancuernas', instructions: 'Eleva los brazos a los lados hasta la altura de los hombros.', defaultSets: 4, defaultReps: 15 },
    { name: 'Elevación Frontal', muscleGroup: 'Hombros', category: 'Hombros', equipment: 'Mancuernas', instructions: 'Eleva los brazos hacia adelante.', defaultSets: 4, defaultReps: 15 },
    { name: 'Pájaro con Mancuernas', muscleGroup: 'Hombros Posteriores', category: 'Hombros', equipment: 'Mancuernas', instructions: 'Inclina el tronco y eleva los brazos a los lados.', defaultSets: 4, defaultReps: 15 },
    { name: 'Abdominal en Suelo', muscleGroup: 'Abdomen', category: 'Abdomen', equipment: 'Libre', instructions: 'Flexiona el tronco contrayendo el abdomen.', defaultSets: 4, defaultReps: 20 },
    { name: 'Plancha Frontal', muscleGroup: 'Core', category: 'Abdomen', equipment: 'Libre', instructions: 'Mantén el cuerpo recto apoyado en antebrazos y pies.', defaultSets: 3, defaultReps: 60 },
    { name: 'Curl de Bíceps con Mancuerna', muscleGroup: 'Bíceps', category: 'Bíceps', equipment: 'Mancuernas', instructions: 'Flexiona el codo con mancuerna.', defaultSets: 4, defaultReps: 12 },
    { name: 'Martillo', muscleGroup: 'Bíceps', category: 'Bíceps', equipment: 'Mancuernas', instructions: 'Curl con agarre neutro.', defaultSets: 4, defaultReps: 12 },
    { name: 'Press Francés', muscleGroup: 'Tríceps', category: 'Tríceps', equipment: 'Barra', instructions: 'Acostado, baja la barra hacia la frente flexionando los codos.', defaultSets: 4, defaultReps: 12 },
    { name: 'Prensa de Hombros en Máquina', muscleGroup: 'Hombros', category: 'Hombros', equipment: 'Máquina', instructions: 'Empuja hacia arriba en la máquina de hombros.', defaultSets: 4, defaultReps: 10 },
    { name: 'Peso Muerto Rumano', muscleGroup: 'Isquiotibiales', category: 'Piernas', equipment: 'Barra', instructions: 'Baja la barra manteniendo rodillas semi-flexionadas.', defaultSets: 4, defaultReps: 10 },
    { name: 'Hip Thrust', muscleGroup: 'Glúteos', category: 'Piernas', equipment: 'Barra', instructions: 'Empuja las caderas hacia arriba con barra sobre pelvis.', defaultSets: 4, defaultReps: 12 },
    { name: 'Caminata en Cinta', muscleGroup: 'Cardiovascular', category: 'Cardio', equipment: 'Máquina', instructions: 'Camina a ritmo sostenido.', defaultSets: 1, defaultReps: 30 }
  ];

  const createdExercises = [];
  for (const ex of exercises) {
    const created = await prisma.exercise.upsert({
      where: { id: (await prisma.exercise.findFirst({ where: { name: ex.name } }))?.id || 'nonexistent' },
      update: {},
      create: ex
    });
    createdExercises.push(created);
  }
  console.log(`✅ ${createdExercises.length} exercises seeded`);

  // Create a sample weekly routine
  const exMap = {};
  createdExercises.forEach(e => { exMap[e.name] = e.id; });

  const weeklySchedule = {
    'Lunes': { dayName: 'Lunes', focus: 'Pecho y Bíceps', exercises: [
      { exerciseId: exMap['Press de Banca con Barra'], sets: 4, reps: 10, targetWeightKg: 70 },
      { exerciseId: exMap['Press Inclinado con Mancuernas'], sets: 4, reps: 10, targetWeightKg: 22 },
      { exerciseId: exMap['Apertura con Mancuernas'], sets: 4, reps: 12, targetWeightKg: 14 },
      { exerciseId: exMap['Curl de Bíceps con Barra'], sets: 4, reps: 12, targetWeightKg: 30 },
      { exerciseId: exMap['Martillo'], sets: 4, reps: 12, targetWeightKg: 12 }
    ]},
    'Martes': { dayName: 'Martes', focus: 'Piernas', exercises: [
      { exerciseId: exMap['Sentadilla con Barra'], sets: 4, reps: 8, targetWeightKg: 80 },
      { exerciseId: exMap['Leg Press'], sets: 4, reps: 12, targetWeightKg: 180 },
      { exerciseId: exMap['Curl Femoral'], sets: 4, reps: 12, targetWeightKg: 45 },
      { exerciseId: exMap['Hip Thrust'], sets: 4, reps: 12, targetWeightKg: 60 }
    ]},
    'Miércoles': { dayName: 'Miércoles', focus: 'Descanso Activo / Cardio', exercises: [
      { exerciseId: exMap['Caminata en Cinta'], sets: 1, reps: 30, targetWeightKg: 0 }
    ]},
    'Jueves': { dayName: 'Jueves', focus: 'Espalda y Tríceps', exercises: [
      { exerciseId: exMap['Peso Muerto'], sets: 4, reps: 6, targetWeightKg: 100 },
      { exerciseId: exMap['Remo con Barra'], sets: 4, reps: 10, targetWeightKg: 65 },
      { exerciseId: exMap['Jalón al Pecho'], sets: 4, reps: 12, targetWeightKg: 55 },
      { exerciseId: exMap['Extensión de Tríceps en Polea'], sets: 4, reps: 15, targetWeightKg: 25 },
      { exerciseId: exMap['Fondos en Paralelas'], sets: 3, reps: 10, targetWeightKg: 0 }
    ]},
    'Viernes': { dayName: 'Viernes', focus: 'Hombros y Abdomen', exercises: [
      { exerciseId: exMap['Press Militar'], sets: 4, reps: 8, targetWeightKg: 45 },
      { exerciseId: exMap['Elevación Lateral'], sets: 4, reps: 15, targetWeightKg: 10 },
      { exerciseId: exMap['Elevación Frontal'], sets: 4, reps: 15, targetWeightKg: 8 },
      { exerciseId: exMap['Plancha Frontal'], sets: 3, reps: 60, targetWeightKg: 0 }
    ]},
    'Sábado': { dayName: 'Sábado', focus: 'Descanso', exercises: [] },
    'Domingo': { dayName: 'Domingo', focus: 'Descanso', exercises: [] }
  };

  await prisma.routinePlan.upsert({
    where: { id: (await prisma.routinePlan.findFirst({ where: { athleteId: client.id } }))?.id || 'nonexistent' },
    update: { schedule: weeklySchedule },
    create: { coachId: coach.id, athleteId: client.id, title: 'Programa Hipertrofia 5 Días', description: 'Plan de 5 días enfocado en hipertrofia muscular', schedule: weeklySchedule }
  });
  console.log('✅ Sample routine created');
  console.log('🎉 Seed complete!');
  console.log('  Coach login: coach@gymaura.com / Coach2025!');
  console.log('  Client login: cliente@gymaura.com / Client2025!');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
