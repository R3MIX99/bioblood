/* BioBlood — Servicio de agregaciones para el Dashboard (Fase 9) */

const {
  countPatientsByDoctor,
  listStudiesByDoctor,
  listPatientsByDoctor,
} = require("./airtable");
const { withCache } = require("./cache");

const TTL = 60_000; // 60 segundos

// ── Normalización local (sin llamar a la IA) ─────────────────────────────────

function normalizeComp(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function isoToday() {
  return new Date().toISOString().split("T")[0];
}

function isoNDaysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString().split("T")[0];
}

function isoFirstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── getStats ──────────────────────────────────────────────────────────────────

async function getStats(doctorId) {
  return withCache(`stats:${doctorId}`, TTL, async () => {
    const firstOfMonth = isoFirstOfMonth();
    const thirtyAgo    = isoNDaysAgo(30);

    const [totalPatients, allStudies] = await Promise.all([
      countPatientsByDoctor(doctorId),
      listStudiesByDoctor(doctorId, {}),
    ]);

    const studiesThisMonth = allStudies.filter(s => s.uploadedAt && s.uploadedAt >= firstOfMonth).length;
    const studiesLast30d   = allStudies.filter(s => s.uploadedAt && s.uploadedAt >= thirtyAgo).length;

    // Último estudio por paciente → detectar alertas
    const latestByPatient = new Map();
    for (const s of allStudies) {
      const cur = latestByPatient.get(s.patientId);
      if (!cur || (s.fecha && s.fecha > (cur.fecha || ""))) {
        latestByPatient.set(s.patientId, s);
      }
    }

    let patientsWithAlerts = 0;
    for (const s of latestByPatient.values()) {
      const hasAlert = (s.components || []).some(
        c => c.status === "alto" || c.status === "bajo"
      );
      if (hasAlert) patientsWithAlerts++;
    }

    return {
      totalPatients,
      totalStudies: allStudies.length,
      studiesThisMonth,
      studiesLast30d,
      patientsWithAlerts,
    };
  });
}

// ── getActivity ───────────────────────────────────────────────────────────────

async function getActivity(doctorId, months = 12) {
  return withCache(`activity:${doctorId}:${months}`, TTL, async () => {
    const studies = await listStudiesByDoctor(doctorId, {});

    // Inicializar todos los meses en 0 (sin huecos)
    const now      = new Date();
    const monthMap = new Map();
    for (let i = months - 1; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, 0);
    }

    for (const s of studies) {
      const dateKey = s.uploadedAt || s.fecha;
      if (!dateKey) continue;
      const key = dateKey.slice(0, 7);
      if (monthMap.has(key)) monthMap.set(key, monthMap.get(key) + 1);
    }

    return [...monthMap.entries()].map(([monthISO, count]) => ({ monthISO, studies: count }));
  });
}

// ── getRecentPatients ─────────────────────────────────────────────────────────

async function getRecentPatients(doctorId, limit = 5) {
  return listPatientsByDoctor(doctorId, { limit, sort: "-createdAt" });
}

// ── getRecentStudies ──────────────────────────────────────────────────────────

async function getRecentStudies(doctorId, limit = 5) {
  return listStudiesByDoctor(doctorId, { limit });
}

// ── getAlerts ─────────────────────────────────────────────────────────────────

async function getAlerts(doctorId, limit = 10) {
  const fromISO  = isoNDaysAgo(90);
  const allStudies = await listStudiesByDoctor(doctorId, {});
  const studies = allStudies.filter(s => {
    const d = s.uploadedAt || s.fecha;
    return d && d >= fromISO;
  });

  const alerts = [];
  for (const study of studies) {
    let components;
    try {
      components = study.components || [];
    } catch (e) {
      console.error(`getAlerts: fallo al parsear components del estudio ${study.id}:`, e.message);
      continue;
    }

    const abnormal = components.filter(c => c.status === "alto" || c.status === "bajo");
    if (abnormal.length === 0) continue;

    alerts.push({
      patientId:   study.patientId,
      patientName: study.patientName || "",
      studyId:     study.id,
      date:        study.fecha,
      abnormalComponents: abnormal.map(c => ({
        name:   c.name,
        value:  c.value,
        status: c.status,
        unit:   c.unit || "",
      })),
    });

    if (alerts.length >= limit) break;
  }

  return alerts;
}

// ── getTopComponents ──────────────────────────────────────────────────────────

async function getTopComponents(doctorId, days = 30, limit = 6) {
  return withCache(`top-components:${doctorId}:${days}:${limit}`, TTL, async () => {
    const fromISO  = isoNDaysAgo(days);
    const allStudies = await listStudiesByDoctor(doctorId, {});
    const studies = allStudies.filter(s => {
      const d = s.uploadedAt || s.fecha;
      return d && d >= fromISO;
    });

    const compMap = new Map(); // normalizado → acumulador

    for (const study of studies) {
      for (const comp of (study.components || [])) {
        const norm = normalizeComp(comp.name);
        if (!compMap.has(norm)) {
          compMap.set(norm, {
            name:            comp.name,
            count:           0,
            latestValue:     null,
            latestUnit:      comp.unit || "",
            latestStatus:    comp.status || "nd",
            latestPatientId: study.patientId,
            latestDate:      study.fecha || "",
          });
        }
        const entry = compMap.get(norm);
        entry.count++;
        if (!entry.latestDate || (study.fecha && study.fecha > entry.latestDate)) {
          entry.latestValue     = comp.value;
          entry.latestUnit      = comp.unit || "";
          entry.latestStatus    = comp.status || "nd";
          entry.latestPatientId = study.patientId;
          entry.latestDate      = study.fecha || "";
        }
      }
    }

    return [...compMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(({ name, count, latestValue, latestUnit, latestStatus, latestPatientId }) => ({
        name, count, latestValue, latestUnit, latestStatus, latestPatientId,
      }));
  });
}

module.exports = {
  getStats,
  getActivity,
  getRecentPatients,
  getRecentStudies,
  getAlerts,
  getTopComponents,
};
