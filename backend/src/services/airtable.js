require("dotenv").config();
const Airtable = require("airtable");

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

const DOCTORES  = process.env.AIRTABLE_DOCTORES_TABLE;
const PACIENTES = process.env.AIRTABLE_PACIENTES_TABLE;
const ESTUDIOS  = process.env.AIRTABLE_ESTUDIOS_TABLE;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convierte un record de Airtable en un objeto plano. */
function toDoctor(rec) {
  if (!rec) return null;
  const avatarAttachments = rec.get("avatar") || [];
  return {
    id:           rec.id,
    email:        rec.get("email")        || "",
    passwordHash: rec.get("passwordHash") || "",
    googleId:     rec.get("googleId")     || "",
    nombre:       rec.get("nombre")       || "",
    avatarUrl:    avatarAttachments[0]?.url ?? null,
    tokenVersion: rec.get("tokenVersion") ?? 0,
    createdAt:    rec._rawJson?.createdTime || null,
  };
}

// El campo "sexo" en Airtable usa opciones cortas ("M", "F", "Otro").
// Mapeamos hacia valores legibles en la app y viceversa.
const SEXO_TO_APP  = { "M": "Masculino", "F": "Femenino", "Otro": "Otro" };
const SEXO_TO_AT   = { "Masculino": "M", "Femenino": "F", "Otro": "Otro" };

function toPatient(rec) {
  if (!rec) return null;
  const doctorLinks = rec.get("doctor") || [];
  const sexoRaw     = rec.get("sexo") || null;
  // El SDK puede devolver string ID o {id, name} — normalizamos ambos casos
  const rawLink  = doctorLinks[0];
  const doctorId = typeof rawLink === "string" ? rawLink : (rawLink?.id || null);
  return {
    id:            rec.id,
    nombre:        rec.get("nombre")        || "",
    doctorId,
    edad:          rec.get("edad")          ?? null,
    sexo:          SEXO_TO_APP[sexoRaw]     || sexoRaw,   // "M" → "Masculino"
    telefono:      rec.get("telefono")      || "",
    email:         rec.get("email")         || "",
    alergias:      rec.get("alergias")      || "",
    padecimientos: rec.get("padecimientos") || "",
    medicamentos:  rec.get("medicamentos")  || "",
    notas:         rec.get("notas")         || "",
    ultimoEstudio: rec.get("ultimoEstudio") || null,
    createdAt:     rec._rawJson?.createdTime ? rec._rawJson.createdTime.slice(0, 10) : null,
  };
}

function toStudy(rec) {
  if (!rec) return null;
  const pacienteLinks = rec.get("paciente") || [];
  let components = [];
  try { components = JSON.parse(rec.get("componentsJSON") || "[]"); } catch (_) {}
  const rawPaciente = pacienteLinks[0];
  const patientId   = typeof rawPaciente === "string" ? rawPaciente : (rawPaciente?.id || null);
  const rawCreated = rec._rawJson?.createdTime;
  return {
    id:         rec.id,
    filename:   rec.get("filename")  || "",
    patientId,
    fecha:      rec.get("fecha")     || null,
    labName:    rec.get("labName")   || "",
    components,
    pdf:        rec.get("pdf")       || [],
    createdAt:  rec.get("createdAt") || null,
    uploadedAt: rawCreated ? rawCreated.slice(0, 10) : null,
  };
}

// ── Doctores ───────────────────────────────────────────────────────────────

async function findDoctorByEmail(email) {
  try {
    const records = await base(DOCTORES)
      .select({ filterByFormula: `{email} = "${email}"`, maxRecords: 1 })
      .firstPage();
    return toDoctor(records[0] || null);
  } catch (e) {
    console.error("findDoctorByEmail:", e.message);
    return null;
  }
}

async function findDoctorByGoogleId(googleId) {
  try {
    const records = await base(DOCTORES)
      .select({ filterByFormula: `{googleId} = "${googleId}"`, maxRecords: 1 })
      .firstPage();
    return toDoctor(records[0] || null);
  } catch (e) {
    console.error("findDoctorByGoogleId:", e.message);
    return null;
  }
}

