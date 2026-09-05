'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const rateLimit = require('express-rate-limit');
const { execFile } = require('child_process');
const nodemailer = require('nodemailer');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gymaura-default-dev-secret-change-in-prod';
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'exercises');
const IS_PROD = process.env.NODE_ENV === 'production';
const SERVER_URL = process.env.SERVER_URL || 'https://gym-app.tecti-cloud.com';

// ─── SMTP Configuration (reads from DB → env → disabled) ────────────────────
let _smtpTransport = null;

async function getSmtpConfig() {
  try {
    const settings = await prisma.systemSetting.findMany({ where: { category: 'smtp' } });
    const cfg = {};
    for (const s of settings) cfg[s.key] = s.value;
    // DB settings take priority, then env vars
    const host = cfg.smtp_host || process.env.SMTP_HOST || '';
    const user = cfg.smtp_user || process.env.SMTP_USER || '';
    const pass = cfg.smtp_pass || process.env.SMTP_PASS || '';
    const port = parseInt(cfg.smtp_port || process.env.SMTP_PORT || '587');
    const from = cfg.smtp_from || process.env.SMTP_FROM || '"GymAura" <noreply@gymaura.com>';
    const enabled = cfg.smtp_enabled === 'true' || !!(process.env.SMTP_HOST && process.env.SMTP_USER);
    return { host, user, pass, port, from, enabled: enabled && !!host && !!user && !!pass };
  } catch (e) {
    // DB table might not exist yet during first run
    const host = process.env.SMTP_HOST || '';
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    return { host, user, pass, port: 587, from: '"GymAura" <noreply@gymaura.com>', enabled: !!(host && user && pass) };
  }
}

async function getSmtpTransport() {
  const cfg = await getSmtpConfig();
  if (!cfg.enabled) return null;
  // Recreate transport if config changed
  _smtpTransport = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return _smtpTransport;
}

