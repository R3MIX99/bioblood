/* BioBlood — Rutas de cuenta del doctor /me (Fase 9 + 11) */

const path    = require("path");
const fs      = require("fs");
const router  = require("express").Router();
const bcrypt  = require("bcrypt");
const jwt     = require("jsonwebtoken");
const multer  = require("multer");
const { ZipArchive } = require("archiver");

const {
  findDoctorById,
  patchDoctor,
  deleteDoctorCascade,
  listPatientsByDoctor,
  listStudiesByDoctor,
} = require("../services/airtable");
const { invalidate, invalidatePrefix } = require("../services/cache");

const COOKIE_NAME = "bb_token";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure:   process.env.NODE_ENV === "production",
  maxAge:   7 * 24 * 60 * 60 * 1000,
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

// Multer: memoria, 2 MB, solo imágenes
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(Object.assign(new Error("Solo se aceptan imágenes PNG o JPG"), { statusCode: 400 }));
  },
});

// ── GET /me ────────────────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const doctor = await findDoctorById(req.doctor.id);
    if (!doctor) return res.status(404).json({ error: "Doctor no encontrado" });
    res.json({
      id:           doctor.id,
      nombre:       doctor.nombre,
      email:        doctor.email,
      avatarUrl:    doctor.avatarUrl,
      googleLinked: !!doctor.googleId,
      createdAt:    doctor.createdAt,
    });
  } catch (e) { next(e); }
});

// ── PATCH /me ──────────────────────────────────────────────────────────────────
router.patch("/", async (req, res, next) => {
  try {
    const { nombre } = req.body;
    const fields = {};
    if (nombre !== undefined) {
      const trimmed = String(nombre).trim();
      if (!trimmed) return res.status(400).json({ error: "El nombre no puede estar vacío" });
      fields.nombre = trimmed;
    }
    if (!Object.keys(fields).length) return res.status(400).json({ error: "Nada que actualizar" });

    const updated = await patchDoctor(req.doctor.id, fields);
    if (!updated) return res.status(500).json({ error: "No se pudo actualizar el perfil" });

    // Refrescar JWT para que el nuevo nombre se refleje en todas las páginas
    const freshToken = signToken({ ...req.doctor, ...updated });
    res.cookie(COOKIE_NAME, freshToken, COOKIE_OPTS);

    res.json({ nombre: updated.nombre, email: updated.email });
  } catch (e) { next(e); }
});

// ── POST /me/password ──────────────────────────────────────────────────────────
router.post("/password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
    }

    const doctor = await findDoctorById(req.doctor.id);
    if (!doctor) return res.status(404).json({ error: "Doctor no encontrado" });

    if (doctor.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Se requiere la contraseña actual" });
      }
      const valid = await bcrypt.compare(currentPassword, doctor.passwordHash);
      if (!valid) return res.status(401).json({ error: "Contraseña actual incorrecta" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await patchDoctor(req.doctor.id, { passwordHash });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /me/avatar ────────────────────────────────────────────────────────────
// Almacena la imagen localmente en /public/avatars/ y guarda la URL en Airtable.
router.post("/avatar", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Se requiere un archivo de imagen" });

    const { buffer, mimetype } = req.file;

    // Determinar extensión según MIME
    const ext = mimetype === "image/png" ? "png"
              : mimetype === "image/webp" ? "webp"
              : "jpg";

    // Guardar en public/avatars/{doctorId}.{ext}
    const avatarsDir = path.join(__dirname, "../../../public/avatars");
    if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

    const filename = `${req.doctor.id}.${ext}`;
    fs.writeFileSync(path.join(avatarsDir, filename), buffer);

    // URL accesible desde el frontend (el servidor Express sirve /public como estático)
    const origin   = `${req.protocol}://${req.get("host")}`;
    const avatarUrl = `${origin}/avatars/${filename}?t=${Date.now()}`;

    // Persistir URL en Airtable (campo de texto "avatarUrl")
    await patchDoctor(req.doctor.id, { avatarUrl });

    res.json({ avatarUrl });
  } catch (e) { next(e); }
});

// ── POST /me/unlink-google ─────────────────────────────────────────────────────
router.post("/unlink-google", async (req, res, next) => {
  try {
    const doctor = await findDoctorById(req.doctor.id);
    if (!doctor) return res.status(404).json({ error: "Doctor no encontrado" });

    if (!doctor.googleId) {
      return res.status(400).json({ error: "No hay cuenta de Google vinculada" });
    }
    if (!doctor.passwordHash) {
      return res.status(400).json({
        error: "Crea una contraseña antes de desvincular Google para no quedar sin metodo de acceso",
      });
    }

    await patchDoctor(req.doctor.id, { googleId: "" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── GET /me/export ─────────────────────────────────────────────────────────────
router.get("/export", async (req, res, next) => {
  try {
    const [patients, studies] = await Promise.all([
      listPatientsByDoctor(req.doctor.id, {}),
      listStudiesByDoctor(req.doctor.id, {}),
    ]);

    const date     = new Date().toISOString().split("T")[0];
    const filename = `bioblood-export-${date}.zip`;

    res.set({
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", err => next(err));
    archive.pipe(res);
    archive.append(JSON.stringify(patients, null, 2), { name: "patients.json" });
    archive.append(JSON.stringify(studies,  null, 2), { name: "studies.json" });
    await archive.finalize();
  } catch (e) { next(e); }
});

// ── POST /me/revoke-sessions ───────────────────────────────────────────────────
router.post("/revoke-sessions", async (req, res, next) => {
  try {
    const doctor = await findDoctorById(req.doctor.id);
    if (!doctor) return res.status(404).json({ error: "Doctor no encontrado" });

    const newVersion = (doctor.tokenVersion || 0) + 1;
    await patchDoctor(req.doctor.id, { tokenVersion: newVersion });

    // Invalidar cache para que el middleware rechace los JWTs viejos de inmediato
    invalidate(`tokenVersion:${req.doctor.id}`);

    // Limpiar la cookie del dispositivo actual
    res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── DELETE /me ─────────────────────────────────────────────────────────────────
router.delete("/", async (req, res, next) => {
  try {
    const { password } = req.body || {};
    const doctor = await findDoctorById(req.doctor.id);
    if (!doctor) return res.status(404).json({ error: "Doctor no encontrado" });

    if (doctor.passwordHash) {
      if (!password) {
        return res.status(400).json({ error: "Se requiere la contraseña para eliminar la cuenta" });
      }
      const valid = await bcrypt.compare(password, doctor.passwordHash);
      if (!valid) return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const ok = await deleteDoctorCascade(req.doctor.id);
    if (!ok) return res.status(500).json({ error: "No se pudo eliminar la cuenta" });

    invalidatePrefix(`tokenVersion:${req.doctor.id}`);
    res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