async function createDoctor({ email, passwordHash = "", googleId = "", nombre = "" }) {
  try {
    const [rec] = await base(DOCTORES).create([
      { fields: { email, passwordHash, googleId, nombre } },
    ]);
    return toDoctor(rec);
  } catch (e) {
    console.error("createDoctor:", e.message);
    return null;
  }
}

async function findDoctorById(id) {
  try {
    const rec = await base(DOCTORES).find(id);
    return toDoctor(rec);
  } catch (e) {
    console.error("findDoctorById:", e.message);
    return null;
  }
}

// ── Pacientes ──────────────────────────────────────────────────────────────

async function listPatients(doctorId) {
  try {
    // ARRAYJOIN sobre campos linked devuelve el valor del campo primario (email),
    // no el record ID — por eso filtramos en JS después de mapear.
    const records = await base(PACIENTES).select().all();
    return records
      .map(toPatient)
      .filter(p => p && p.doctorId === doctorId);
  } catch (e) {
    console.error("listPatients:", e.message);
    return [];
  }
}

async function getPatient(id, doctorId) {
  try {
    const rec     = await base(PACIENTES).find(id);
    const patient = toPatient(rec);
    if (!patient) return null;
    if (patient.doctorId !== doctorId) {
      console.warn(`getPatient ownership fail — patient.doctorId="${patient.doctorId}" vs doctorId="${doctorId}"`);
      return null;
    }
    return patient;
  } catch (e) {
    console.error("getPatient:", e.message);
    return null;
  }
}

async function createPatient(doctorId, data) {
  const { nombre, edad, sexo, telefono, email, alergias, padecimientos, medicamentos, notas } = data;

  // Solo incluir campos que tengan valor real para evitar errores de campo inexistente en Airtable
  const fields = {
    nombre: nombre || "",
    doctor: [doctorId],
  };
  if (edad          !== undefined && edad          !== null && edad !== "") fields.edad          = Number(edad);
  if (sexo          !== undefined && sexo          !== null && sexo !== "") fields.sexo          = SEXO_TO_AT[sexo] || sexo;  // "Masculino" → "M"
  if (telefono      !== undefined && telefono      !== null && telefono !== "") fields.telefono  = telefono;
  if (email         !== undefined && email         !== null && email !== "") fields.email        = email;
  if (alergias      !== undefined && alergias      !== null && alergias !== "") fields.alergias      = alergias;
  if (padecimientos !== undefined && padecimientos !== null && padecimientos !== "") fields.padecimientos = padecimientos;
  if (medicamentos  !== undefined && medicamentos  !== null && medicamentos !== "") fields.medicamentos  = medicamentos;
  if (notas         !== undefined && notas         !== null && notas !== "") fields.notas         = notas;

  // Lanzar el error para que la ruta lo capture y lo propague al cliente
  const [rec] = await base(PACIENTES).create([{ fields }]);
  return toPatient(rec);
}

async function updatePatient(id, doctorId, data) {
  // Verificar ownership primero
  const existing = await getPatient(id, doctorId);
  if (!existing) return null;

  const { nombre, edad, sexo, telefono, email, alergias, padecimientos, medicamentos, notas } = data;
  const fields = {};
  if (nombre        !== undefined) fields.nombre        = nombre;
  if (edad          !== undefined && edad !== null && edad !== "") fields.edad = Number(edad);
  if (sexo          !== undefined) fields.sexo          = SEXO_TO_AT[sexo] || sexo || null;  // "Masculino" → "M"
  if (telefono      !== undefined) fields.telefono      = telefono || "";
  if (email         !== undefined) fields.email         = email || "";
  if (alergias      !== undefined) fields.alergias      = alergias || "";
  if (padecimientos !== undefined) fields.padecimientos = padecimientos || "";
  if (medicamentos  !== undefined) fields.medicamentos  = medicamentos || "";
  if (notas         !== undefined) fields.notas         = notas || "";

  // Lanzar el error para que la ruta lo capture y lo propague
  const [rec] = await base(PACIENTES).update([{ id, fields }]);
  return toPatient(rec);
}

