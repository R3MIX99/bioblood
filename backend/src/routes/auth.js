const express   = require("express");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const passport  = require("passport");
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: "Demasiados intentos. Espera 15 minutos antes de intentar de nuevo." },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  message: { error: "Demasiados registros desde esta IP. Intenta más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Demasiadas solicitudes de recuperación. Espera 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const {
  findDoctorByEmail,
  findDoctorByGoogleId,
  createDoctor,
  findDoctorById,
  patchDoctor,
} = require("../services/airtable");

const { requireAuth } = require("../middleware/auth");
const resetTokens            = require("../services/resetTokens");
const pendingRegistrations   = require("../services/pendingRegistrations");
const { sendResetCode, sendVerificationCode } = require("../services/mailer");

const router = express.Router();

const COOKIE_NAME = "bb_token";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure:   process.env.NODE_ENV === "production",
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 días
};

function signToken(doctor) {
  return jwt.sign(
    {
      id:           doctor.id,
      email:        doctor.email,
      nombre:       doctor.nombre,
      tokenVersion: doctor.tokenVersion ?? 0,
    },
    process.env.JWT_SECRET || "dev-jwt-secret",
    { expiresIn: "7d" }
  );
}

// ── POST /auth/register ───────────────────────────────────────────────────
// No crea la cuenta inmediatamente — envía un código al correo y espera verificación.
router.post("/register", registerLimiter, async (req, res) => {
  const { email, password, nombre } = req.body;

  if (!email || !password || !nombre) {
    return res.status(400).json({ error: "email, password y nombre son requeridos" });
  }
  const PW_RULES = [(v) => v.length >= 8, (v) => /[A-Z]/.test(v), (v) => /[a-z]/.test(v), (v) => /[0-9]/.test(v)];
  if (!PW_RULES.every((fn) => fn(password))) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número" });
  }

  const existing = await findDoctorByEmail(email.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const code = await pendingRegistrations.set(email.trim().toLowerCase(), { nombre, passwordHash });

  try {
    await sendVerificationCode(email.trim(), code);
  } catch (err) {
    console.error("sendVerificationCode:", err.message);
    return res.status(500).json({ error: "No se pudo enviar el correo de verificación. Verifica la configuración SMTP." });
  }

  res.status(200).json({ pending: true });
});

// ── POST /auth/verify-email ───────────────────────────────────────────────
// Verifica el código y crea la cuenta si es válido.
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Correo y código son requeridos" });
  }

  const result = await pendingRegistrations.verify(email.trim().toLowerCase(), code.trim());
  if (!result.ok) {
    const msg = result.reason === "expired" ? "El código expiró. Regístrate de nuevo."
              : result.reason === "locked"  ? "Demasiados intentos fallidos. Regístrate de nuevo."
              : "Código incorrecto.";
    return res.status(400).json({ error: msg, reason: result.reason });
  }

  const { nombre, passwordHash } = result.data;
  const doctor = await createDoctor({ email: email.trim().toLowerCase(), passwordHash, nombre });
  if (!doctor) {
    return res.status(500).json({ error: "No se pudo crear la cuenta" });
  }

  const token = signToken(doctor);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.status(201).json({ doctor: { id: doctor.id, email: doctor.email, nombre: doctor.nombre } });
});

// ── POST /auth/resend-verification ───────────────────────────────────────
// Reenvía el código de verificación si el registro sigue pendiente.
router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Correo es requerido" });

  const pending = await pendingRegistrations.get(email.trim().toLowerCase());
  if (!pending) {
    return res.status(400).json({ error: "No hay registro pendiente para este correo. Intenta registrarte de nuevo." });
  }

  const code = await pendingRegistrations.set(email.trim().toLowerCase(), {
    nombre:       pending.nombre,
    passwordHash: pending.passwordHash,
  });

  try {
    await sendVerificationCode(email.trim(), code);
  } catch (err) {
    console.error("resend-verification:", err.message);
    return res.status(500).json({ error: "No se pudo reenviar el correo." });
  }

  res.json({ ok: true });
});

// ── POST /auth/login ───────────────────────────────────────────────────────
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email y password son requeridos" });
  }

  const doctor = await findDoctorByEmail(email);
  if (!doctor || !doctor.passwordHash) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const valid = await bcrypt.compare(password, doctor.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const token = signToken(doctor);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ doctor: { id: doctor.id, email: doctor.email, nombre: doctor.nombre } });
});

// ── POST /auth/logout ──────────────────────────────────────────────────────
router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  res.json({ ok: true });
});

// ── GET /auth/me ───────────────────────────────────────────────────────────
router.get("/me", requireAuth, (req, res) => {
  res.json(req.doctor);
});

// ── POST /auth/forgot-password ────────────────────────────────────────────
// Sends a 6-digit code to the user's email if the account exists.
// Always responds 200 to avoid email enumeration.
router.post("/forgot-password", forgotLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "El correo es requerido" });

  const doctor = await findDoctorByEmail(email.trim().toLowerCase());
  if (doctor && doctor.passwordHash) {
    const code = await resetTokens.set(email.trim().toLowerCase());
    try {
      await sendResetCode(email.trim(), code);
    } catch (err) {
      console.error("sendResetCode:", err.message);
      return res.status(500).json({ error: "No se pudo enviar el correo. Verifica la configuración SMTP." });
    }
  }
  // Same response regardless of whether the email exists
  res.json({ ok: true });
});

// ── POST /auth/reset-password ─────────────────────────────────────────────
// Verifies code and sets a new password.
router.post("/reset-password", async (req, res) => {
  const { email, code, password } = req.body;
  if (!email || !code || !password) {
    return res.status(400).json({ error: "Correo, código y contraseña son requeridos" });
  }

  const PW_RULES = [
    (v) => v.length >= 8,
    (v) => /[A-Z]/.test(v),
    (v) => /[a-z]/.test(v),
    (v) => /[0-9]/.test(v),
  ];
  if (!PW_RULES.every((fn) => fn(password))) {
    return res.status(400).json({ error: "La contraseña no cumple los requisitos de seguridad" });
  }

  const result = await resetTokens.verify(email.trim().toLowerCase(), code.trim());
  if (!result.ok) {
    const msg = result.reason === "expired" ? "El código expiró. Solicita uno nuevo."
               : result.reason === "locked"  ? "Demasiados intentos fallidos. Solicita un código nuevo."
               : "Código incorrecto.";
    return res.status(400).json({ error: msg });
  }

  const doctor = await findDoctorByEmail(email.trim().toLowerCase());
  if (!doctor) return res.status(404).json({ error: "Cuenta no encontrada" });

  const passwordHash = await bcrypt.hash(password, 10);
  await patchDoctor(doctor.id, { passwordHash });

  res.json({ ok: true });
});

// ── GET /auth/google ───────────────────────────────────────────────────────
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// ── GET /auth/google/callback ──────────────────────────────────────────────
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login.html?error=oauth` }),
  async (req, res) => {
    // req.user viene del strategy de passport
    const doctor = req.user;
    const token  = signToken(doctor);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    res.redirect(process.env.FRONTEND_URL || "http://localhost:5173");
  }
);

module.exports = router;
