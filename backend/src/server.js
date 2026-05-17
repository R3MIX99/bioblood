require("dotenv").config();

const express      = require("express");
const cors         = require("cors");
const cookieParser = require("cookie-parser");
const session      = require("express-session");
const passport     = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const { findDoctorByGoogleId, createDoctor } = require("./services/airtable");

// ── Validación de secretos al arrancar ────────────────────────────────────
const isProd = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET) {
  console.warn("⚠  JWT_SECRET no está configurado.");
  if (isProd) { console.error("JWT_SECRET requerido en producción. Abortando."); process.exit(1); }
}
if (!process.env.SESSION_SECRET) {
  console.warn("⚠  SESSION_SECRET no está configurado.");
  if (isProd) { console.error("SESSION_SECRET requerido en producción. Abortando."); process.exit(1); }
}

// ── App ───────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware base ────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());

// Sesión solo para el OAuth flow (memory store, sin persistencia)
app.use(session({
  secret:            process.env.SESSION_SECRET || "dev-session-secret",
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProd,
    httpOnly: true,
    maxAge:   10 * 60 * 1000, // 10 min
  },
}));

// ── Passport — Google OAuth (solo si está configurado) ────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback",
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email    = profile.emails?.[0]?.value || "";
        const nombre   = profile.displayName || email;

        let doctor = await findDoctorByGoogleId(googleId);

        if (!doctor) {
          const { findDoctorByEmail } = require("./services/airtable");
          const byEmail = await findDoctorByEmail(email);
          if (byEmail) {
            doctor = byEmail;
          } else {
            doctor = await createDoctor({ email, googleId, nombre, passwordHash: "" });
          }
        }

        return done(null, doctor);
      } catch (err) {
        return done(err);
      }
    }
  ));
} else {
  console.warn("⚠  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no configurados — OAuth de Google deshabilitado.");
}

// Passport requiere serialización aunque no usemos sesión persistente
passport.serializeUser((user, done)   => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(passport.initialize());
app.use(passport.session());

// ── Rutas ─────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth",     require("./routes/auth"));
// app.use("/patients", require("./routes/patients"));  // Fase 4
// app.use("/studies",  require("./routes/studies"));   // Fase 5
// app.use("/ai",       require("./routes/ai"));        // Fase 5

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Error interno del servidor" });
});

// ── Arranque ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`BioBlood backend corriendo en http://localhost:${PORT}`);
});
