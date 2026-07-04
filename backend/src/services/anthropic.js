// ── PRODUCCIÓN (Claude): descomentar esto y eliminar el bloque GEMINI de abajo ──
// const Anthropic = require("@anthropic-ai/sdk");
// const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// const MODEL  = "claude-sonnet-4-5";
// ────────────────────────────────────────────────────────────────────────────────

// ── GEMINI (testing): eliminar este bloque al volver a Claude en producción ──────
const { GoogleGenerativeAI } = require("@google/generative-ai");
const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// TODO: cambiar a "gemini-2.0-flash" o "gemini-1.5-pro" antes del deployment a producción
const MODEL = "gemini-2.0-flash";
// ────────────────────────────────────────────────────────────────────────────────

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Intenta parsear JSON posiblemente truncado cerrando arrays/objetos abiertos.
 */
function parseJsonSafe(text) {
  const clean = text.replace(/```json|```/g, "").trim();

  try { return JSON.parse(clean); } catch (_) {}

  try {
    let fixed = clean;
    fixed = fixed.replace(/,\s*$/, "").replace(/,\s*[\]}]*$/, "");

    const lastBrace = fixed.lastIndexOf("}");
    if (lastBrace > 0) {
      const candidate = fixed.slice(0, lastBrace + 1);
      const opens   = (candidate.match(/\{/g) || []).length;
      const closes  = (candidate.match(/\}/g) || []).length;
      const sqOpen  = (candidate.match(/\[/g) || []).length;
      const sqClose = (candidate.match(/\]/g) || []).length;
      let attempt   = candidate.replace(/,\s*$/, "");
      for (let i = 0; i < sqOpen - sqClose; i++) attempt += "]";
      for (let i = 0; i < opens  - closes;  i++) attempt += "}";
      try { return JSON.parse(attempt); } catch (_) {}
    }

    const lastCommaObj = fixed.lastIndexOf("},");
    if (lastCommaObj > 0) {
      let attempt   = fixed.slice(0, lastCommaObj + 1);
      const opens   = (attempt.match(/\{/g) || []).length;
      const closes  = (attempt.match(/\}/g) || []).length;
      const sqOpen  = (attempt.match(/\[/g) || []).length;
      const sqClose = (attempt.match(/\]/g) || []).length;
      attempt = attempt.replace(/,\s*$/, "");
      for (let i = 0; i < sqOpen - sqClose; i++) attempt += "]";
      for (let i = 0; i < opens  - closes;  i++) attempt += "}";
      try { return JSON.parse(attempt); } catch (_) {}
    }

    throw new Error("No se pudo reparar el JSON");
  } catch (e) {
    throw new Error(`JSON inválido en respuesta: ${clean.slice(0, 120)}`);
  }
}

// ── parseBloodStudy ────────────────────────────────────────────────────────

async function parseBloodStudy(base64Pdf, filename) {
  const today = new Date().toISOString().split("T")[0];

  const prompt = `Analiza este PDF de laboratorio clínico.

PASO 1 — ¿Es un estudio de sangre/laboratorio?
Si NO lo es, responde ÚNICAMENTE: {"isBloodStudy": false, "reason": "descripción breve"}

PASO 2 — Identifica las SECCIONES del PDF.
El PDF está dividido en secciones o paneles de prueba (ej: "Citometría Hemática", "Perfil Química 35 elementos", "Examen General de Orina"). Cada sección tiene un nombre que aparece como encabezado, título o en negritas/subrayado antes de sus componentes. Identifica todas las secciones presentes.

PASO 3 — Para cada sección, normaliza su nombre a una categoría canónica:
- Variantes de biometría hemática / citometría hemática / hematología / BHC / BCH / CBC / conteo sanguíneo → "Biometría Hemática"
- Variantes de examen general de orina / urianálisis / urinalisis / EGO / análisis de orina → "Examen General de Orina"
- Variantes de perfil lipídico / lípidos / panel lipídico → "Perfil Lipídico"
- Variantes de perfil hepático / función hepática / enzimas hepáticas / pruebas hepáticas → "Perfil Hepático"
- Variantes de perfil tiroideo / función tiroidea / hormonas tiroideas / TSH panel → "Perfil Tiroideo"
- Variantes de electrolitos / panel de electrolitos (cuando es una sección EXCLUSIVA de electrolitos) → "Electrolitos"
- Variantes de hemoglobina glucosilada / HbA1c / A1c / glucosilada → "Hemoglobina Glucosilada"
- Paneles amplios de química: "perfil química X elementos", "química sanguínea", "panel metabólico", "panel bioquímico", "BMP", "CMP", "perfil metabólico completo" → "Química Sanguínea"
- Variantes de coagulación / hemostasia / tiempo de protrombina / coagulograma / INR / TP / TPT → "Coagulación"
- Variantes de marcadores tumorales / oncología / inmunología tumoral / antígenos tumorales / AFP / CA 125 / CEA / PSA → "Marcadores Tumorales"
- Si no hay equivalencia clara → usa el nombre de la sección tal como aparece en el PDF, capitalizado correctamente

PASO 4 — Extrae TODOS los componentes de cada sección.
REGLA CRÍTICA: Todos los componentes de una misma sección del PDF deben tener exactamente la misma "category". NO sub-categorices componentes dentro de una sección. Si el PDF agrupa glucosa, colesterol, sodio y bilirrubinas bajo "Perfil Química 35 elementos", todos van a "Química Sanguínea".

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "isBloodStudy": true,
  "date": "YYYY-MM-DD (si no hay fecha usa ${today})",
  "patientName": "nombre si aparece, o null",
  "labName": "nombre del laboratorio si aparece, o null",
  "components": [
    {
      "name": "nombre del componente",
      "value": número_flotante_o_string_cualitativo,
      "unit": "unidad tal como aparece en el PDF, o null si no hay unidad",
      "lowerLimit": número_o_null,
      "upperLimit": número_o_null,
      "referenceText": "valor de referencia textual (ej: NEGATIVO, AMARILLO) o null si el rango es numérico",
      "status": "normal|bajo|alto|desconocido",
      "category": "nombre canónico de la sección según PASO 3"
    }
  ]
}

REGLAS adicionales:
- Extrae TODOS los componentes sin excepción (incluyendo sedimento urinario, células, índices, razones, etc.)
- "unit": la unidad exacta del PDF; null si no aparece unidad
- Valores cualitativos (NEGATIVO, POSITIVO, ESCASAS, NO SE OBSERVAN, colores, etc.): "value" = texto del resultado, "unit" = unidad si aparece o null, "lowerLimit"/"upperLimit" = null, "referenceText" = valor esperado del PDF
- Cuando el RESULTADO es un rango (ej: "0-3"): "value" = "0-3" como string, extraer lowerLimit/upperLimit de la columna de REFERENCIA del PDF
- "status": normal si está en rango, bajo si está por debajo, alto si está por encima, desconocido si no se puede determinar`;

  // ── PRODUCCIÓN (Claude): descomentar esto y eliminar el bloque GEMINI de abajo ──
  // const msg = await client.messages.create({
  //   model:      MODEL,
  //   max_tokens: 8000,
  //   messages: [{
  //     role: "user",
  //     content: [
  //       { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Pdf } },
  //       { type: "text", text: prompt },
  //     ],
  //   }],
  // });
  // const text = msg.content?.find((b) => b.type === "text")?.text || "";
  // ────────────────────────────────────────────────────────────────────────────────

  // ── GEMINI (testing): eliminar este bloque al volver a Claude en producción ──────
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 8000 },
  });
  const result = await model.generateContent([
    { inlineData: { mimeType: "application/pdf", data: base64Pdf } },
    { text: prompt },
  ]);
  const text = result.response.text();
  // ────────────────────────────────────────────────────────────────────────────────

  if (!text) throw new Error("La API no devolvió contenido de texto");
  return parseJsonSafe(text);
}

