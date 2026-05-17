const express  = require("express");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const passport = require("passport");

const {
  findDoctorByEmail,
  findDoctorByGoogleId,
  createDoctor,
  findDoctorById,
} = require("../services/airtable");

const { requireAuth } = require("../middleware/auth");

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
    { id: doctor.id, email: doctor.email, nombre: doctor.nombre },
    process.env.JWT_SECRET || "dev-jwt-secret",
    { expiresIn: "7d" }
  );
}

// ── POST /auth/register ────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { email, password, nombre } = req.body;

  if (!email || !password || !nombre) {
    return res.status(400).json({ error: "email, password y nombre son requeridos" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  const existing = await findDoctorByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const doctor = await createDoctor({ email, passwordHash, nombre });
  if (!doctor) {
    return res.status(500).json({ error: "No se pudo crear la cuenta" });
  }

  const token = signToken(doctor);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.status(201).json({ doctor: { id: doctor.id, email: doctor.email, nombre: doctor.nombre } });
});

// ── POST /auth/login ───────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
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
