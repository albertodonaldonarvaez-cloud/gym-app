'use strict';
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const rateLimit = require('express-rate-limit');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gymaura-default-dev-secret-change-in-prod';
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'exercises');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: { error: 'Too many requests' } });
app.use('/api/', limiter);

// Static media with long cache
app.use('/uploads/exercises', express.static(UPLOADS_DIR, {
  maxAge: '30d',
  etag: true,
  lastModified: true
}));

// ─── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function coachOnly(req, res, next) {
  if (req.user.role !== 'COACH') return res.status(403).json({ error: 'Coach only' });
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ─── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', app: 'GymAura Server v2', timestamp: new Date().toISOString() });
});

// ─── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, name, role = 'CLIENT', coachId } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role, coachId: coachId || null }
    });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, coachId: user.coachId } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── LEGACY ENDPOINTS (backward compat) ────────────────────────────────────────
app.get('/api/coach', authMiddleware, async (req, res) => {
  try {
    const coaches = await prisma.user.findMany({ where: { role: 'COACH' }, select: { id: true, email: true, name: true, avatar: true } });
    res.json(coaches[0] || {});
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/clients', authMiddleware, async (req, res) => {
  try {
    const clients = await prisma.user.findMany({
      where: { role: 'CLIENT' },
      select: { id: true, email: true, name: true, avatar: true, goal: true, weightKg: true, heightCm: true }
    });
    // Map to legacy format
    res.json(clients.map(c => ({ id: c.id, name: c.name, email: c.email, avatar: c.avatar, goal: c.goal, weightKg: c.weightKg, heightCm: c.heightCm, activeRoutineId: null })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/clients', authMiddleware, coachOnly, async (req, res) => {
  try {
    const { name, email, goal, weightKg, heightCm } = req.body;
    const tempPw = await bcrypt.hash('GymAura2025!', 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash: tempPw, role: 'CLIENT', goal: goal || 'Acondicionamiento Físico', weightKg: parseFloat(weightKg) || 70, heightCm: parseInt(heightCm) || 170, coachId: req.user.id }
    });
    res.status(201).json({ id: user.id, name: user.name, email: user.email, goal: user.goal, weightKg: user.weightKg, heightCm: user.heightCm });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── EXERCISES ─────────────────────────────────────────────────────────────────
const FREE_EXERCISE_CDN = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

/**
 * Construye el array de URLs de imagen para un ejercicio.
 * Si tiene mediaFilename (viene del Free Exercise DB), genera ambas imágenes (0.jpg y 1.jpg).
 * Si tiene mediaUrl custom (subida por el coach), la devuelve como único elemento.
 */
function buildImageUrls(exercise) {
  if (exercise.mediaFilename) {
    // Free Exercise DB: las imágenes están en /ExerciseId/0.jpg y /ExerciseId/1.jpg
    const dir = exercise.mediaFilename.replace(/\/\d+\.jpg$/, '');
    return [
      `${FREE_EXERCISE_CDN}/${dir}/0.jpg`,
      `${FREE_EXERCISE_CDN}/${dir}/1.jpg`,
    ];
  }
  if (exercise.mediaUrl) return [exercise.mediaUrl];
  return [];
}

app.get('/api/exercises', async (req, res) => {
  try {
    const { category, search, muscle_group, page, limit } = req.query;
    const where = {};
    if (category && category !== 'Todos') where.category = category;
    if (muscle_group && muscle_group !== 'Todos') where.muscleGroup = { contains: muscle_group, mode: 'insensitive' };
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { muscleGroup: { contains: search, mode: 'insensitive' } },
      { equipment: { contains: search, mode: 'insensitive' } },
    ];

    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const pageSize = Math.min(2000, parseInt(limit) || 50);

    const [exercises, total] = await Promise.all([
      prisma.exercise.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      prisma.exercise.count({ where }),
    ]);

    res.json({
      data: exercises.map(e => ({
        id:           e.id,
        name:         e.name,
        category:     e.category,
        targetMuscle: e.muscleGroup,
        muscleGroup:  e.muscleGroup,
        equipment:    e.equipment,
        instructions: e.instructions,
        defaultSets:  e.defaultSets,
        defaultReps:  e.defaultReps,
        mediaUrl:     e.mediaUrl,
        imageUrls:    buildImageUrls(e),   // Array con URLs del CDN
        icon:         'dumbbell',
      })),
      total,
      page:  pageNum,
      pages: Math.ceil(total / pageSize),
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});


app.post('/api/exercises', authMiddleware, coachOnly, async (req, res) => {
  try {
    const ex = await prisma.exercise.create({
      data: {
        name: req.body.name,
        muscleGroup: req.body.targetMuscle || req.body.muscleGroup || 'General',
        category: req.body.category || 'General',
        equipment: req.body.equipment || 'Libre',
        instructions: req.body.instructions || '',
        defaultSets: parseInt(req.body.defaultSets) || 4,
        defaultReps: parseInt(req.body.defaultReps) || 12
      }
    });
    res.status(201).json({ ...ex, targetMuscle: ex.muscleGroup, icon: 'dumbbell' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Upload media for exercise
app.post('/api/exercises/:id/media', authMiddleware, coachOnly, upload.single('media'), async (req, res) => {
  try {
    const url = `/uploads/exercises/${req.file.filename}`;
    const ex = await prisma.exercise.update({
      where: { id: req.params.id },
      data: { mediaFilename: req.file.filename, mediaUrl: url }
    });
    res.json({ mediaUrl: ex.mediaUrl });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── ROUTINES (LEGACY + V1) ─────────────────────────────────────────────────────
app.get('/api/routines/weekly/:clientId', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const routine = await prisma.routinePlan.findFirst({ where: { athleteId: clientId }, orderBy: { updatedAt: 'desc' } });
    if (!routine) {
      const emptyDays = {};
      ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].forEach(d => {
        emptyDays[d] = { dayName: d, focus: 'Sin asignar', exercises: [] };
      });
      return res.json({ id: null, clientId, title: 'Rutina Semanal', description: 'Sin asignar', schedule: emptyDays });
    }
    res.json({ id: routine.id, clientId: routine.athleteId, title: routine.title, description: routine.description, schedule: routine.schedule });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/routines/weekly', authMiddleware, coachOnly, async (req, res) => {
  try {
    const { clientId, title, description, schedule } = req.body;
    const existing = await prisma.routinePlan.findFirst({ where: { athleteId: clientId } });
    let routine;
    if (existing) {
      routine = await prisma.routinePlan.update({ where: { id: existing.id }, data: { title, description, schedule } });
    } else {
      routine = await prisma.routinePlan.create({ data: { coachId: req.user.id, athleteId: clientId, title: title || 'Rutina Semanal', description: description || 'Plan personalizado', schedule } });
    }
    res.json({ id: routine.id, clientId: routine.athleteId, title: routine.title, description: routine.description, schedule: routine.schedule });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// V1 - Current week routine (authenticated client gets their own)
app.get('/api/v1/routines/current-week', authMiddleware, async (req, res) => {
  try {
    const athleteId = req.user.id;
    const routine = await prisma.routinePlan.findFirst({ where: { athleteId }, orderBy: { updatedAt: 'desc' } });
    if (!routine) return res.json({ schedule: {} });
    // Enrich with exercise media URLs
    const schedule = routine.schedule;
    // Collect all exercise IDs
    const exerciseIds = new Set();
    for (const dayKey of Object.keys(schedule)) {
      const day = schedule[dayKey];
      if (day.exercises && Array.isArray(day.exercises)) {
        for (const ex of day.exercises) {
          if (ex.exerciseId) exerciseIds.add(ex.exerciseId);
        }
      }
    }
    // Bulk fetch exercises
    const exercisesData = await prisma.exercise.findMany({ where: { id: { in: [...exerciseIds] } } });
    const exercisesMap = Object.fromEntries(exercisesData.map(e => [e.id, e]));
    // Enrich schedule
    for (const dayKey of Object.keys(schedule)) {
      const day = schedule[dayKey];
      if (day.exercises && Array.isArray(day.exercises)) {
        for (const ex of day.exercises) {
          const exData = exercisesMap[ex.exerciseId];
          if (exData) {
            ex.name = exData.name;
            ex.mediaUrl = exData.mediaUrl || null;
            ex.muscleGroup = exData.muscleGroup;
          }
        }
      }
    }
    res.json({ id: routine.id, title: routine.title, description: routine.description, schedule });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── WORKOUT LOGS (LEGACY) ─────────────────────────────────────────────────────
app.get('/api/logs/:clientId', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { exerciseId } = req.query;
    const where = { athleteId: clientId };
    if (exerciseId) where.exerciseId = exerciseId;
    const logs = await prisma.setLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    res.json(logs.map(l => ({
      id: l.id, clientId: l.athleteId, exerciseId: l.exerciseId,
      date: l.createdAt.toISOString().split('T')[0], setNumber: l.setNumber,
      weightKg: l.weightKg, repsCompleted: l.reps, notes: l.notes
    })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/logs', authMiddleware, async (req, res) => {
  try {
    const athleteId = req.user.id;
    // Find or create today's workout log
    const today = new Date();
    today.setHours(0,0,0,0);
    let wLog = await prisma.workoutLog.findFirst({ where: { athleteId, date: { gte: today } } });
    if (!wLog) wLog = await prisma.workoutLog.create({ data: { athleteId } });
    const setLog = await prisma.setLog.create({
      data: {
        clientLogId: req.body.clientLogId || `cli_${Date.now()}_${Math.random()}`,
        workoutLogId: wLog.id,
        athleteId,
        exerciseId: req.body.exerciseId,
        weightKg: parseFloat(req.body.weightKg) || 0,
        reps: parseInt(req.body.repsCompleted) || 0,
        setNumber: parseInt(req.body.setNumber) || 1,
        notes: req.body.notes || ''
      }
    });
    res.status(201).json({ id: setLog.id, clientId: athleteId, exerciseId: setLog.exerciseId, setNumber: setLog.setNumber, weightKg: setLog.weightKg, repsCompleted: setLog.reps, notes: setLog.notes, date: setLog.createdAt.toISOString().split('T')[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── V1 SYNC (OFFLINE-FIRST) ───────────────────────────────────────────────────
app.post('/api/v1/workouts/sync', authMiddleware, async (req, res) => {
  try {
    const athleteId = req.user.id;
    const { sets } = req.body; // Array of SetLog objects from mobile
    if (!Array.isArray(sets) || sets.length === 0) return res.json({ synced: 0, failed: 0 });
    let synced = 0, failed = 0;
    // Find or create today's workout log
    const today = new Date();
    today.setHours(0,0,0,0);
    let wLog = await prisma.workoutLog.findFirst({ where: { athleteId, date: { gte: today } } });
    if (!wLog) wLog = await prisma.workoutLog.create({ data: { athleteId } });
    for (const s of sets) {
      try {
        await prisma.setLog.upsert({
          where: { clientLogId: s.clientLogId },
          update: { weightKg: s.weightKg, reps: s.reps, rpe: s.rpe, notes: s.notes || '' },
          create: {
            clientLogId: s.clientLogId,
            workoutLogId: wLog.id,
            athleteId,
            exerciseId: s.exerciseId,
            weightKg: s.weightKg ?? 0,
            reps: s.reps ?? 0,
            rpe: s.rpe ?? 0,
            setNumber: s.setNumber || 1,
            notes: s.notes || ''
          }
        });
        synced++;
      } catch (err) {
        console.error('Sync error for set:', s.clientLogId, err.message);
        failed++;
      }
    }
    res.json({ synced, failed, workoutLogId: wLog.id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── V1 HISTORY & RECORDS ──────────────────────────────────────────────────────
app.get('/api/v1/user/workout-history', authMiddleware, async (req, res) => {
  try {
    const athleteId = req.user.id;
    const logs = await prisma.setLog.findMany({
      where: { athleteId },
      orderBy: { createdAt: 'asc' },
      include: { exercise: { select: { name: true, muscleGroup: true } } }
    });
    res.json(logs.map(l => ({
      id: l.id,
      clientLogId: l.clientLogId,
      exerciseId: l.exerciseId,
      exerciseName: l.exercise?.name || '',
      workoutLogId: l.workoutLogId,
      weightKg: l.weightKg,
      reps: l.reps,
      rpe: l.rpe,
      setNumber: l.setNumber,
      notes: l.notes,
      createdAt: l.createdAt.toISOString()
    })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/v1/exercises/:id/last-performance', authMiddleware, async (req, res) => {
  try {
    const athleteId = req.user.id;
    const last = await prisma.setLog.findFirst({
      where: { athleteId, exerciseId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    if (!last) return res.json(null);
    res.json({ weightKg: last.weightKg, reps: last.reps, rpe: last.rpe, createdAt: last.createdAt.toISOString() });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── V1 HUAWEI HEALTH KIT ─────────────────────────────────────────────────────
app.post('/api/v1/huawei/sync-workout', authMiddleware, async (req, res) => {
  try {
    const athleteId = req.user.id;
    const { caloriesBurned, avgHr, durationSeconds, date } = req.body;
    const workoutDate = date ? new Date(date) : new Date();
    let wLog = await prisma.workoutLog.findFirst({
      where: { athleteId, date: { gte: new Date(workoutDate.toDateString()) } }
    });
    if (wLog) {
      wLog = await prisma.workoutLog.update({
        where: { id: wLog.id },
        data: { caloriesBurned: parseFloat(caloriesBurned) || null, avgHr: parseInt(avgHr) || null, durationSeconds: parseInt(durationSeconds) || null, source: 'huawei' }
      });
    } else {
      wLog = await prisma.workoutLog.create({
        data: { athleteId, caloriesBurned: parseFloat(caloriesBurned) || null, avgHr: parseInt(avgHr) || null, durationSeconds: parseInt(durationSeconds) || null, source: 'huawei', date: workoutDate }
      });
    }
    res.json({ workoutLogId: wLog.id, synced: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── ROUTE ALIASES (web frontend compatibility) ─────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  // Forward to v1 endpoint
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, coachId: user.coachId } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role = 'CLIENT', coachId } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash, name, role, coachId: coachId || null } });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/coach/clients', authMiddleware, async (req, res) => {
  try {
    // For ADMIN: return all clients. For COACH: return only their assigned clients.
    const where = req.user.role === 'ADMIN'
      ? { role: 'CLIENT' }
      : { role: 'CLIENT', coachId: req.user.id };
    const clients = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, avatar: true, goal: true, weightKg: true, heightCm: true, coachId: true }
    });
    res.json(clients);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/routines/:athleteId', authMiddleware, async (req, res) => {
  try {
    const routine = await prisma.routinePlan.findFirst({
      where: { athleteId: req.params.athleteId },
      orderBy: { updatedAt: 'desc' }
    });
    if (!routine) return res.json({ id: '', title: 'Rutina Semanal', description: '', schedule: {} });
    res.json(routine);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/routines/:athleteId', authMiddleware, async (req, res) => {
  try {
    const { title, description, schedule } = req.body;
    const athleteId = req.params.athleteId;
    const existing = await prisma.routinePlan.findFirst({ where: { athleteId } });
    let routine;
    if (existing) {
      routine = await prisma.routinePlan.update({
        where: { id: existing.id },
        data: { title, description, schedule, coachId: req.user.id }
      });
    } else {
      routine = await prisma.routinePlan.create({
        data: { coachId: req.user.id, athleteId, title, description, schedule }
      });
    }
    res.json(routine);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── ADMIN ENDPOINTS ────────────────────────────────────────────────────────
app.get('/api/admin/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [totalUsers, totalCoaches, totalClients, totalExercises, unassigned] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'COACH' } }),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.exercise.count(),
      prisma.user.count({ where: { role: 'CLIENT', coachId: null } }),
    ]);
    res.json({ totalUsers, totalCoaches, totalClients, totalExercises, unassigned });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { role, search } = req.query;
    const where = {};
    if (role && role !== 'ALL') where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, avatar: true, goal: true, weightKg: true, heightCm: true, coachId: true, createdAt: true,
        coach: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { email, password, name, role = 'CLIENT', coachId, goal, weightKg, heightCm } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role, coachId: coachId || null, goal: goal || 'Acondicionamiento Físico', weightKg: weightKg || 70, heightCm: heightCm || 170 }
    });
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/admin/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, role, goal, weightKg, heightCm, password } = req.body;
    const data = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role;
    if (goal) data.goal = goal;
    if (weightKg !== undefined) data.weightKg = parseFloat(weightKg);
    if (heightCm !== undefined) data.heightCm = parseInt(heightCm);
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) {
    console.error(e);
    if (e.code === 'P2025') return res.status(404).json({ error: 'User not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    // Prevent deleting yourself
    if (id === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Cascade delete in the correct order to avoid FK violations:
    // 1. SetLogs of this user
    await prisma.setLog.deleteMany({ where: { athleteId: id } });
    // 2. WorkoutLogs of this user
    await prisma.workoutLog.deleteMany({ where: { athleteId: id } });
    // 3. RoutinePlans where this user is the athlete
    await prisma.routinePlan.deleteMany({ where: { athleteId: id } });
    // 4. If this user is a COACH, delete their plans and unassign their clients
    if (target.role === 'COACH') {
      await prisma.routinePlan.deleteMany({ where: { coachId: id } });
      await prisma.user.updateMany({ where: { coachId: id }, data: { coachId: null } });
    }
    // 5. Finally delete the user
    await prisma.user.delete({ where: { id } });

    res.json({ ok: true, deleted: target.name });
  } catch (e) {
    console.error('Delete user error:', e);
    if (e.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});

app.put('/api/admin/assign', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { clientId, coachId } = req.body;
    if (!clientId || !coachId) return res.status(400).json({ error: 'clientId and coachId required' });
    const coach = await prisma.user.findUnique({ where: { id: coachId } });
    if (!coach || coach.role !== 'COACH') return res.status(400).json({ error: 'Invalid coach' });
    const user = await prisma.user.update({ where: { id: clientId }, data: { coachId } });
    res.json({ id: user.id, name: user.name, coachId: user.coachId });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/admin/unassign', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    const user = await prisma.user.update({ where: { id: clientId }, data: { coachId: null } });
    res.json({ id: user.id, name: user.name, coachId: null });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── ROUTINE TEMPLATES ────────────────────────────────────────────────────────

// List coach's templates
app.get('/api/v1/coach/templates', authMiddleware, coachOnly, async (req, res) => {
  try {
    const templates = await prisma.routineTemplate.findMany({
      where: { coachId: req.user.id },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(templates.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      schedule: t.schedule,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Create or update a template
app.post('/api/v1/coach/templates', authMiddleware, coachOnly, async (req, res) => {
  try {
    const { id, title, description, schedule } = req.body;
    if (!title || !schedule) return res.status(400).json({ error: 'title and schedule required' });

    let template;
    if (id) {
      // Update existing — verify ownership
      const existing = await prisma.routineTemplate.findUnique({ where: { id } });
      if (!existing || existing.coachId !== req.user.id)
        return res.status(404).json({ error: 'Template not found' });
      template = await prisma.routineTemplate.update({
        where: { id },
        data: { title, description: description || 'Plantilla de rutina', schedule, updatedAt: new Date() }
      });
    } else {
      template = await prisma.routineTemplate.create({
        data: { coachId: req.user.id, title, description: description || 'Plantilla de rutina', schedule }
      });
    }
    res.json({ id: template.id, title: template.title, description: template.description, schedule: template.schedule });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Delete a template
app.delete('/api/v1/coach/templates/:id', authMiddleware, coachOnly, async (req, res) => {
  try {
    const template = await prisma.routineTemplate.findUnique({ where: { id: req.params.id } });
    if (!template || template.coachId !== req.user.id)
      return res.status(404).json({ error: 'Template not found' });
    await prisma.routineTemplate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Assign a template to one or more clients (copies schedule as their RoutinePlan)
app.post('/api/v1/coach/templates/:id/assign', authMiddleware, coachOnly, async (req, res) => {
  try {
    const template = await prisma.routineTemplate.findUnique({ where: { id: req.params.id } });
    if (!template || template.coachId !== req.user.id)
      return res.status(404).json({ error: 'Template not found' });

    const { clientIds } = req.body; // Array of client user IDs
    if (!Array.isArray(clientIds) || clientIds.length === 0)
      return res.status(400).json({ error: 'clientIds[] required' });

    let assigned = 0, failed = 0;
    for (const clientId of clientIds) {
      try {
        // Verify this client belongs to the coach
        const client = await prisma.user.findFirst({
          where: { id: clientId, role: 'CLIENT', coachId: req.user.id }
        });
        if (!client) { failed++; continue; }

        // Upsert routine plan — copy the template schedule
        const existing = await prisma.routinePlan.findFirst({ where: { athleteId: clientId } });
        if (existing) {
          await prisma.routinePlan.update({
            where: { id: existing.id },
            data: { title: template.title, description: template.description, schedule: template.schedule, updatedAt: new Date() }
          });
        } else {
          await prisma.routinePlan.create({
            data: { coachId: req.user.id, athleteId: clientId, title: template.title, description: template.description, schedule: template.schedule }
          });
        }
        assigned++;
      } catch (err) { console.error('Assign error for client', clientId, err.message); failed++; }
    }

    res.json({ ok: true, assigned, failed, templateTitle: template.title });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── WARMUP SESSIONS ──────────────────────────────────────────────────────────

// Start warmup
app.post('/api/v1/warmup/start', authMiddleware, async (req, res) => {
  try {
    const { startedAt } = req.body;
    const warmup = await prisma.warmupSession.create({
      data: {
        athleteId: req.user.id,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
      }
    });
    res.json({ id: warmup.id, startedAt: warmup.startedAt });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Finish warmup
app.post('/api/v1/warmup/finish', authMiddleware, async (req, res) => {
  try {
    const { warmupId, durationSec, notes, finishedAt } = req.body;
    const warmup = await prisma.warmupSession.findUnique({ where: { id: warmupId } });
    if (!warmup || warmup.athleteId !== req.user.id) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.warmupSession.update({
      where: { id: warmupId },
      data: {
        durationSec: durationSec || 0,
        notes: notes || '',
        finishedAt: finishedAt ? new Date(finishedAt) : new Date(),
        isSynced: true
      }
    });
    res.json({ ok: true, id: updated.id, durationSec: updated.durationSec });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Get warmup history (last 30)
app.get('/api/v1/warmup/history', authMiddleware, async (req, res) => {
  try {
    const sessions = await prisma.warmupSession.findMany({
      where: { athleteId: req.user.id },
      orderBy: { startedAt: 'desc' },
      take: 30
    });
    res.json(sessions.map(w => ({
      id: w.id,
      startedAt: w.startedAt,
      finishedAt: w.finishedAt,
      durationSec: w.durationSec,
      notes: w.notes
    })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── WORKOUT SESSION TRACKING ─────────────────────────────────────────────────

// Save full workout session (foreground service final sync)
app.post('/api/v1/workouts/session', authMiddleware, async (req, res) => {
  try {
    const { sessionId, dayName, startedAt, finishedAt, durationSeconds } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    // Upsert by sessionId to prevent duplicate sessions from retry sync
    const existing = await prisma.workoutLog.findFirst({ where: { sessionId } });
    let log;
    if (existing) {
      log = await prisma.workoutLog.update({
        where: { id: existing.id },
        data: {
          finishedAt: finishedAt ? new Date(finishedAt) : undefined,
          durationSeconds: durationSeconds || existing.durationSeconds,
        }
      });
    } else {
      log = await prisma.workoutLog.create({
        data: {
          athleteId: req.user.id,
          sessionId,
          dayName: dayName || '',
          startedAt: startedAt ? new Date(startedAt) : new Date(),
          finishedAt: finishedAt ? new Date(finishedAt) : null,
          durationSeconds: durationSeconds || null,
          source: 'app_session'
        }
      });
    }
    res.json({ ok: true, workoutLogId: log.id, sessionId: log.sessionId });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── CUSTOM EXERCISES (with video URL / yt-dlp) ───────────────────────────────

// Create custom exercise (coach only). videoUrl is the TikTok/YT/direct URL.
app.post('/api/v1/coach/exercises/custom', authMiddleware, coachOnly, async (req, res) => {
  try {
    const { name, muscleGroup, category, equipment, instructions, videoUrl } = req.body;
    if (!name || !muscleGroup) return res.status(400).json({ error: 'name and muscleGroup required' });

    // Create exercise first (without video) so we have the ID
    const exercise = await prisma.exercise.create({
      data: {
        name,
        muscleGroup,
        category: category || 'General',
        equipment: equipment || 'Libre',
        instructions: instructions || '',
        isCustom: true,
        coachId: req.user.id,
        videoUrl: videoUrl || null
      }
    });

    // If video URL provided, attempt yt-dlp download in background
    if (videoUrl) {
      const outputPath = path.join(UPLOADS_DIR, `${exercise.id}.mp4`);
      const serverBase = process.env.SERVER_URL || 'https://gym-app.tecti-cloud.com';

      // Try yt-dlp (installed in Docker), fall back to direct URL
      const ytdlp = execFile('yt-dlp', [
        '-f', 'mp4/best[ext=mp4]/best',
        '-o', outputPath,
        '--no-playlist',
        '--max-filesize', '50m',
        videoUrl
      ], { timeout: 120000 }, async (err) => {
        if (!err && fs.existsSync(outputPath)) {
          const hostedUrl = `${serverBase}/uploads/exercises/${exercise.id}.mp4`;
          await prisma.exercise.update({
            where: { id: exercise.id },
            data: { mediaUrl: hostedUrl, videoUrl }
          }).catch(() => {});
          console.log(`✅ Video downloaded for exercise ${exercise.id}`);
        } else {
          console.log(`⚠️ yt-dlp failed for ${exercise.id}, using direct URL: ${err?.message}`);
          // Keep the original videoUrl so the app can play directly
        }
      });
    }

    res.json({
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      videoUrl: exercise.videoUrl,
      isCustom: true,
      status: videoUrl ? 'processing' : 'ready'
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Get custom exercises for coach
app.get('/api/v1/coach/exercises/custom', authMiddleware, coachOnly, async (req, res) => {
  try {
    const exercises = await prisma.exercise.findMany({
      where: { coachId: req.user.id, isCustom: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(exercises);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GymAura Server v2 ejecutándose en http://0.0.0.0:${PORT}`);
});