// ── buildCanonicalMap ──────────────────────────────────────────────────────

async function buildCanonicalMap(names) {
  if (!names || names.length === 0) return {};

  const prompt = `Eres un experto en nomenclatura de laboratorio clínico.

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

IMPORTANTE: Incluye TODOS los nombres de la lista, incluso los que no tienen variantes (ponlos solos en su grupo).`;

  // ── PRODUCCIÓN (Claude): descomentar esto y eliminar el bloque GEMINI de abajo ──
  // const msg = await client.messages.create({
  //   model:      MODEL,
  //   max_tokens: 2000,
  //   messages: [{ role: "user", content: prompt }],
  // });
  // const text = msg.content?.find((b) => b.type === "text")?.text || "";
  // ────────────────────────────────────────────────────────────────────────────────

  // ── GEMINI (testing): eliminar este bloque al volver a Claude en producción ──────
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 2000 },
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  // ────────────────────────────────────────────────────────────────────────────────

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

async function summarizeStudies(studies) {
  if (!studies || studies.length === 0) throw new Error("Sin estudios para resumir");

  const blocks = studies.map(s => {
    const lines = (s.components || [])
      .filter(c => c.value != null && c.name)
      .map(c => {
        const val  = c.value;
        const unit = c.unit  ? ` ${c.unit}` : "";
        const ref  = c.referenceText
          ? ` [ref:${c.referenceText}]`
          : (c.lowerLimit != null && c.upperLimit != null)
            ? ` [ref:${c.lowerLimit}-${c.upperLimit}${unit}]`
            : "";
        const flag = c.status === "alto" ? "↑" : c.status === "bajo" ? "↓" : "";
        return `${flag}${c.name}:${val}${unit}${ref}`;
      });
    if (!lines.length) return null;
    return `${s.fecha || "s/f"}\n${lines.join("\n")}`;
  }).filter(Boolean);

  if (!blocks.length) throw new Error("Sin componentes con valores");

  const prompt = `Resultados de laboratorio (formato: [↑↓]nombre:valor unidad [ref:rango]):

${blocks.join("\n\n")}

Responde SOLO con viñetas "•" en español. Reglas:
- Señala valores ↑↓ con su valor y dirección.
- Con varias fechas, indica tendencias (mejoró/empeoró/persiste).
- Omite valores normales salvo que sean parte de un patrón relevante.
- Sin introducción, conclusión ni encabezados.
- Máximo 6 viñetas con los hallazgos más importantes.`;

  // ── PRODUCCIÓN (Claude): descomentar esto y eliminar el bloque GEMINI de abajo ──
  // const msg = await client.messages.create({
  //   model:      MODEL,
  //   max_tokens: 500,
  //   messages: [{ role: "user", content: prompt }],
  // });
  // const text = msg.content?.find((b) => b.type === "text")?.text || "";
  // ────────────────────────────────────────────────────────────────────────────────

  // ── GEMINI (testing): eliminar este bloque al volver a Claude en producción ──────
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 500 },
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  // ────────────────────────────────────────────────────────────────────────────────

  if (!text) throw new Error("La API no devolvió contenido");
  return text;
}

module.exports = { parseBloodStudy, buildCanonicalMap, summarizeStudies };
