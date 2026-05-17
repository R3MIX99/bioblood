require("dotenv").config();

const express      = require("express");
const cors         = require("cors");
const cookieParser = require("cookie-parser");
const session      = require("express-session");

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

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());
app.use(session({
  secret:            process.env.SESSION_SECRET || "dev-session-secret",
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProd,
    httpOnly: true,
    maxAge:   10 * 60 * 1000, // 10 min — solo para OAuth flow
  },
}));

// ── Rutas ─────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// Stubs — se implementarán en fases siguientes
// app.use("/auth",     require("./routes/auth"));
// app.use("/patients", require("./routes/patients"));
// app.use("/studies",  require("./routes/studies"));
// app.use("/ai",       require("./routes/ai"));

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Error interno del servidor" });
});

// ── Arranque ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`BioBlood backend corriendo en http://localhost:${PORT}`);
});
