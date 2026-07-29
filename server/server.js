const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Archivo de almacenamiento local JSON
const DATA_FILE = path.join(__dirname, 'gym_db.json');

// Datos iniciales semillas
const INITIAL_DATA = {
  coach: {
    id: "coach_1",
    name: "Coach Roberto 'Aura' Silva",
    email: "coach@gymaura.com",
    gymName: "Aura Performance Gym",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
  },
  clients: [
    {
      id: "cli_1",
      name: "Carlos Mendoza",
      email: "carlos@gmail.com",
      phone: "+52 55 1234 5678",
      goal: "Hipertrofia y Fuerza",
      weightKg: 78.5,
      heightCm: 178,
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80",
      activeRoutineId: "rout_carlos_1"
    },
    {
      id: "cli_2",
      name: "Sofía Ramírez",
      email: "sofia@gmail.com",
      phone: "+52 55 9876 5432",
      goal: "Tonificación y Resistencia",
      weightKg: 62.0,
      heightCm: 165,
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
      activeRoutineId: "rout_sofia_1"
    },
    {
      id: "cli_3",
      name: "Mateo Fernández",
      email: "mateo@gmail.com",
      phone: "+52 55 4567 8901",
      goal: "Pérdida de Grasa",
      weightKg: 85.0,
      heightCm: 182,
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
      activeRoutineId: "rout_mateo_1"
    }
  ],
  exercises: [
    // PECHO
    { id: "ex_1", name: "Press de Banca con Barra", category: "Pecho", targetMuscle: "Pectoral Mayor", equipment: "Barra y Banco Plano", instructions: "Túmbate en el banco, agarre medio, baja la barra al esternón con codos a 45° y empuja explosivo.", defaultSets: 4, defaultReps: 10, icon: "dumbbell" },
    { id: "ex_2", name: "Press Inclinado con Mancuernas", category: "Pecho", targetMuscle: "Pectoral Superior", equipment: "Banco Inclinado (30-45°) + Mancuernas", instructions: "Con el banco a 30 grados, baja las mancuernas al nivel del pecho superior y extiende totalmente los brazos.", defaultSets: 4, defaultReps: 12, icon: "dumbbell" },
    { id: "ex_3", name: "Aperturas con Mancuernas", category: "Pecho", targetMuscle: "Pectoral Mayor / Estiramiento", equipment: "Mancuernas", instructions: "Abre los brazos semiflexionados sintiendo el estiramiento profundo en el pecho antes de cerrar arriba.", defaultSets: 3, defaultReps: 15, icon: "dumbbell" },
    { id: "ex_4", name: "Fondos en Paralelas (Dips)", category: "Pecho", targetMuscle: "Pectoral Inferior y Tríceps", equipment: "Barras Paralelas", instructions: "Inclina el torso ligeramente hacia adelante al bajar para enfocar la carga en el pecho inferior.", defaultSets: 3, defaultReps: 10, icon: "bodyweight" },
    { id: "ex_5", name: "Crossover en Polea Alta", category: "Pecho", targetMuscle: "Pectoral Inferior e Interior", equipment: "Polea Doble", instructions: "Cruza los cables al frente abajo manteniendo ligera flexión de codos.", defaultSets: 4, defaultReps: 15, icon: "cable" },

    // ESPALDA
    { id: "ex_6", name: "Jalón al Pecho en Polea Alta", category: "Espalda", targetMuscle: "Dorsal Ancho", equipment: "Máquina de Polea", instructions: "Tracciona el agarre hacia la parte superior del pecho sacando el tórax y apretando omóplatos.", defaultSets: 4, defaultReps: 12, icon: "cable" },
    { id: "ex_7", name: "Remo con Barra (Pendlay / Convencional)", category: "Espalda", targetMuscle: "Dorsal, Trapecio y Remo Central", equipment: "Barra Olímpica", instructions: "Torso inclinado a 45° o paralelo, lleva la barra hacia el ombligo manteniendo la espalda recta.", defaultSets: 4, defaultReps: 10, icon: "dumbbell" },
    { id: "ex_8", name: "Dominadas (Pull-ups)", category: "Espalda", targetMuscle: "Dorsal Ancho", equipment: "Barra de Dominadas", instructions: "Agarre prono más ancho que los hombros. Eleva tu cuerpo hasta superar la barra con la barbilla.", defaultSets: 4, defaultReps: 8, icon: "bodyweight" },
    { id: "ex_9", name: "Remo Gironda en Polea Baja", category: "Espalda", targetMuscle: "Espalda Media y Romboides", equipment: "Polea Baja con Agarre V", instructions: "Mantén el torso erguido, tira hacia el abdomen y retrae profundamente las escápulas.", defaultSets: 4, defaultReps: 12, icon: "cable" },
    { id: "ex_10", name: "Peso Muerto Convencional", category: "Espalda", targetMuscle: "Cadena Posterior Total / Lumbar", equipment: "Barra y Discos", instructions: "Pies a lo ancho de caderas, espalda neutra, empuja el suelo con las piernas y extiende la cadera arriba.", defaultSets: 4, defaultReps: 6, icon: "barbell" },

    // PIERNA
    { id: "ex_11", name: "Sentadilla Trasera con Barra", category: "Pierna", targetMuscle: "Cuádriceps y Glúteo", equipment: "Rack y Barra Olímpica", instructions: "Apoya la barra en trapecios, desciende rompiendo el paralelo con rodillas alineadas con los pies.", defaultSets: 4, defaultReps: 10, icon: "barbell" },
    { id: "ex_12", name: "Prensa de Piernas 45°", category: "Pierna", targetMuscle: "Cuádriceps e Isquios", equipment: "Máquina de Prensa", instructions: "Coloca pies al ancho de hombros, baja la plataforma a 90° sin despegar la zona lumbar.", defaultSets: 4, defaultReps: 12, icon: "machine" },
    { id: "ex_13", name: "Zancadas / Lunges con Mancuernas", category: "Pierna", targetMuscle: "Glúteos y Cuádriceps", equipment: "Mancuernas", instructions: "Da un paso amplio desciendo la rodilla trasera casi al suelo. Mantén el torso vertical.", defaultSets: 3, defaultReps: 12, icon: "dumbbell" },
    { id: "ex_14", name: "Extensión de Cuádriceps", category: "Pierna", targetMuscle: "Cuádriceps (Recto Femoral)", equipment: "Máquina Extensión", instructions: "Extiende las piernas completamente con control y haz una pausa de 1 segundo arriba.", defaultSets: 4, defaultReps: 15, icon: "machine" },
    { id: "ex_15", name: "Curl Femoral Tumbado", category: "Pierna", targetMuscle: "Isquiotibiales", equipment: "Máquina Curl Femoral", instructions: "Flexiona las piernas llevando los talones hacia los glúteos manteniendo cadera fija.", defaultSets: 4, defaultReps: 12, icon: "machine" },
    { id: "ex_16", name: "Peso Muerto Rumano", category: "Pierna", targetMuscle: "Isquiotibiales y Glúteo", equipment: "Barra o Mancuernas", instructions: "Flexiona ligeramente rodillas y empuja la cadera hacia atrás sintiendo el estiramiento en femorales.", defaultSets: 4, defaultReps: 10, icon: "barbell" },
    { id: "ex_17", name: "Elevación de Talones de Pie", category: "Pierna", targetMuscle: "Gemelos (Gastrocnemio)", equipment: "Máquina o Escalón", instructions: "Sube al máximo sobre la punta de los pies, aguanta 1 segundo y baja estirando el talón.", defaultSets: 4, defaultReps: 20, icon: "machine" },

    // HOMBRO
    { id: "ex_18", name: "Press Militar con Barra", category: "Hombro", targetMuscle: "Deltoides Anterior", equipment: "Barra Olímpica", instructions: "Desde la clavícula, empuja la barra sobre la cabeza bloqueando los brazos en vertical.", defaultSets: 4, defaultReps: 8, icon: "barbell" },
    { id: "ex_19", name: "Press Arnold con Mancuernas", category: "Hombro", targetMuscle: "Deltoides Completo", equipment: "Mancuernas y Banco", instructions: "Inicia con palmas mirando hacia ti y rota 180 grados a medida que subes las mancuernas.", defaultSets: 4, defaultReps: 12, icon: "dumbbell" },
    { id: "ex_20", name: "Elevaciones Laterales con Mancuernas", category: "Hombro", targetMuscle: "Deltoides Lateral", equipment: "Mancuernas", instructions: "Eleva las mancuernas hacia los lados hasta la altura de los hombros guiando con los codos.", defaultSets: 4, defaultReps: 15, icon: "dumbbell" },
    { id: "ex_21", name: "Pájaros para Deltoides Posterior", category: "Hombro", targetMuscle: "Deltoides Posterior", equipment: "Mancuernas o Polea", instructions: "Inclina el torso 90° hacia adelante y abre los brazos lateralmente apretando la parte trasera del hombro.", defaultSets: 4, defaultReps: 15, icon: "dumbbell" },

    // BÍCEPS
    { id: "ex_22", name: "Curl de Bíceps con Barra Z", category: "Bíceps", targetMuscle: "Bíceps Braquial", equipment: "Barra Z y Discos", instructions: "Mantén los codos pegados al costado y flexiona la barra Z con movimiento limpio.", defaultSets: 4, defaultReps: 12, icon: "barbell" },
    { id: "ex_23", name: "Curl Martillo con Mancuernas", category: "Bíceps", targetMuscle: "Braquiorradial y Bíceps", equipment: "Mancuernas", instructions: "Agarre neutro (palmas enfrentadas). Eleva las mancuernas manteniendo codos fijos.", defaultSets: 4, defaultReps: 12, icon: "dumbbell" },
    { id: "ex_24", name: "Curl Predicador en Banco Scott", category: "Bíceps", targetMuscle: "Bíceps (Cabeza Corta)", equipment: "Banco Scott y Barra Z", instructions: "Apoya los brazos firmes en el acolchado y sube la barra concentrando la contracción arriba.", defaultSets: 3, defaultReps: 10, icon: "barbell" },

    // TRÍCEPS
    { id: "ex_25", name: "Extensión de Tríceps en Polea con Cuerda", category: "Tríceps", targetMuscle: "Tríceps (Cabeza Lateral)", equipment: "Polea Alta con Cuerda", instructions: "Empuja la cuerda hacia abajo y abre las manos al final del recorrido contratando los tríceps.", defaultSets: 4, defaultReps: 15, icon: "cable" },
    { id: "ex_26", name: "Press Francés en Banco Plano", category: "Tríceps", targetMuscle: "Tríceps (Cabeza Larga)", equipment: "Barra Z y Banco Plano", instructions: "Baja la barra lentamente hacia la frente manteniendo los codos cerrados apuntando al techo.", defaultSets: 4, defaultReps: 10, icon: "barbell" },
    { id: "ex_27", name: "Fondos entre Bancos / Dips", category: "Tríceps", targetMuscle: "Tríceps Braquial", equipment: "Bancos Paralelos", instructions: "Coloca manos en el borde del banco y baja el cuerpo doblando codos a 90 grados.", defaultSets: 3, defaultReps: 15, icon: "bodyweight" },

    // ABDOMEN
    { id: "ex_28", name: "Elevación de Piernas Colgado", category: "Abdomen", targetMuscle: "Abdomen Inferior", equipment: "Barra de Dominadas", instructions: "Colgado de la barra, eleva las rodillas o piernas rectas hacia el pecho usando la fuerza abdominal.", defaultSets: 4, defaultReps: 15, icon: "bodyweight" },
    { id: "ex_29", name: "Crunch Abdominal en Banco Inclinado", category: "Abdomen", targetMuscle: "Recto Abdominal", equipment: "Banco Inclinado", instructions: "Flexiona la columna apretando el abdomen sin jalar del cuello con los brazos.", defaultSets: 4, defaultReps: 20, icon: "bodyweight" },
    { id: "ex_30", name: "Plancha Abdominal Iso", category: "Abdomen", targetMuscle: "Core / Transverso", equipment: "Tapete", instructions: "Mantén el cuerpo recto como una tabla apoyado en antebrazos y puntas de pies durante 45-60s.", defaultSets: 4, defaultReps: 60, icon: "timer" }
  ],
  routines: [
    {
      id: "rout_carlos_1",
      clientId: "cli_1",
      title: "Rutina Hipertrofia & Fuerza 4 Días",
      description: "Programa de volumen muscular diseñado por Coach Roberto",
      schedule: {
        "Lunes": {
          dayName: "Lunes",
          focus: "Pecho y Bíceps",
          exercises: [
            { exerciseId: "ex_1", sets: 4, reps: 10, targetWeightKg: 70 },
            { exerciseId: "ex_2", sets: 4, reps: 12, targetWeightKg: 24 },
            { exerciseId: "ex_5", sets: 3, reps: 15, targetWeightKg: 15 },
            { exerciseId: "ex_22", sets: 4, reps: 12, targetWeightKg: 30 },
            { exerciseId: "ex_23", sets: 3, reps: 12, targetWeightKg: 14 }
          ]
        },
        "Martes": {
          dayName: "Martes",
          focus: "Pierna Completa",
          exercises: [
            { exerciseId: "ex_11", sets: 4, reps: 10, targetWeightKg: 90 },
            { exerciseId: "ex_12", sets: 4, reps: 12, targetWeightKg: 180 },
            { exerciseId: "ex_15", sets: 4, reps: 12, targetWeightKg: 45 },
            { exerciseId: "ex_17", sets: 4, reps: 20, targetWeightKg: 60 }
          ]
        },
        "Miércoles": {
          dayName: "Miércoles",
          focus: "Descanso Activo / Cardio",
          exercises: [
            { exerciseId: "ex_30", sets: 4, reps: 60, targetWeightKg: 0 }
          ]
        },
        "Jueves": {
          dayName: "Jueves",
          focus: "Espalda y Tríceps",
          exercises: [
            { exerciseId: "ex_6", sets: 4, reps: 12, targetWeightKg: 60 },
            { exerciseId: "ex_7", sets: 4, reps: 10, targetWeightKg: 65 },
            { exerciseId: "ex_9", sets: 4, reps: 12, targetWeightKg: 55 },
            { exerciseId: "ex_25", sets: 4, reps: 15, targetWeightKg: 25 },
            { exerciseId: "ex_26", sets: 3, reps: 10, targetWeightKg: 28 }
          ]
        },
        "Viernes": {
          dayName: "Viernes",
          focus: "Hombro y Abdomen",
          exercises: [
            { exerciseId: "ex_18", sets: 4, reps: 8, targetWeightKg: 45 },
            { exerciseId: "ex_20", sets: 4, reps: 15, targetWeightKg: 12 },
            { exerciseId: "ex_21", sets: 4, reps: 15, targetWeightKg: 10 },
            { exerciseId: "ex_28", sets: 4, reps: 15, targetWeightKg: 0 }
          ]
        },
        "Sábado": { dayName: "Sábado", focus: "Descanso", exercises: [] },
        "Domingo": { dayName: "Domingo", focus: "Descanso", exercises: [] }
      }
    }
  ],
  weightLogs: [
    {
      id: "log_101",
      clientId: "cli_1",
      exerciseId: "ex_1",
      exerciseName: "Press de Banca con Barra",
      date: "2026-07-26",
      dayName: "Lunes",
      setNumber: 1,
      weightKg: 65.0,
      repsCompleted: 10,
      notes: "Se sintió liviano, aumentar peso"
    },
    {
      id: "log_102",
      clientId: "cli_1",
      exerciseId: "ex_1",
      exerciseName: "Press de Banca con Barra",
      date: "2026-07-26",
      dayName: "Lunes",
      setNumber: 2,
      weightKg: 70.0,
      repsCompleted: 10,
      notes: "Buena técnica"
    },
    {
      id: "log_103",
      clientId: "cli_1",
      exerciseId: "ex_1",
      exerciseName: "Press de Banca con Barra",
      date: "2026-07-26",
      dayName: "Lunes",
      setNumber: 3,
      weightKg: 72.5,
      repsCompleted: 8,
      notes: "Fallo en rep 9"
    }
  ]
};