async function sendVerificationEmail(email, name, token) {
  const cfg = await getSmtpConfig();
  const verifyUrl = `${SERVER_URL}/api/v1/auth/verify/${token}`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <div style="text-align:center;margin-bottom:24px">
        <h1 style="color:#007AFF;font-size:28px;margin:0">GymAura</h1>
        <p style="color:#6b7280;font-size:14px;margin-top:4px">Verificación de correo electrónico</p>
      </div>
      <p style="color:#1f2937;font-size:16px">Hola <strong>${name}</strong>,</p>
      <p style="color:#4b5563;font-size:14px;line-height:1.6">
        Gracias por registrarte en GymAura. Para completar tu registro, verifica tu correo electrónico:
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${verifyUrl}" style="background:#007AFF;color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
          Verificar mi correo
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center">
        Si no creaste esta cuenta, ignora este mensaje.<br>
        El enlace expira en 24 horas.
      </p>
    </div>`;

  const transport = await getSmtpTransport();
  if (transport) {
    await transport.sendMail({ from: cfg.from, to: email, subject: 'Verifica tu correo — GymAura', html });
    console.log(`[SMTP] Verification email sent to ${email}`);
  } else {
    console.log(`[SMTP] Not configured. Verification link for ${email}: ${verifyUrl}`);
  }
}


// Role hierarchy — higher index = higher privilege
const ROLE_HIERARCHY = ['CLIENT', 'COACH', 'ADMIN'];
const roleLevel = (role) => ROLE_HIERARCHY.indexOf(role ?? 'CLIENT');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ─── Multer ───────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Only use extension from original filename — sanitize it
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, unique + ext);
  }
});
// HIGH-4 fix: Only allow image/video MIME types, max 50MB
const ALLOWED_MIME = /^(image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|webm|quicktime))$/;
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.test(file.mimetype)) {
      return cb(new Error('Solo se permiten imágenes (jpg, png, gif, webp) y videos (mp4, webm)'));
    }
    cb(null, true);
  }
});

// ─── Security middleware ──────────────────────────────────────
// Trust nginx proxy so req.ip reflects the real client IP (rate limiters work correctly)
app.set('trust proxy', 1);

// FATAL: JWT_SECRET must be set in production
if (IS_PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('default'))) {
  console.error('FATAL: JWT_SECRET env variable is not set or uses default value in production. Exiting.');
  process.exit(1);
}

// Helmet: sets secure HTTP headers (XSS, HSTS, CSP, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // disabled so nginx handles it, or can customize
  crossOriginEmbedderPolicy: false,
}));

// CORS: restrict origins in production
const allowedOrigins = IS_PROD
  ? ['https://gym-app.tecti-cloud.com']
  : ['http://localhost:5173', 'http://localhost:3005', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (mobile apps, curl, etc.) in dev
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ─── Rate limiters ────────────────────────────────────────────
// General API limiter: 200 req / 1 min per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 200,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta en un momento.' }
});
app.use('/api/', generalLimiter);

// Auth limiter: 5 attempts / 15 min per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' },
  skipSuccessfulRequests: true, // only count failed attempts
});

// Admin action limiter: 60 sensitive actions / 5 min
const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas acciones admin. Intenta en 5 minutos.' }
});

// Static media with long cache
app.use('/uploads/exercises', express.static(UPLOADS_DIR, {
  maxAge: '30d',
  etag: true,
  lastModified: true
}));

// Avatars directory
const AVATARS_DIR = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, req.user.id + ext);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype)) {
      return cb(new Error('Solo imágenes (jpg, png, gif, webp)'));
    }
    cb(null, true);
  }
});
app.use('/uploads/avatars', express.static(AVATARS_DIR, { maxAge: '7d', etag: true }));

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
// SECURITY: Register always forces CLIENT role — role field from body is IGNORED
app.post('/api/v1/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name, coachId } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, contraseña y nombre requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ error: 'Email ya registrado' });
    const passwordHash = await bcrypt.hash(password, 12);
    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail, passwordHash, name: name.trim(), role: 'CLIENT',
        coachId: coachId || null, verifyToken, verifyExpires, emailVerified: false
      }
    });
    // Send verification email (non-blocking)
    sendVerificationEmail(normalizedEmail, name.trim(), verifyToken).catch(e =>
      console.error('[SMTP] Error sending verification:', e.message)
    );
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    console.log(`[AUTH] Register: ${user.email} from ${req.ip}`);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: false } });
  } catch (e) {
    console.error('[AUTH] Register error:', e.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/v1/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attacks.1234567890';
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : await bcrypt.compare(password, dummyHash);
    if (!user || !valid) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log(`[AUTH] Login: ${user.email} (${user.role}) from ${req.ip}`);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, coachId: user.coachId, emailVerified: user.emailVerified }
    });
  } catch (e) {
    console.error('[AUTH] Login error:', e.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─── EMAIL VERIFICATION ────────────────────────────────────────────────────────
app.get('/api/v1/auth/verify/:token', async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { verifyToken: req.params.token, verifyExpires: { gt: new Date() } }
    });
    if (!user) {
      return res.status(400).send(`
        <html><body style="font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f9fafb">
          <div style="text-align:center;max-width:400px;padding:32px">
            <h2 style="color:#ef4444;margin-bottom:12px">❌ Enlace inválido o expirado</h2>
            <p style="color:#6b7280;font-size:14px">Solicita un nuevo enlace de verificación desde la app.</p>
          </div>
        </body></html>
      `);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyToken: null, verifyExpires: null }
    });
    console.log(`[AUTH] Email verified: ${user.email}`);
    res.send(`
      <html><body style="font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f9fafb">
        <div style="text-align:center;max-width:400px;padding:32px">
          <h2 style="color:#34C759;margin-bottom:12px">✅ Correo verificado</h2>
          <p style="color:#1f2937;font-size:16px;font-weight:600">${user.name}</p>
          <p style="color:#6b7280;font-size:14px;margin-top:8px">Tu correo electrónico ha sido verificado exitosamente. Ya puedes cerrar esta ventana.</p>
        </div>
      </body></html>
    `);
  } catch (e) { console.error('[AUTH] Verify error:', e.message); res.status(500).json({ error: 'Error del servidor' }); }
});

app.post('/api/v1/auth/resend-verify', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.emailVerified) return res.json({ message: 'Email ya verificado', emailVerified: true });
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken, verifyExpires } });
    await sendVerificationEmail(user.email, user.name, verifyToken);
    res.json({ message: 'Email de verificación reenviado', emailVerified: false });
  } catch (e) { console.error('[AUTH] Resend verify error:', e.message); res.status(500).json({ error: 'Error del servidor' }); }
});

// ─── COACH: CREATE CLIENT (with quota) ──────────────────────────────────────────
app.post('/api/v1/coach/clients', authMiddleware, async (req, res) => {
  try {
    const { role, id: coachId } = req.user;
    if (role !== 'COACH' && role !== 'ADMIN') return res.status(403).json({ error: 'Solo coaches pueden agregar clientes' });

    // Check quota for COACH (ADMIN has no limit)
    if (role === 'COACH') {
      const coach = await prisma.user.findUnique({ where: { id: coachId } });
      const currentClients = await prisma.user.count({ where: { coachId, role: 'CLIENT' } });
      if (coach.maxClients > 0 && currentClients >= coach.maxClients) {
        return res.status(403).json({
          error: `Límite alcanzado: tienes ${currentClients}/${coach.maxClients} clientes. Contacta al admin para aumentar tu cuota.`
        });
      }
    }

    const { email, password, name, goal, weightKg, heightCm } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, contraseña y nombre requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ error: 'Email ya registrado' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const client = await prisma.user.create({
      data: {
        email: normalizedEmail, passwordHash, name: name.trim(), role: 'CLIENT',
        coachId, goal: goal || 'Acondicionamiento Físico',
        weightKg: parseFloat(weightKg) || 70, heightCm: parseInt(heightCm) || 170,
        verifyToken, verifyExpires, emailVerified: false
      }
    });

    sendVerificationEmail(normalizedEmail, name.trim(), verifyToken).catch(e =>
      console.error('[SMTP] Error sending verification:', e.message)
    );

    console.log(`[COACH] ${req.user.email} created client ${client.email}`);
    res.status(201).json({
      id: client.id, email: client.email, name: client.name, role: client.role,
      coachId: client.coachId, goal: client.goal, weightKg: client.weightKg, heightCm: client.heightCm
    });
  } catch (e) { console.error('[COACH] Create client error:', e.message); res.status(500).json({ error: 'Error del servidor' }); }
});

app.get('/api/v1/coach/client-quota', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'COACH' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo coaches' });
    }
    const coach = await prisma.user.findUnique({ where: { id: req.user.id } });
    const currentClients = await prisma.user.count({ where: { coachId: req.user.id, role: 'CLIENT' } });
    res.json({ current: currentClients, max: coach.maxClients, remaining: Math.max(0, coach.maxClients - currentClients) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error del servidor' }); }
});

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
app.get('/api/v1/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, avatar: true, goal: true, weightKg: true, heightCm: true, emailVerified: true, createdAt: true }
    });
    res.json(user);
  } catch (e) { res.status(500).json({ error: 'Error del servidor' }); }
});

app.put('/api/v1/user/profile', authMiddleware, async (req, res) => {
  try {
    const { name, goal, weightKg, heightCm } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (goal !== undefined) data.goal = goal;
    if (weightKg !== undefined) data.weightKg = parseFloat(weightKg) || 70;
    if (heightCm !== undefined) data.heightCm = parseInt(heightCm) || 170;

    const updated = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, avatar: updated.avatar, goal: updated.goal, weightKg: updated.weightKg, heightCm: updated.heightCm, emailVerified: updated.emailVerified });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error del servidor' }); }
});

app.post('/api/v1/user/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await prisma.user.update({ where: { id: req.user.id }, data: { avatar: avatarUrl } });
    // Update localStorage user in response
    res.json({ avatar: avatarUrl });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error del servidor' }); }
});

// ─── COACH: ATHLETE DETAIL ────────────────────────────────────────────────────
app.get('/api/v1/coach/athletes/:id', authMiddleware, async (req, res) => {
  try {
    const { role, id: coachId } = req.user;
    if (role !== 'COACH' && role !== 'ADMIN') return res.status(403).json({ error: 'Solo coaches' });

    const athleteId = req.params.id;
    const where = role === 'ADMIN' ? { id: athleteId, role: 'CLIENT' } : { id: athleteId, coachId, role: 'CLIENT' };
    const athlete = await prisma.user.findFirst({
      where,
      select: { id: true, email: true, name: true, avatar: true, goal: true, weightKg: true, heightCm: true, emailVerified: true, createdAt: true }
    });
    if (!athlete) return res.status(404).json({ error: 'Atleta no encontrado' });

    // Workout sessions (last 30)
    const workouts = await prisma.workoutLog.findMany({
      where: { athleteId },
      orderBy: { date: 'desc' },
      take: 30,
      select: { id: true, date: true, dayName: true, durationSeconds: true, caloriesBurned: true,
        setLogs: { select: { exerciseName: true, weightKg: true, reps: true, setNumber: true }, orderBy: { setNumber: 'asc' } }
      }
    });

    // Set logs with weight progression (last 500)
    const recentSets = await prisma.setLog.findMany({
      where: { athleteId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { exerciseId: true, exerciseName: true, weightKg: true, reps: true, setNumber: true, createdAt: true }
    });

    // Group by exercise for weight progression
    const exerciseProgress = {};
    for (const s of recentSets) {
      const key = s.exerciseName || s.exerciseId;
      if (!exerciseProgress[key]) exerciseProgress[key] = [];
      exerciseProgress[key].push({ weight: s.weightKg, reps: s.reps, date: s.createdAt });
    }

    // Stats
    const totalWorkouts = await prisma.workoutLog.count({ where: { athleteId } });
    const totalSets = await prisma.setLog.count({ where: { athleteId } });
    const maxWeight = await prisma.setLog.aggregate({ where: { athleteId }, _max: { weightKg: true } });

    // Workout frequency (last 4 weeks)
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const recentWorkouts = await prisma.workoutLog.findMany({
      where: { athleteId, date: { gte: fourWeeksAgo } },
      select: { date: true }
    });
    const weeklyFrequency = {};
    for (const w of recentWorkouts) {
      const week = `Sem ${Math.ceil((Date.now() - new Date(w.date).getTime()) / (7*24*60*60*1000))}`;
      weeklyFrequency[week] = (weeklyFrequency[week] || 0) + 1;
    }

    res.json({
      athlete,
      stats: { totalWorkouts, totalSets, maxWeight: maxWeight._max?.weightKg || 0 },
      workouts: workouts.map(w => ({
        id: w.id, date: w.date, dayName: w.dayName, durationSeconds: w.durationSeconds,
        caloriesBurned: w.caloriesBurned, totalSets: w.setLogs.length,
        exercises: [...new Set(w.setLogs.map(s => s.exerciseName).filter(Boolean))]
      })),
      exerciseProgress,
      weeklyFrequency
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error del servidor' }); }
});

// ─── COACH: INVITE ATHLETE (email only) ─────────────────────────────────────
app.post('/api/v1/coach/invite', authMiddleware, async (req, res) => {
  try {
    const { role, id: coachId } = req.user;
    if (role !== 'COACH' && role !== 'ADMIN') return res.status(403).json({ error: 'Solo coaches' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });
    const normalizedEmail = email.trim().toLowerCase();

    // Check quota
    if (role === 'COACH') {
      const coach = await prisma.user.findUnique({ where: { id: coachId } });
      const currentClients = await prisma.user.count({ where: { coachId, role: 'CLIENT' } });
      if (coach.maxClients > 0 && currentClients >= coach.maxClients) {
        return res.status(403).json({ error: `Límite alcanzado: ${currentClients}/${coach.maxClients} clientes` });
      }
    }

    // Check if already exists
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      if (existing.coachId === coachId) return res.status(409).json({ error: 'Este atleta ya está en tu lista' });
      return res.status(409).json({ error: 'Este email ya tiene cuenta' });
    }

    // Create pending user (no password, no name)
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail, name: '', role: 'CLIENT',
        coachId, inviteToken, inviteExpires, emailVerified: false
      }
    });

    // Send invite email
    const coachUser = await prisma.user.findUnique({ where: { id: coachId } });
    const inviteUrl = `${SERVER_URL}/invite/${inviteToken}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="color:#007AFF;font-size:28px;margin:0">GymAura</h1>
          <p style="color:#6b7280;font-size:14px;margin-top:4px">Invitación de entrenamiento</p>
        </div>
        <p style="color:#1f2937;font-size:16px">¡Hola!</p>
        <p style="color:#4b5563;font-size:14px;line-height:1.6">
          Tu coach <strong>${coachUser?.name || 'tu entrenador'}</strong> te ha invitado a unirte a GymAura para gestionar tu entrenamiento.
        </p>
        <p style="color:#4b5563;font-size:14px;line-height:1.6">
          Completa tu registro haciendo clic en el botón:
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="${inviteUrl}" style="background:#007AFF;color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
            Completar mi registro
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center">
          El enlace expira en 7 días.<br>
          Si no esperabas esta invitación, ignora este mensaje.
        </p>
      </div>`;

    const transport = await getSmtpTransport();
    if (transport) {
      const cfg = await getSmtpConfig();
      await transport.sendMail({ from: cfg.from, to: normalizedEmail, subject: `${coachUser?.name || 'Tu coach'} te invita a GymAura`, html });
      console.log(`[INVITE] Email sent to ${normalizedEmail} by ${req.user.email}`);
    } else {
      console.log(`[INVITE] SMTP not configured. Invite link for ${normalizedEmail}: ${inviteUrl}`);
    }

    res.status(201).json({ ok: true, email: normalizedEmail, inviteUrl: transport ? undefined : inviteUrl });
  } catch (e) { console.error('[INVITE] Error:', e.message); res.status(500).json({ error: 'Error del servidor' }); }
});

// Public: Complete invite registration (athlete fills profile)
app.post('/api/v1/auth/complete-invite', async (req, res) => {
  try {
    const { token, name, password, goal, weightKg, heightCm } = req.body;
    if (!token || !name || !password) return res.status(400).json({ error: 'Token, nombre y contraseña requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const user = await prisma.user.findFirst({
      where: { inviteToken: token, inviteExpires: { gt: new Date() } }
    });
    if (!user) return res.status(400).json({ error: 'Invitación inválida o expirada' });
    if (user.passwordHash) return res.status(400).json({ error: 'Esta invitación ya fue utilizada' });

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim(), passwordHash,
        goal: goal || 'Acondicionamiento Físico',
        weightKg: parseFloat(weightKg) || 70,
        heightCm: parseInt(heightCm) || 170,
        emailVerified: true,
        inviteToken: null, inviteExpires: null
      }
    });

    const jwtToken = jwt.sign({ id: updated.id, email: updated.email, role: updated.role, name: updated.name }, JWT_SECRET, { expiresIn: '7d' });
    console.log(`[INVITE] Completed: ${updated.email} (coach: ${updated.coachId})`);

    // Notify coach that athlete completed registration
    if (updated.coachId) {
      const coach = await prisma.user.findUnique({ where: { id: updated.coachId } });
      if (coach) {
        const transport = await getSmtpTransport();
        if (transport) {
          const cfg = await getSmtpConfig();
          transport.sendMail({
            from: cfg.from, to: coach.email,
            subject: `🎉 ${updated.name} completó su registro en GymAura`,
            html: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px">
                <div style="text-align:center;margin-bottom:24px">
                  <h1 style="color:#007AFF;font-size:28px;margin:0">GymAura</h1>
                </div>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center">
                  <p style="font-size:24px;margin:0 0 8px">🎉</p>
                  <p style="color:#166534;font-weight:600;font-size:16px;margin:0">¡Nuevo atleta registrado!</p>
                  <p style="color:#4b5563;font-size:14px;margin-top:12px">
                    <strong>${updated.name}</strong> (${updated.email}) completó su registro.<br>
                    Ya puedes asignarle rutinas desde tu panel.
                  </p>
                </div>
              </div>`
          }).catch(e => console.error('[INVITE] Coach notification error:', e.message));
        }
      }
    }

    res.json({ token: jwtToken, user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, emailVerified: true } });
  } catch (e) { console.error('[INVITE] Complete error:', e.message); res.status(500).json({ error: 'Error del servidor' }); }
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
    const where = req.user.role === 'ADMIN'
      ? { role: 'CLIENT' }
      : { role: 'CLIENT', coachId: req.user.id };
    const clients = await prisma.user.findMany({
      where,
      select: {
        id: true, email: true, name: true, avatar: true, goal: true,
        weightKg: true, heightCm: true, emailVerified: true, createdAt: true,
        workoutLogs: { select: { date: true }, orderBy: { date: 'desc' }, take: 1 }
      }
    });
    res.json(clients.map(c => ({
      id: c.id, name: c.name || '(Pendiente)', email: c.email, avatar: c.avatar,
      goal: c.goal, weightKg: c.weightKg, heightCm: c.heightCm,
      emailVerified: c.emailVerified,
      pending: !c.name,
      lastWorkout: c.workoutLogs[0]?.date || null,
      createdAt: c.createdAt
    })));
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
        id:             e.id,
        name:           e.name,
        category:       e.category,
        targetMuscle:   e.muscleGroup,
        muscleGroup:    e.muscleGroup,
        equipment:      e.equipment,
        instructions:   e.instructionsEs || e.instructions,  // prefer Spanish
        defaultSets:    e.defaultSets,
        defaultReps:    e.defaultReps,
        mediaUrl:       e.mediaUrl,
        imageUrls:      buildImageUrls(e),
        icon:           'dumbbell',
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
            ex.muscleGroup = exData.muscleGroup || '';
            ex.instructions = exData.instructionsEs || exData.instructions || '';
          }
        }
      }
    }
    res.json({ id: routine.id, title: routine.title, description: routine.description, schedule });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── ROUTINE META — lightweight version check (avoids full download if unchanged) ──
