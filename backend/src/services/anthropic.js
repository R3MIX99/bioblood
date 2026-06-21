const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = "claude-sonnet-4-5";

// ── Helpers ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Intenta parsear JSON posiblemente truncado cerrando arrays/objetos abiertos.
 * Replica la lógica de reparación del bioblood.jsx original.
 */
function parseJsonSafe(text) {
  const clean = text.replace(/```json|```/g, "").trim();

  // Intento 1: JSON completo
  try { return JSON.parse(clean); } catch (_) {}

  // Intento 2: reparar JSON truncado
  try {
    let fixed = clean;
    const lastCompleteObj    = fixed.lastIndexOf("},");
    const lastCompleteObjEnd = fixed.lastIndexOf("}");
    if (lastCompleteObj > 0 && lastCompleteObj > lastCompleteObjEnd - 5) {
      fixed = fixed.slice(0, lastCompleteObj + 1);
    }
    const openCurly  = (fixed.match(/\{/g) || []).length;
    const closeCurly = (fixed.match(/\}/g) || []).length;
    const openSquare = (fixed.match(/\[/g) || []).length;
    const closeSquare= (fixed.match(/\]/g) || []).length;
    fixed = fixed.replace(/,\s*$/, "");
    for (let i = 0; i < openSquare - closeSquare; i++) fixed += "]";
    for (let i = 0; i < openCurly  - closeCurly;  i++) fixed += "}";
    return JSON.parse(fixed);
  } catch (e) {
    throw new Error(`JSON inválido en respuesta: ${clean.slice(0, 120)}`);
  }
}

// ── parseBloodStudy ────────────────────────────────────────────────────────

/**
 * Analiza un PDF de estudio de sangre y extrae sus componentes.
 * @param {string} base64Pdf - PDF codificado en base64
 * @param {string} filename  - nombre del archivo (para contexto)
 * @returns {object} { isBloodStudy, date, patientName, labName, components } | { isBloodStudy: false, reason }
 */
async function parseBloodStudy(base64Pdf, filename) {
  const today = new Date().toISOString().split("T")[0];

  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
        },
        {
          type: "text",
          text: `Analiza este PDF.

PRIMERO determina si es un estudio de sangre/laboratorio clínico con resultados numéricos de componentes sanguíneos.

Si NO es un estudio de sangre, responde ÚNICAMENTE con este JSON:
{"isBloodStudy": false, "reason": "descripción breve de qué es el documento"}

Si SÍ es un estudio de sangre, extrae:
1. La fecha del estudio (formato YYYY-MM-DD, si no hay fecha usa "${today}")
2. Todos los componentes con valores numéricos, unidades y rangos de referencia

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "isBloodStudy": true,
  "date": "YYYY-MM-DD",
  "patientName": "nombre si aparece, o null",
  "labName": "nombre del laboratorio si aparece, o null",
  "components": [
    {
      "name": "nombre del componente",
      "value": número_flotante,
      "unit": "unidad",
      "lowerLimit": número_o_null,
      "upperLimit": número_o_null,
      "status": "normal|bajo|alto|desconocido"
    }
  ]
}`,
        },
      ],
    }],
  });

  const text = msg.content?.find((b) => b.type === "text")?.text || "";
  if (!text) throw new Error("La API no devolvió contenido de texto");
  return parseJsonSafe(text);
}

// ── buildCanonicalMap ──────────────────────────────────────────────────────

/**
 * Agrupa nombres de componentes clínicamente equivalentes.
 * @param {string[]} names - lista de nombres únicos de componentes
 * @returns {Object} mapa { varianteOriginal: nombreCanónico }
 */
async function buildCanonicalMap(names) {
  if (!names || names.length === 0) return {};

  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Eres un experto en nomenclatura de laboratorio clínico.

Aquí hay una lista de nombres de componentes extraídos de estudios de sangre:
${names.map((n, i) => `${i + 1}. "${n}"`).join("\n")}

Agrupa los que se refieran al MISMO componente biológico aunque estén escritos diferente:
- Con o sin acento (Albumina / Albúmina)
- Abreviaturas (Hb / Hemoglobina / Hgb)
- Mayúsculas distintas (GLUCOSA / Glucosa)
- Nombre completo vs corto (Volumen Corpuscular Medio / VCM)
- Sinónimos clínicos (Leucocitos / Glóbulos Blancos / WBC)
- Errores tipográficos menores

Para cada grupo, elige el nombre canónico más completo y claro en español.

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "groups": [
    {
      "canonical": "Nombre canónico elegido",
      "variants": ["nombre1", "nombre2", ...]
    }
  ]
}

IMPORTANTE: Incluye TODOS los nombres de la lista, incluso los que no tienen variantes (ponlos solos en su grupo).`,
    }],
  });

  const text = msg.content?.find((b) => b.type === "text")?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(clean);
    const map = {};
    for (const group of parsed.groups ?? []) {
      for (const variant of group.variants ?? []) {
        map[variant] = group.canonical;
      }
    }
    return map;
  } catch {
    return {};
  }
}

// ── summarizeStudies ───────────────────────────────────────────────────────

/**
 * Genera un resumen objetivo de uno o varios estudios de sangre.
 * @param {Array} studies - Array de { id, fecha, labName, components: [{name,value,unit,lowerLimit,upperLimit,status}] }
 * @returns {string} Resumen en texto/markdown
 */
async function summarizeStudies(studies) {
  if (!studies || studies.length === 0) throw new Error("Sin estudios para resumir");

  const studiesBlocks = studies.map((s) => {
    const dateLabel = s.fecha    ? ` — ${s.fecha}` : "";
    const labLabel  = s.labName  ? ` (${s.labName})` : "";
    const header    = `Patient Study Results${dateLabel}${labLabel}`;

    // Filter out components with null/undefined value, then format each line
    const lines = (s.components || [])
      .filter(c => c.value != null && c.name)
      .map(c => {
        const ref = (c.lowerLimit != null && c.upperLimit != null)
          ? ` (ref: ${c.lowerLimit}–${c.upperLimit} ${c.unit ?? ""})`
          : "";
        const unit   = c.unit  ?? "";
        const status = c.status && c.status !== "desconocido" ? ` [${c.status.toUpperCase()}]` : "";
        return `- ${c.name}: ${c.value} ${unit}${ref}${status}`.trim();
      });

    if (lines.length === 0) return null;
    return `${header}\n${lines.join("\n")}`;
  }).filter(Boolean);

  if (studiesBlocks.length === 0) throw new Error("Los estudios no contienen componentes con valores");

  const structuredContext = studiesBlocks.join("\n\n");

  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `You are a clinical assistant summarizing a patient's lab study results.
Below are the extracted and structured results from the study. Do NOT say data is missing — if a value is not present in the list, simply omit it from the summary.

${structuredContext}

Respond in Spanish with a bullet-point list of the most relevant findings. Each bullet must be a single, factual statement. Rules:
- Use "•" as the bullet character.
- Flag values outside the reference range with their exact value and direction (↑ alto / ↓ bajo).
- If there are multiple studies with dates, flag trends: values that improved, worsened, or stayed abnormal over time.
- Only include normal values if they are part of a meaningful pattern.
- Do not include an intro sentence, conclusion, or headings — only the bullet list.
- Do not mention missing data.
- Aim for 4–8 bullets covering only the most relevant facts.`,
    }],
  });

  const text = msg.content?.find((b) => b.type === "text")?.text || "";
  if (!text) throw new Error("La API no devolvió contenido");
  return text;
}

module.exports = { parseBloodStudy, buildCanonicalMap, summarizeStudies };