// Cargar o inicializar datos
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
    return INITIAL_DATA;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE);
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error leyendo DB local, usando semillas:", e);
    return INITIAL_DATA;
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Routes API

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: "online", app: "GymAura Server", timestamp: new Date().toISOString() });
});

// GET Coach Info
app.get('/api/coach', (req, res) => {
  const db = loadData();
  res.json(db.coach);
});

// GET Exercises (Catalog)
app.get('/api/exercises', (req, res) => {
  const db = loadData();
  const { category, search } = req.query;
  let result = db.exercises;
  if (category && category !== 'Todos') {
    result = result.filter(ex => ex.category.toLowerCase() === category.toLowerCase());
  }
  if (search) {
    const s = search.toLowerCase();
    result = result.filter(ex => ex.name.toLowerCase().includes(s) || ex.targetMuscle.toLowerCase().includes(s));
  }
  res.json(result);
});

// POST Add New Exercise (Coach)
app.post('/api/exercises', (req, res) => {
  const db = loadData();
  const newEx = {
    id: "ex_" + Date.now(),
    name: req.body.name,
    category: req.body.category || "General",
    targetMuscle: req.body.targetMuscle || "Musculatura General",
    equipment: req.body.equipment || "Libre",
    instructions: req.body.instructions || "",
    defaultSets: parseInt(req.body.defaultSets) || 4,
    defaultReps: parseInt(req.body.defaultReps) || 12,
    icon: req.body.icon || "dumbbell"
  };
  db.exercises.push(newEx);
  saveData(db);
  res.status(201).json(newEx);
});

