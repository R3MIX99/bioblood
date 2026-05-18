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
  return {
    id:           rec.id,
    email:        rec.get("email")        || "",
    passwordHash: rec.get("passwordHash") || "",
    googleId:     rec.get("googleId")     || "",
    nombre:       rec.get("nombre")       || "",
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
    createdAt:     rec.get("createdAt")     || null,
  };
}

function toStudy(rec) {
  if (!rec) return null;
  const pacienteLinks = rec.get("paciente") || [];
  let components = [];
  try { components = JSON.parse(rec.get("componentsJSON") || "[]"); } catch (_) {}
  const rawPaciente = pacienteLinks[0];
  const patientId   = typeof rawPaciente === "string" ? rawPaciente : (rawPaciente?.id || null);
  return {
    id:         rec.id,
    filename:   rec.get("filename")  || "",
    patientId,
    fecha:      rec.get("fecha")     || null,
    labName:    rec.get("labName")   || "",
    components,
    pdf:        rec.get("pdf")       || [],
    createdAt:  rec.get("createdAt") || null,
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

module.exports = {
  findDoctorByEmail,
  findDoctorByGoogleId,
  findDoctorById,
  createDoctor,
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getStudy,
  listStudies,
  createStudy,
  deleteStudy,
};
