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

function toPatient(rec) {
  if (!rec) return null;
  const doctorLinks = rec.get("doctor") || [];
  return {
    id:            rec.id,
    nombre:        rec.get("nombre")       || "",
    doctorId:      doctorLinks[0]          || null,
    edad:          rec.get("edad")         ?? null,
    sexo:          rec.get("sexo")         || null,
    telefono:      rec.get("telefono")     || "",
    email:         rec.get("email")        || "",
    alergias:      rec.get("alergias")     || "",
    padecimientos: rec.get("padecimientos")|| "",
    medicamentos:  rec.get("medicamentos") || "",
    notas:         rec.get("notas")        || "",
    ultimoEstudio: rec.get("ultimoEstudio")|| null,
    createdAt:     rec.get("createdAt")    || null,
  };
}

function toStudy(rec) {
  if (!rec) return null;
  const pacienteLinks = rec.get("paciente") || [];
  let components = [];
  try { components = JSON.parse(rec.get("componentsJSON") || "[]"); } catch (_) {}
  return {
    id:         rec.id,
    filename:   rec.get("filename")  || "",
    patientId:  pacienteLinks[0]     || null,
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
    // Filtra por el record ID del doctor en el campo linked "doctor"
    const records = await base(PACIENTES)
      .select({ filterByFormula: `FIND("${doctorId}", ARRAYJOIN({doctor}))` })
      .all();
    return records.map(toPatient);
  } catch (e) {
    console.error("listPatients:", e.message);
    return [];
  }
}

async function getPatient(id, doctorId) {
  try {
    const rec = await base(PACIENTES).find(id);
    const patient = toPatient(rec);
    // Validar ownership
    if (!patient || patient.doctorId !== doctorId) return null;
    return patient;
  } catch (e) {
    console.error("getPatient:", e.message);
    return null;
  }
}

async function createPatient(doctorId, data) {
  try {
    const { nombre, edad, sexo, telefono, email, alergias, padecimientos, medicamentos, notas } = data;
    const fields = {
      nombre:        nombre        || "",
      doctor:        [doctorId],
      alergias:      alergias      || "",
      padecimientos: padecimientos || "",
      medicamentos:  medicamentos  || "",
      notas:         notas         || "",
    };
    if (edad     !== undefined && edad     !== null) fields.edad     = Number(edad);
    if (sexo)                                        fields.sexo     = sexo;
    if (telefono)                                    fields.telefono = telefono;
    if (email)                                       fields.email    = email;

    const [rec] = await base(PACIENTES).create([{ fields }]);
    return toPatient(rec);
  } catch (e) {
    console.error("createPatient:", e.message);
    return null;
  }
}

async function updatePatient(id, doctorId, data) {
  try {
    // Verificar ownership primero
    const existing = await getPatient(id, doctorId);
    if (!existing) return null;

    const { nombre, edad, sexo, telefono, email, alergias, padecimientos, medicamentos, notas } = data;
    const fields = {};
    if (nombre        !== undefined) fields.nombre        = nombre;
    if (edad          !== undefined) fields.edad          = Number(edad);
    if (sexo          !== undefined) fields.sexo          = sexo;
    if (telefono      !== undefined) fields.telefono      = telefono;
    if (email         !== undefined) fields.email         = email;
    if (alergias      !== undefined) fields.alergias      = alergias;
    if (padecimientos !== undefined) fields.padecimientos = padecimientos;
    if (medicamentos  !== undefined) fields.medicamentos  = medicamentos;
    if (notas         !== undefined) fields.notas         = notas;

    const [rec] = await base(PACIENTES).update([{ id, fields }]);
    return toPatient(rec);
  } catch (e) {
    console.error("updatePatient:", e.message);
    return null;
  }
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

async function listStudies(patientId) {
  try {
    const records = await base(ESTUDIOS)
      .select({ filterByFormula: `FIND("${patientId}", ARRAYJOIN({paciente}))` })
      .all();
    return records.map(toStudy);
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
  listStudies,
  createStudy,
  deleteStudy,
};