// GET Clients List (Coach View)
app.get('/api/clients', (req, res) => {
  const db = loadData();
  res.json(db.clients);
});

// POST Create Client (Coach)
app.post('/api/clients', (req, res) => {
  const db = loadData();
  const newClient = {
    id: "cli_" + Date.now(),
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone || "",
    goal: req.body.goal || "Acondicionamiento Físico",
    weightKg: parseFloat(req.body.weightKg) || 70.0,
    heightCm: parseInt(req.body.heightCm) || 170,
    avatar: req.body.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80",
    activeRoutineId: null
  };
  db.clients.push(newClient);
  saveData(db);
  res.status(201).json(newClient);
});

// GET Weekly Routine for a Client
app.get('/api/routines/weekly/:clientId', (req, res) => {
  const db = loadData();
  const { clientId } = req.params;
  let routine = db.routines.find(r => r.clientId === clientId);
  
  if (!routine) {
    // Si no existe, genera estructura vacía para los 7 días
    const emptyDays = {};
    ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].forEach(day => {
      emptyDays[day] = { dayName: day, focus: "Sin asignar", exercises: [] };
    });
    routine = {
      id: "rout_" + clientId + "_" + Date.now(),
      clientId: clientId,
      title: "Rutina Semanal",
      description: "Asignada por el entrenador",
      schedule: emptyDays
    };
  }
  res.json(routine);
});