async function deletePatient(id, doctorId) {
  try {
    const existing = await getPatient(id, doctorId);
    if (!existing) return false;
    // Borrar estudios del paciente primero
    const studies = await listStudies(id);
    for (const s of studies) await deleteStudy(s.id);
    await base(PACIENTES).destroy([id]);
    return true;
  } catch (e) {
    console.error("deletePatient:", e.message);
    return false;
  }
}

// ── Estudios ───────────────────────────────────────────────────────────────

async function getStudy(id) {
  try {
    const rec = await base(ESTUDIOS).find(id);
    return toStudy(rec);
  } catch (e) {
    console.error("getStudy:", e.message);
    return null;
  }
}

async function listStudies(patientId) {
  try {
    // Mismo problema que listPatients: ARRAYJOIN devuelve valores del campo primario,
    // no record IDs. Filtramos en JS con el patientId extraído por toStudy().
    const records = await base(ESTUDIOS).select().all();
    return records
      .map(toStudy)
      .filter(s => s && s.patientId === patientId);
  } catch (e) {
    console.error("listStudies:", e.message);
    return [];
  }
}

async function createStudy({ patientId, fecha, filename, labName = "", componentsJSON = "[]", pdfBase64 = null }) {
  try {
    const fields = {
      filename:       filename,
      paciente:       [patientId],
      fecha:          fecha,
      labName:        labName,
      componentsJSON: typeof componentsJSON === "string"
        ? componentsJSON
        : JSON.stringify(componentsJSON),
    };

    // Adjuntar PDF si viene en base64
    if (pdfBase64) {
      fields.pdf = [{ url: `data:application/pdf;base64,${pdfBase64}`, filename }];
    }

    const [rec] = await base(ESTUDIOS).create([{ fields }]);
    return toStudy(rec);
  } catch (e) {
    console.error("createStudy:", e.message);
    return null;
  }
}

async function deleteStudy(id) {
  try {
    await base(ESTUDIOS).destroy([id]);
    return true;
  } catch (e) {
    console.error("deleteStudy:", e.message);
    return false;
  }
}

// ── Funciones nuevas (Fase 9) ──────────────────────────────────────────────

/** Cuenta pacientes de un doctor (JS-side filter, igual que listPatients). */
async function countPatientsByDoctor(doctorId) {
  const patients = await listPatients(doctorId);
  return patients.length;
}

/**
 * Lista todos los estudios del doctor resolviendo nombre de paciente.
 * Soporta filtros opcionales: limit, fromISO (fecha>=), toISO (fecha<=).
 */
async function listStudiesByDoctor(doctorId, { limit, fromISO, toISO } = {}) {
  try {
    const patients   = await listPatients(doctorId);
    const patientMap = new Map(patients.map(p => [p.id, p]));

    const records = await base(ESTUDIOS).select().all();
    let studies = records
      .map(toStudy)
      .filter(s => s && patientMap.has(s.patientId))
      .map(s => ({ ...s, patientName: patientMap.get(s.patientId)?.nombre || "" }));

    if (fromISO) studies = studies.filter(s => s.fecha && s.fecha >= fromISO);
    if (toISO)   studies = studies.filter(s => s.fecha && s.fecha <= toISO);

    studies.sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return b.fecha.localeCompare(a.fecha);
    });

    return limit ? studies.slice(0, limit) : studies;
  } catch (e) {
    console.error("listStudiesByDoctor:", e.message);
    return [];
  }
}

/** Cuenta estudios totales del doctor. */
async function countStudiesByDoctor(doctorId) {
  const studies = await listStudiesByDoctor(doctorId, {});
  return studies.length;
}

/** Cuenta estudios del doctor en un rango de fechas ISO (YYYY-MM-DD). */
async function countStudiesByDoctorInRange(doctorId, fromISO, toISO) {
  const studies = await listStudiesByDoctor(doctorId, { fromISO, toISO });
  return studies.length;
}