// Returns only id + updatedAt timestamp. Client compares with cached version.
// GET /api/v1/routines/current-week/meta
app.get('/api/v1/routines/current-week/meta', authMiddleware, async (req, res) => {
  try {
    const athleteId = req.user.id;
    const routine = await prisma.routinePlan.findFirst({
      where: { athleteId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true }
    });
    if (!routine) return res.json({ id: null, updatedAt: null, title: null });
    res.json({
      id: routine.id,
      updatedAt: routine.updatedAt.getTime(), // milliseconds for easy comparison
      title: routine.title
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── SYNC WARMUP SESSIONS ────────────────────────────────────────────────────
// POST /api/v1/workouts/sync-warmup
// Persists warmup sessions from the app to the server DB for cross-device history.
app.post('/api/v1/workouts/sync-warmup', authMiddleware, async (req, res) => {
  try {
    const athleteId = req.user.id;
    const sessions = Array.isArray(req.body) ? req.body : [req.body];

    const upserted = [];
    for (const s of sessions) {
      if (!s.id) continue;
      // Use raw upsert since WarmupSession may not be in Prisma schema yet
      // Store in a generic format inside SetLog as a special record type
      try {
        await prisma.setLog.upsert({
          where: { id: `warmup_${s.id}` },
          create: {
            id: `warmup_${s.id}`,
            athleteId,
            exerciseId: 'warmup',
            exerciseName: 'Calentamiento',
            setNumber: 1,
            weightKg: 0,
            reps: s.durationSec || 0,  // store duration in reps field
            notes: `Calentamiento ${Math.floor((s.durationSec||0)/60)} min${s.notes ? ' - ' + s.notes : ''}`,
            createdAt: new Date(s.startedAt || Date.now()),
            workoutLogId: `warmup_${s.id}`,
            dayName: 'Calentamiento',
          },
          update: {}  // don't overwrite if already synced
        });
        upserted.push(s.id);
      } catch (_) { /* skip individual failures */ }
    }

    res.json({ synced: upserted.length, ids: upserted });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── WORKOUT LOGS (LEGACY) ─────────────────────────────────────────────────────
app.get('/api/logs/:clientId', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { role, id: requesterId } = req.user;

    // SECURITY: Enforce ownership — CLIENT can only read own logs
    if (role === 'CLIENT' && requesterId !== clientId) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    // COACH can only read logs of their assigned clients
    if (role === 'COACH') {
      const client = await prisma.user.findFirst({ where: { id: clientId, coachId: requesterId } });
      if (!client) return res.status(403).json({ error: 'Este cliente no está asignado a ti' });
    }

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
    const today = new Date(); today.setHours(0,0,0,0);
    let wLog = await prisma.workoutLog.findFirst({ where: { athleteId, date: { gte: today } } });
    if (!wLog) wLog = await prisma.workoutLog.create({ data: { athleteId } });
    const setLog = await prisma.setLog.create({
      data: {
        clientLogId: req.body.clientLogId || `cli_${Date.now()}_${Math.random()}`,
        workoutLogId: wLog.id,
        athleteId,
        exerciseId: req.body.exerciseId,
        exerciseName: req.body.exerciseName || req.body.notes || '',
        weightKg: parseFloat(req.body.weightKg) || 0,
        reps: parseInt(req.body.repsCompleted) || 0,
        setNumber: parseInt(req.body.setNumber) || 1,
        restSeconds: parseInt(req.body.restSeconds) || null,
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
    const { sets } = req.body;
    if (!Array.isArray(sets) || sets.length === 0) return res.json({ synced: 0, failed: 0 });
    let synced = 0, failed = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    let wLog = await prisma.workoutLog.findFirst({ where: { athleteId, date: { gte: today } } });
    if (!wLog) wLog = await prisma.workoutLog.create({ data: { athleteId } });
    for (const s of sets) {
      try {
        await prisma.setLog.upsert({
          where: { clientLogId: s.clientLogId },
          update: {
            weightKg: s.weightKg, reps: s.reps, rpe: s.rpe,
            restSeconds: s.restSeconds ?? null,
            notes: s.notes || ''
          },
          create: {
            clientLogId: s.clientLogId,
            workoutLogId: wLog.id,
            athleteId,
            exerciseId: s.exerciseId,
            exerciseName: s.exerciseName || s.notes || '',
            weightKg: s.weightKg ?? 0,
            reps: s.reps ?? 0,
            rpe: s.rpe ?? 0,
            setNumber: s.setNumber || 1,
            sessionId: s.sessionId || null,
            restSeconds: s.restSeconds ?? null,
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
    // Limit to last 500 sets (performance + memory protection)
    const logs = await prisma.setLog.findMany({
      where: { athleteId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { exercise: { select: { name: true, muscleGroup: true } } }
    });
    res.json(logs.map(l => ({
      id: l.id,
      clientLogId: l.clientLogId,
      exerciseId: l.exerciseId,
      exerciseName: l.exerciseName || l.exercise?.name || '',
      workoutLogId: l.workoutLogId,
      weightKg: l.weightKg,
      reps: l.reps,
      rpe: l.rpe,
      setNumber: l.setNumber,
      notes: l.notes,
      createdAt: l.createdAt.toISOString()
    })));
  } catch (e) { console.error('[HISTORY] Error:', e.message); res.status(500).json({ error: 'Error del servidor' }); }
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
// Same security as /api/v1/auth/login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const dummyHash = '$2a$12$invalidpasswordhashfortimingprotec.tionpurposesonlyx';
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : await bcrypt.compare(password, dummyHash);
    if (!user || !valid) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    console.log(`[AUTH] Login (legacy): ${user.email} (${user.role}) from ${req.ip}`);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, coachId: user.coachId } });
  } catch (e) { console.error('[AUTH] Legacy login error:', e.message); res.status(500).json({ error: 'Error del servidor' }); }
});

// Register: ALWAYS creates CLIENT — role is never accepted from request body
app.post('/api/v1/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name, coachId } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, contraseña y nombre requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ error: 'Email ya registrado' });
    const passwordHash = await bcrypt.hash(password, 12);
    // SECURITY: role is hardcoded to CLIENT — never from body
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, name: name.trim(), role: 'CLIENT', coachId: coachId || null }
    });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) { console.error('[AUTH] Register error:', e.message); res.status(500).json({ error: 'Error del servidor' }); }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name, coachId } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, contraseña y nombre requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ error: 'Email ya registrado' });
    const passwordHash = await bcrypt.hash(password, 12);
    // SECURITY: role hardcoded to CLIENT
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, name: name.trim(), role: 'CLIENT', coachId: coachId || null }
    });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) { console.error('[AUTH] Register error:', e.message); res.status(500).json({ error: 'Error del servidor' }); }
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
    const athleteId = req.params.athleteId;
    const { role, id: requesterId } = req.user;
    // SECURITY: enforce ownership
    if (role === 'CLIENT' && requesterId !== athleteId) return res.status(403).json({ error: 'Acceso denegado' });
    if (role === 'COACH') {
      const client = await prisma.user.findFirst({ where: { id: athleteId, coachId: requesterId } });
      if (!client) return res.status(403).json({ error: 'Este cliente no está asignado a ti' });
    }
    const routine = await prisma.routinePlan.findFirst({
      where: { athleteId },
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
    const { role, id: requesterId } = req.user;
    // SECURITY: only ADMIN or the assigned COACH can modify a client's routine
    if (role === 'CLIENT') return res.status(403).json({ error: 'Sin permiso para modificar rutinas' });
    if (role === 'COACH') {
      const client = await prisma.user.findFirst({ where: { id: athleteId, coachId: requesterId } });
      if (!client) return res.status(403).json({ error: 'Este cliente no está asignado a ti' });
    }
    const existing = await prisma.routinePlan.findFirst({ where: { athleteId } });
    let routine;
    if (existing) {
      routine = await prisma.routinePlan.update({
        where: { id: existing.id },
        data: { title, description, schedule, coachId: requesterId }
      });
    } else {
      routine = await prisma.routinePlan.create({
        data: { coachId: requesterId, athleteId, title, description, schedule }
      });
    }
    res.json(routine);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── ADMIN ENDPOINTS ────────────────────────────────────────────────────────
app.get('/api/admin/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [totalUsers, totalCoaches, totalClients, totalExercises, unassigned, unverified, coaches] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'COACH' } }),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.exercise.count(),
      prisma.user.count({ where: { role: 'CLIENT', coachId: null } }),
      prisma.user.count({ where: { emailVerified: false } }),
      prisma.user.findMany({
        where: { role: 'COACH' },
        select: { id: true, name: true, email: true, maxClients: true, _count: { select: { clients: true } } }
      }),
    ]);
    const coachQuotas = coaches.map(c => ({
      id: c.id, name: c.name, email: c.email,
      current: c._count.clients, max: c.maxClients
    }));
    res.json({ totalUsers, totalCoaches, totalClients, totalExercises, unassigned, unverified, coachQuotas });
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
      select: {
        id: true, email: true, name: true, role: true, avatar: true, goal: true,
        weightKg: true, heightCm: true, coachId: true, createdAt: true,
        maxClients: true, emailVerified: true,
        coach: { select: { id: true, name: true, email: true } },
        _count: { select: { clients: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users.map(u => ({ ...u, clientCount: u._count?.clients || 0, _count: undefined })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/users', authMiddleware, adminOnly, adminLimiter, async (req, res) => {
  try {
    const { email, password, name, role = 'CLIENT', coachId, goal, weightKg, heightCm, maxClients } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, contraseña y nombre requeridos' });

    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const validRoles = ['CLIENT', 'COACH', 'ADMIN'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Rol inválido' });

    if (roleLevel(role) > roleLevel(req.user.role)) {
      return res.status(403).json({ error: 'No puedes asignar un rol superior al tuyo' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail, passwordHash, name: name.trim(), role,
        coachId: coachId || null,
        goal: goal || 'Acondicionamiento Físico',
        weightKg: weightKg || 70, heightCm: heightCm || 170,
        maxClients: (role === 'COACH' && maxClients != null) ? parseInt(maxClients) : 10,
        emailVerified: false, verifyToken, verifyExpires
      }
    });
    // Send verification email
    sendVerificationEmail(normalizedEmail, name.trim(), verifyToken).catch(e =>
      console.error('[SMTP] Error sending verification:', e.message)
    );
    console.log(`[ADMIN] User created: ${user.email} (${user.role}) by ${req.user.email}`);
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role, maxClients: user.maxClients });
  } catch (e) {
    console.error('[ADMIN] Create user error:', e.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.put('/api/admin/users/:id', authMiddleware, adminOnly, adminLimiter, async (req, res) => {
  try {
    const { name, email, role, goal, weightKg, heightCm, password, maxClients, emailVerified } = req.body;
    const targetId = req.params.id;

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Security checks
    if (role && targetId === req.user.id && role !== target.role) {
      return res.status(403).json({ error: 'No puedes cambiar tu propio rol' });
    }
    if (role && roleLevel(role) > roleLevel(req.user.role)) {
      return res.status(403).json({ error: 'No puedes asignar un rol superior al tuyo' });
    }
    if (role && target.role === 'ADMIN' && role !== 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return res.status(403).json({ error: 'No puedes degradar al único administrador del sistema' });
      }
    }
    if (password && password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const data = {};
    if (name) data.name = name.trim();
    if (email) data.email = email.trim().toLowerCase();
    if (role) data.role = role;
    if (goal) data.goal = goal;
    if (weightKg !== undefined) data.weightKg = parseFloat(weightKg);
    if (heightCm !== undefined) data.heightCm = parseInt(heightCm);
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    if (maxClients !== undefined) data.maxClients = parseInt(maxClients);
    if (emailVerified !== undefined) data.emailVerified = Boolean(emailVerified);

    const user = await prisma.user.update({ where: { id: targetId }, data });

    const changes = Object.keys(data).filter(k => k !== 'passwordHash').join(', ');
    if (role && role !== target.role) {
      console.warn(`[AUDIT] Role change: ${target.email} ${target.role} → ${role} by ${req.user.email} from ${req.ip}`);
    }
    console.log(`[ADMIN] User updated: ${user.email} (fields: ${changes || 'password'}) by ${req.user.email}`);

    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, maxClients: user.maxClients, emailVerified: user.emailVerified });
  } catch (e) {
    console.error('[ADMIN] Update user error:', e.message);
    if (e.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    if (e.code === 'P2002') return res.status(409).json({ error: 'El email ya está en uso' });
    res.status(500).json({ error: 'Error del servidor' });
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

// ─── ADMIN SETTINGS ──────────────────────────────────────────────────────────
app.get('/api/admin/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany({ orderBy: { category: 'asc' } });
    // Group by category
    const grouped = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = {};
      // Mask passwords — never send full password to frontend
      if (s.key.includes('pass') || s.key.includes('secret') || s.key.includes('api_key')) {
        grouped[s.category][s.key] = s.value ? '••••••••' : '';
      } else {
        grouped[s.category][s.key] = s.value;
      }
    }
    res.json(grouped);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error cargando configuración' }); }
});

app.put('/api/admin/settings', authMiddleware, adminOnly, adminLimiter, async (req, res) => {
  try {
    const { settings } = req.body; // Array of {key, value, category}
    if (!Array.isArray(settings)) return res.status(400).json({ error: 'settings array required' });

    for (const { key, value, category } of settings) {
      if (!key || typeof value !== 'string') continue;
      // Skip masked values (user didn't change the password)
      if (value === '••••••••') continue;
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value, category: category || 'general' },
        update: { value },
      });
    }

    console.log(`[ADMIN] Settings updated by ${req.user.email}: ${settings.map(s => s.key).join(', ')}`);
    res.json({ ok: true, message: 'Configuración guardada' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error guardando configuración' }); }
});

// Test SMTP connection
app.post('/api/admin/settings/test-smtp', authMiddleware, adminOnly, async (req, res) => {
  try {
    const transport = await getSmtpTransport();
    if (!transport) return res.status(400).json({ ok: false, error: 'SMTP no configurado. Guarda la configuración primero.' });
    await transport.verify();
    res.json({ ok: true, message: 'Conexión SMTP exitosa ✅' });
  } catch (e) {
    console.error('[SMTP] Test failed:', e.message);
    res.json({ ok: false, error: `Error de conexión: ${e.message}` });
  }
});

// Send a real test email
app.post('/api/admin/settings/test-smtp-email', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ ok: false, error: 'Email destinatario requerido' });

    const transport = await getSmtpTransport();
    if (!transport) return res.status(400).json({ ok: false, error: 'SMTP no configurado. Guarda la configuración primero.' });

    const cfg = await getSmtpConfig();
    await transport.sendMail({
      from: cfg.from,
      to,
      subject: '✅ GymAura — Correo de prueba',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="color:#007AFF;font-size:28px;margin:0">GymAura</h1>
          </div>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px;text-align:center">
            <p style="font-size:24px;margin:0 0 8px">✅</p>
            <p style="color:#0369a1;font-weight:600;font-size:16px;margin:0">¡Correo de prueba exitoso!</p>
            <p style="color:#64748b;font-size:13px;margin-top:8px">
              Tu configuración SMTP funciona correctamente.<br>
              Enviado desde el panel de administración de GymAura.
            </p>
          </div>
          <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:20px">
            ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
          </p>
        </div>`
    });

    console.log(`[SMTP] Test email sent to ${to} by ${req.user.email}`);
    res.json({ ok: true, message: `Correo enviado a ${to} ✅` });
  } catch (e) {
    console.error('[SMTP] Test email failed:', e.message);
    res.json({ ok: false, error: `Error enviando: ${e.message}` });
  }
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
      const ytArgs = [
        '--no-playlist',
        '--max-filesize', '100m',
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '-o', outputPath,
        '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Referer:https://www.tiktok.com/',
        '--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com',
        videoUrl
      ];
      const ytdlp = execFile('yt-dlp', ytArgs, { timeout: 120000 }, async (err) => {
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

// ─── TEST ENDPOINT (dev only) ────────────────────────────────────────────────
// GET /api/v1/admin/test-ytdlp
// Protected by authMiddleware + adminOnly in production; open in non-production.
app.get('/api/v1/admin/test-ytdlp', authMiddleware, adminOnly, async (req, res) => {
  const testUrl = 'https://www.tiktok.com/@the_cat_black_rebel/video/7643329342075849991?is_from_webapp=1&sender_device=pc';
  const tmpOut = '/tmp/test_video.mp4';
  const ytArgs = [
    '--no-playlist',
    '--max-filesize', '100m',
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '-o', tmpOut,
    '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '--add-header', 'Referer:https://www.tiktok.com/',
    '--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com',
    testUrl
  ];
  execFile('yt-dlp', ytArgs, { timeout: 120000 }, (err, stdout, stderr) => {
    const fileExists = fs.existsSync(tmpOut);
    res.json({
      success: !err && fileExists,
      fileExists,
      stdout: stdout || '',
      stderr: stderr || '',
      error: err ? err.message : null
    });
  });
});

// ─── BULK MEDIA DOWNLOAD ─────────────────────────────────────────────────────
// POST /api/v1/admin/download-missing-media
// Downloads GIFs/videos for exercises that have no local mediaUrl yet.
// Exercises from hasaneyldrm dataset have raw GitHub GIF URLs — we keep those as-is
// (Coil loads them directly). Only exercises with TikTok/YouTube videoUrls need yt-dlp.
app.post('/api/v1/admin/download-missing-media', authMiddleware, adminOnly, async (req, res) => {
  try {
    const limit = parseInt(req.body?.limit) || 50;
    const serverBase = process.env.SERVER_URL || 'https://gym-app.tecti-cloud.com';

    // Find exercises with videoUrl but no local mediaUrl
    const pending = await prisma.exercise.findMany({
      where: {
        videoUrl: { not: null },
        OR: [
          { mediaUrl: null },
          { mediaUrl: { startsWith: 'http', not: { startsWith: serverBase } } }
        ]
      },
      take: limit,
      orderBy: { createdAt: 'asc' }
    });

    res.json({ message: `Starting download for ${pending.length} exercises`, ids: pending.map(e => e.id) });

    // Background downloads
    for (const ex of pending) {
      const outputPath = path.join(UPLOADS_DIR, `${ex.id}.mp4`);
      if (fs.existsSync(outputPath)) {
        // Already downloaded, just update DB
        const hostedUrl = `${serverBase}/uploads/exercises/${ex.id}.mp4`;
        await prisma.exercise.update({ where: { id: ex.id }, data: { mediaUrl: hostedUrl } }).catch(() => {});
        continue;
      }
      const ytArgs = [
        '--no-playlist', '--max-filesize', '100m',
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '-o', outputPath,
        '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Referer:https://www.tiktok.com/',
        '--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com',
        ex.videoUrl
      ];
      execFile('yt-dlp', ytArgs, { timeout: 180000 }, async (err) => {
        if (!err && fs.existsSync(outputPath)) {
          const hostedUrl = `${serverBase}/uploads/exercises/${ex.id}.mp4`;
          await prisma.exercise.update({ where: { id: ex.id }, data: { mediaUrl: hostedUrl } }).catch(() => {});
          console.log(`✅ Media downloaded: ${ex.name} (${ex.id})`);
        } else {
          console.log(`⚠️ Download failed for ${ex.name}: ${err?.message}`);
        }
      });
      // Small delay between downloads to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/v1/admin/media-status — check how many exercises have/lack mediaUrl
app.get('/api/v1/admin/media-status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const total = await prisma.exercise.count();
    const withMedia = await prisma.exercise.count({ where: { mediaUrl: { not: null } } });
    const withVideoUrl = await prisma.exercise.count({ where: { videoUrl: { not: null } } });
    const pending = await prisma.exercise.count({
      where: { videoUrl: { not: null }, mediaUrl: null }
    });
    res.json({ total, withMedia, withVideoUrl, pendingDownload: pending });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TRANSLATE INSTRUCTIONS TO SPANISH ──────────────────────────────────────
// POST /api/v1/admin/translate-instructions
// Uses unofficial Google Translate API (no key, no quota limit)
app.post('/api/v1/admin/translate-instructions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const limit = parseInt(req.body?.limit) || 30;
    const force = req.body?.force === true;

    // Find exercises without Spanish instructions
    const exercises = await prisma.exercise.findMany({
      where: force ? {} : { instructionsEs: null, instructions: { not: '' } },
      take: limit,
      select: { id: true, name: true, instructions: true }
    });

    res.json({ message: `Starting translation for ${exercises.length} exercises`, count: exercises.length });

    // Unofficial Google Translate — no quota, no API key
    const translate = async (text) => {
      if (!text || text.trim().length < 5) return null;
      try {
        const chunk = text.substring(0, 800); // Google handles up to ~5000 chars
        const encoded = encodeURIComponent(chunk);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encoded}`;
        const resp = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GymAura/1.0)' }
        });
        if (!resp.ok) {
          console.log(`⚠️ Google Translate HTTP ${resp.status}`);
          return null;
        }
        const data = await resp.json();
        // Response structure: [[["translated","original",null,null,10],...],...]
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translatedText = data[0].map(part => part[0]).filter(Boolean).join('');
          return translatedText || null;
        }
        return null;
      } catch (e) {
        console.log(`⚠️ Translate error: ${e.message}`);
        return null;
      }
    };

    let translated = 0, failed = 0;
    for (const ex of exercises) {
      const es = await translate(ex.instructions);
      if (es) {
        await prisma.exercise.update({ where: { id: ex.id }, data: { instructionsEs: es } }).catch(() => {});
        translated++;
        if (translated % 10 === 0) console.log(`🌎 Translated ${translated}/${exercises.length}: ${ex.name}`);
      } else {
        failed++;
        console.log(`⚠️ Failed: ${ex.name}`);
      }
      // Small delay to avoid triggering rate limits
      await new Promise(r => setTimeout(r, 500));
    }
    console.log(`✅ Translation batch done: ${translated} OK, ${failed} failed`);
  } catch (e) { console.error('Translation error:', e); }
});

