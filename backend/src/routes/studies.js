/* BioBlood — Rutas de estudios (Fase 5) */

const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const {
  getPatient,
  getStudy,
  listStudies,
  createStudy,
  deleteStudy,
} = require("../services/airtable");
const { parseBloodStudy, summarizeStudies } = require("../services/anthropic");

// ── GET /studies?patientId=xxx ────────────────────────────────────────────────
// Lista estudios de un paciente verificando ownership.
router.get("/", requireAuth, async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId es requerido" });

  const patient = await getPatient(patientId, req.doctor.id);
  if (!patient) return res.status(404).json({ error: "Paciente no encontrado" });

  try {
    const studies = await listStudies(patientId);
    // Ordenar por fecha desc (más reciente primero)
    studies.sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return b.fecha.localeCompare(a.fecha);
    });
    res.json(studies);
  } catch (err) {
    console.error("GET /studies:", err.message);
    res.status(500).json({ error: "Error al obtener estudios" });
  }
});

// ── POST /studies ─────────────────────────────────────────────────────────────
// Parsea un PDF con Claude y guarda el estudio resultante.
router.post("/", requireAuth, async (req, res) => {
  const { patientId, pdfBase64, filename } = req.body;

  if (!patientId || !pdfBase64 || !filename) {
    return res.status(400).json({ error: "patientId, pdfBase64 y filename son requeridos" });
  }

  // Verificar ownership del paciente
  const patient = await getPatient(patientId, req.doctor.id);
  if (!patient) return res.status(404).json({ error: "Paciente no encontrado" });

  // ── Parsear con Claude ───────────────────────────────────────────────────
  let parsed;
  try {
    parsed = await parseBloodStudy(pdfBase64, filename);
  } catch (err) {
    console.error("parseBloodStudy:", err.message);
    const msg = err.message || "";
    console.error("parseBloodStudy error completo:", msg);
    const isQuota = msg.includes("credit balance") || msg.includes("too low") ||
                    msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rateLimitExceeded") ||
                    err.status === 429 || err.status === 402;
    if (isQuota) {
      return res.status(402).json({
        error: "Los créditos o cuota de IA se han agotado. Recarga tu saldo en el proveedor de IA configurado para continuar.",
        code:  "INSUFFICIENT_CREDITS",
      });
    }
    return res.status(422).json({ error: "No se pudo analizar el PDF. Verifica que sea un estudio de sangre válido." });
  }

  if (!parsed) {
    return res.status(422).json({ error: "La IA no devolvió un resultado válido" });
  }
  if (!parsed.isBloodStudy) {
    return res.status(422).json({
      error: `El PDF no parece ser un estudio de sangre. ${parsed.reason || ""}`.trim(),
    });
  }

  // ── Guardar en Airtable ──────────────────────────────────────────────────
  try {
    const study = await createStudy({
      patientId,
      fecha:          parsed.date    || new Date().toISOString().split("T")[0],
      filename,
      labName:        parsed.labName || "",
      componentsJSON: JSON.stringify(parsed.components || []),
      // No adjuntamos el PDF base64 en Airtable — el storage de archivos va en Fase futura
    });

    if (!study) return res.status(500).json({ error: "Error al guardar el estudio en Airtable" });
    res.status(201).json(study);
  } catch (err) {
    console.error("POST /studies createStudy:", err.message);
    res.status(500).json({ error: "Error al guardar el estudio" });
  }
});

// ── POST /studies/summary ─────────────────────────────────────────────────────
// Genera un resumen IA de los componentes de una categoría específica.
// El cliente envía `studiesData` (ya filtrado por categoría) para que la IA
// resuma solo esos componentes, no todo el PDF.
router.post("/summary", requireAuth, async (req, res) => {
  const { patientId, studiesData } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId es requerido" });

  const patient = await getPatient(patientId, req.doctor.id);
  if (!patient) return res.status(404).json({ error: "Paciente no encontrado" });

  try {
    let toSummarize = studiesData;

    // Si el cliente no envía los datos filtrados, fallback a todos los estudios
    if (!Array.isArray(toSummarize) || toSummarize.length === 0) {
      const studies = await listStudies(patientId);
      if (!studies || studies.length === 0) {
        return res.status(422).json({ error: "El paciente no tiene estudios" });
      }
      toSummarize = studies.map(s => ({
        id:         s.id,
        fecha:      s.fecha,
        components: s.components || [],
      }));
    }

    const summary = await summarizeStudies(toSummarize);
    res.json({ summary });
  } catch (err) {
    console.error("POST /studies/summary:", err.message);
    res.status(500).json({ error: err.message || "Error al generar el resumen" });
  }
});

// ── DELETE /studies/:id ───────────────────────────────────────────────────────
// Elimina un estudio verificando que su paciente pertenezca al doctor.
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const study = await getStudy(req.params.id);
    if (!study) return res.status(404).json({ error: "Estudio no encontrado" });

    // Verificar ownership via paciente
    const patient = await getPatient(study.patientId, req.doctor.id);
    if (!patient) return res.status(403).json({ error: "Sin permisos para eliminar este estudio" });

    await deleteStudy(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /studies/:id:", err.message);
    res.status(500).json({ error: "Error al eliminar el estudio" });
  }
});

module.exports = router;
