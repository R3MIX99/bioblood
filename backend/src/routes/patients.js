/* BioBlood — Rutas de pacientes */

const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
} = require("../services/airtable");

// ── GET /patients ─────────────────────────────────────────────────────────────
// Lista todos los pacientes del doctor autenticado.
router.get("/", requireAuth, async (req, res) => {
  try {
    const patients = await listPatients(req.doctor.id);
    res.json(patients);
  } catch (err) {
    console.error("GET /patients:", err);
    res.status(500).json({ error: "Error al obtener pacientes" });
  }
});

// ── POST /patients ────────────────────────────────────────────────────────────
// Crea un nuevo paciente asociado al doctor autenticado.
router.post("/", requireAuth, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) {
    return res.status(400).json({ error: "El nombre es requerido" });
  }
  try {
    const patient = await createPatient(req.doctor.id, req.body);
    if (!patient) return res.status(500).json({ error: "Error al crear paciente" });
    res.status(201).json(patient);
  } catch (err) {
    console.error("POST /patients:", err);
    res.status(500).json({ error: "Error al crear paciente" });
  }
});

// ── GET /patients/:id ─────────────────────────────────────────────────────────
// Obtiene un paciente verificando ownership.
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const patient = await getPatient(req.params.id, req.doctor.id);
    if (!patient) return res.status(404).json({ error: "Paciente no encontrado" });
    res.json(patient);
  } catch (err) {
    console.error("GET /patients/:id:", err);
    res.status(500).json({ error: "Error al obtener paciente" });
  }
});

// ── PUT /patients/:id ─────────────────────────────────────────────────────────
// Actualiza un paciente verificando ownership.
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const patient = await updatePatient(req.params.id, req.doctor.id, req.body);
    if (!patient) return res.status(404).json({ error: "Paciente no encontrado" });
    res.json(patient);
  } catch (err) {
    console.error("PUT /patients/:id:", err);
    res.status(500).json({ error: "Error al actualizar paciente" });
  }
});

// ── DELETE /patients/:id ──────────────────────────────────────────────────────
// Elimina un paciente y todos sus estudios (cascade en airtable.js).
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const ok = await deletePatient(req.params.id, req.doctor.id);
    if (!ok) return res.status(404).json({ error: "Paciente no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /patients/:id:", err);
    res.status(500).json({ error: "Error al eliminar paciente" });
  }
});

module.exports = router;