/** Lista pacientes del doctor con ordenamiento, paginación y ultimoEstudio calculado. */
async function listPatientsByDoctor(doctorId, { limit, sort = "-createdAt" } = {}) {
  try {
    const [patients, studies] = await Promise.all([
      listPatients(doctorId),
      listStudiesByDoctor(doctorId, {}),
    ]);

    // Calcular última fecha de estudio por paciente
    const ultimoMap = new Map();
    for (const s of studies) {
      if (!s.patientId) continue;
      const date = s.fecha;
      const cur  = ultimoMap.get(s.patientId);
      if (date && (!cur || date > cur)) ultimoMap.set(s.patientId, date);
    }

    const enriched = patients.map(p => ({
      ...p,
      ultimoEstudio: ultimoMap.get(p.id) ?? p.ultimoEstudio ?? null,
    }));

    if (sort === "-createdAt") {
      enriched.sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    }
    return limit ? enriched.slice(0, limit) : enriched;
  } catch (e) {
    console.error("listPatientsByDoctor:", e.message);
    return [];
  }
}

/** Busca un estudio por ID validando que su paciente pertenezca al doctor. */
async function findStudyById(id, doctorId) {
  try {
    const study = await getStudy(id);
    if (!study) return null;
    const patient = await getPatient(study.patientId, doctorId);
    return patient ? study : null;
  } catch (e) {
    console.error("findStudyById:", e.message);
    return null;
  }
}

/** Actualiza campos parciales del doctor. */
async function patchDoctor(id, fields) {
  try {
    const [rec] = await base(DOCTORES).update([{ id, fields }]);
    return toDoctor(rec);
  } catch (e) {
    console.error("patchDoctor:", e.message);
    return null;
  }
}

/**
 * Borra en cascada: estudios → pacientes → doctor.
 * Usa batches de 10 (límite de la API de Airtable).
 */
async function deleteDoctorCascade(id) {
  try {
    const patients = await listPatients(id);

    for (const patient of patients) {
      const studies = await listStudies(patient.id);
      for (let i = 0; i < studies.length; i += 10) {
        await base(ESTUDIOS).destroy(studies.slice(i, i + 10).map(s => s.id));
      }
    }

    for (let i = 0; i < patients.length; i += 10) {
      await base(PACIENTES).destroy(patients.slice(i, i + 10).map(p => p.id));
    }

    await base(DOCTORES).destroy([id]);
    return true;
  } catch (e) {
    console.error("deleteDoctorCascade:", e.message);
    return false;
  }
}

/**
 * Sube un avatar como attachment al campo multipleAttachments "avatar"
 * usando la Airtable Content API.
 * Requiere AIRTABLE_AVATAR_FIELD_ID en el entorno.
 */
async function uploadDoctorAvatar(doctorId, fileBuffer, mimeType, filename) {
  const apiKey  = process.env.AIRTABLE_API_KEY;
  const baseId  = process.env.AIRTABLE_BASE_ID;
  const fieldId = process.env.AIRTABLE_AVATAR_FIELD_ID;

  if (!fieldId) throw new Error("AIRTABLE_AVATAR_FIELD_ID no configurado en .env");

  const form = new FormData();
  form.append("file",     new Blob([fileBuffer], { type: mimeType }), filename);
  form.append("filename", filename);

  const resp = await fetch(
    `https://content.airtable.com/v0/${baseId}/${doctorId}/${fieldId}/uploadAttachment`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body:    form,
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${resp.status} al subir avatar`);
  }

  const { attachment } = await resp.json();
  return attachment?.url || null;
}

module.exports = {
  findDoctorByEmail,
  findDoctorByGoogleId,
  findDoctorById,
  createDoctor,
  patchDoctor,
  deleteDoctorCascade,
  uploadDoctorAvatar,
  listPatients,
  listPatientsByDoctor,
  countPatientsByDoctor,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getStudy,
  findStudyById,
  listStudies,
  listStudiesByDoctor,
  countStudiesByDoctor,
  countStudiesByDoctorInRange,
  createStudy,
  deleteStudy,
};