// POST Save/Update Weekly Routine (Coach)
app.post('/api/routines/weekly', (req, res) => {
  const db = loadData();
  const { clientId, title, description, schedule } = req.body;
  
  let existingIndex = db.routines.findIndex(r => r.clientId === clientId);
  const updatedRoutine = {
    id: existingIndex >= 0 ? db.routines[existingIndex].id : "rout_" + clientId + "_" + Date.now(),
    clientId: clientId,
    title: title || "Rutina Semanal",
    description: description || "Plan personalizado",
    schedule: schedule
  };

  if (existingIndex >= 0) {
    db.routines[existingIndex] = updatedRoutine;
  } else {
    db.routines.push(updatedRoutine);
  }

  // Update client active routine
  const clientObj = db.clients.find(c => c.id === clientId);
  if (clientObj) {
    clientObj.activeRoutineId = updatedRoutine.id;
  }

  saveData(db);
  res.json(updatedRoutine);
});

// GET Weight Logs for Client
app.get('/api/logs/:clientId', (req, res) => {
  const db = loadData();
  const { clientId } = req.params;
  const { exerciseId } = req.query;

  let logs = db.weightLogs.filter(l => l.clientId === clientId);
  if (exerciseId) {
    logs = logs.filter(l => l.exerciseId === exerciseId);
  }
  res.json(logs);
});

// POST Log Weight/Set (Client)
app.post('/api/logs', (req, res) => {
  const db = loadData();
  const newLog = {
    id: "log_" + Date.now(),
    clientId: req.body.clientId,
    exerciseId: req.body.exerciseId,
    exerciseName: req.body.exerciseName,
    date: req.body.date || new Date().toISOString().split('T')[0],
    dayName: req.body.dayName || "Hoy",
    setNumber: parseInt(req.body.setNumber) || 1,
    weightKg: parseFloat(req.body.weightKg) || 0,
    repsCompleted: parseInt(req.body.repsCompleted) || 0,
    notes: req.body.notes || ""
  };

  db.weightLogs.push(newLog);
  saveData(db);
  res.status(201).json(newLog);
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GymAura Server ejecutándose en http://0.0.0.0:${PORT}`);
});