// GET /api/v1/admin/translate-status
app.get('/api/v1/admin/translate-status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const total = await prisma.exercise.count({ where: { instructions: { not: '' } } });
    const translated = await prisma.exercise.count({ where: { instructionsEs: { not: null } } });
    const pending = total - translated;
    res.json({ total, translated, pending, percentDone: total > 0 ? Math.round(translated * 100 / total) : 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX MISSING MEDIA ──────────────────────────────────────────────────────
// GET  /api/v1/admin/missing-exercises  — list exercises without valid media
// POST /api/v1/admin/fix-missing-media  — assign correct GIF URLs (Spanish→English mapping)
app.get('/api/v1/admin/missing-exercises', authMiddleware, adminOnly, async (req, res) => {
  try {
    const missing = await prisma.exercise.findMany({
      where: { mediaUrl: null },
      select: { id: true, name: true, category: true, targetMuscle: true }
    });
    res.json({ count: missing.length, exercises: missing });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/v1/admin/fix-missing-media', authMiddleware, adminOnly, async (req, res) => {
  try {
    const force = req.body?.force === true; // force=true re-assigns already-assigned ones too

    // Spanish exercise name → hasaneyldrm English path {category}/{filename}
    // Pattern: https://raw.githubusercontent.com/hasaneyldrm/exercise-db/main/{cat}/{name}.gif
    const BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercise-db/main';
    const SPANISH_MAP = {
      'press de banca con barra':       `${BASE}/chest/Barbell Bench Press.gif`,
      'sentadilla con barra':           `${BASE}/upper legs/Barbell Squat.gif`,
      'press militar':                  `${BASE}/shoulders/Barbell Shoulder Press.gif`,
      'peso muerto':                    `${BASE}/back/Deadlift.gif`,
      'dominadas':                      `${BASE}/back/Pull Up.gif`,
      'remo con barra':                 `${BASE}/back/Barbell Bent Over Row.gif`,
      'remo en polea':                  `${BASE}/back/Cable Seated Row.gif`,
      'curl de bíceps con barra':       `${BASE}/upper arms/Barbell Curl.gif`,
      'curl de biceps con barra':       `${BASE}/upper arms/Barbell Curl.gif`,
      'extensión de tríceps en polea':  `${BASE}/upper arms/Cable Pushdown.gif`,
      'extension de triceps en polea':  `${BASE}/upper arms/Cable Pushdown.gif`,
      'fondos en paralelas':            `${BASE}/upper arms/Dip.gif`,
      'apertura con mancuernas':        `${BASE}/chest/Dumbbell Fly.gif`,
      'jalón al pecho':                 `${BASE}/back/Cable Lat Pulldown.gif`,
      'jalon al pecho':                 `${BASE}/back/Cable Lat Pulldown.gif`,
      'leg press':                      `${BASE}/upper legs/Leg Press.gif`,
      'curl femoral':                   `${BASE}/upper legs/Lying Leg Curl.gif`,
      'elevación de talones de pie':    `${BASE}/lower legs/Standing Calf Raise.gif`,
      'elevacion de talones de pie':    `${BASE}/lower legs/Standing Calf Raise.gif`,
      'press de hombro con mancuernas': `${BASE}/shoulders/Dumbbell Shoulder Press.gif`,
      'elevación frontal':              `${BASE}/shoulders/Dumbbell Front Raise.gif`,
      'elevacion frontal':              `${BASE}/shoulders/Dumbbell Front Raise.gif`,
      'pájaro con mancuernas':          `${BASE}/shoulders/Dumbbell Rear Delt Row.gif`,
      'pajaro con mancuernas':          `${BASE}/shoulders/Dumbbell Rear Delt Row.gif`,
      'abdominal en suelo':             `${BASE}/waist/Crunch.gif`,
      'plancha frontal':                `${BASE}/waist/Plank.gif`,
      'curl de bíceps con mancuerna':   `${BASE}/upper arms/Dumbbell Curl.gif`,
      'curl de biceps con mancuerna':   `${BASE}/upper arms/Dumbbell Curl.gif`,
      'martillo':                       `${BASE}/upper arms/Dumbbell Hammer Curl.gif`,
      'prensa de hombros en máquina':   `${BASE}/shoulders/Machine Shoulder Press.gif`,
      'prensa de hombros en maquina':   `${BASE}/shoulders/Machine Shoulder Press.gif`,
      'peso muerto rumano':             `${BASE}/upper legs/Romanian Deadlift.gif`,
      'caminata en cinta':              `${BASE}/cardio/Walking on Treadmill.gif`,
      'press inclinado con mancuernas': `${BASE}/chest/Dumbbell Incline Bench Press.gif`,
      'extensión de piernas':           `${BASE}/upper legs/Leg Extension.gif`,
      'extension de piernas':           `${BASE}/upper legs/Leg Extension.gif`,
      'elevación lateral':              `${BASE}/shoulders/Dumbbell Lateral Raise.gif`,
      'elevacion lateral':              `${BASE}/shoulders/Dumbbell Lateral Raise.gif`,
      'hip thrust':                     `${BASE}/upper legs/Barbell Hip Thrust.gif`,
      'press francés':                  `${BASE}/upper arms/Dumbbell Lying Triceps Extension.gif`,
      'press frances':                  `${BASE}/upper arms/Dumbbell Lying Triceps Extension.gif`,
      'abductores':                     `${BASE}/upper legs/Hip Abductor.gif`,
      'aductores':                      `${BASE}/upper legs/Hip Adductor.gif`,
      'aductores ':                     `${BASE}/upper legs/Hip Adductor.gif`,
    };

    // Category fallback GIFs (if no name match)
    const CAT_FALLBACK = {
      'chest':      `${BASE}/chest/Barbell Bench Press.gif`,
      'back':       `${BASE}/back/Deadlift.gif`,
      'shoulders':  `${BASE}/shoulders/Dumbbell Shoulder Press.gif`,
      'upper arms': `${BASE}/upper arms/Dumbbell Curl.gif`,
      'lower arms': `${BASE}/lower arms/Barbell Wrist Curl.gif`,
      'upper legs': `${BASE}/upper legs/Barbell Squat.gif`,
      'lower legs': `${BASE}/lower legs/Standing Calf Raise.gif`,
      'waist':      `${BASE}/waist/Crunch.gif`,
      'cardio':     `${BASE}/cardio/Walking on Treadmill.gif`,
      'neck':       `${BASE}/neck/Neck Lateral Flexion.gif`,
    };

    // Find exercises to fix: either no media, or a URL that contains 'hasaneyldrm' with Spanish chars
    const toFix = await prisma.exercise.findMany({
      where: force
        ? {}
        : {
            OR: [
              { mediaUrl: null },
              // Re-assign broken Spanish URLs (those built with Spanish category names)
              { mediaUrl: { contains: '/Pecho/' } },
              { mediaUrl: { contains: '/Piernas/' } },
              { mediaUrl: { contains: '/Espalda/' } },
              { mediaUrl: { contains: '/Hombros/' } },
              { mediaUrl: { contains: '/Abdomen/' } },
              { mediaUrl: { contains: '/Cardio/' } },
              { mediaUrl: { contains: '/General/' } },
              { mediaUrl: { contains: '/Tríceps/' } },
              { mediaUrl: { contains: '/Bíceps/' } },
            ]
          },
      select: { id: true, name: true, category: true }
    });

    if (toFix.length === 0) return res.json({ message: 'All exercises have valid media', fixed: 0 });

    let fixed = 0;
    const results = [];

    for (const ex of toFix) {
      const key = ex.name.toLowerCase().trim();
      const url = SPANISH_MAP[key]
        || CAT_FALLBACK[ex.category?.toLowerCase()]
        || `${BASE}/chest/Barbell Bench Press.gif`; // last resort

      // Encode spaces in URL
      const encodedUrl = url.replace(/ /g, '%20');

      try {
        await prisma.exercise.update({ where: { id: ex.id }, data: { mediaUrl: encodedUrl } });
        fixed++;
        results.push({ name: ex.name, url: encodedUrl });
      } catch (err) {
        results.push({ name: ex.name, error: err.message });
      }
    }

    res.json({ fixed, total: toFix.length, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GymAura Server v2 ejecutándose en http://0.0.0.0:${PORT}`);
});
