/* BioBlood — Renderizado de componentes de un estudio (Fase 5) */

// ── Clasificación de estudios por categoría ────────────────────────────────────
// Asigna un estudio a una categoría clínica en función de los componentes que contiene.
// Cada panel tiene palabras clave; el estudio queda en la categoría con más coincidencias.

const STUDY_PANELS = [
  { name: "Biometría Hemática",      icon: "droplets",      color: "#C0392B",
    keywords: ["hemoglobina","hematocrito","eritrocito","globulo rojo","leucocito","globulo blanco",
               "plaqueta","trombocito","linfocito","neutrofilo","monocito","eosinofilo","basofilo",
               "vcm","vgm","hcm","chcm","rdw","mpv","reticulocito","formula leucocitaria"] },
  { name: "Química Sanguínea",       icon: "flask-conical", color: "#1A7A4A",
    keywords: ["glucosa","urea","creatinina","acido urico","bun","nitrogeno ureico",
               "albumina","proteina total","globulina","aclaramiento"] },
  { name: "Perfil Lipídico",         icon: "activity",      color: "#8B5CF6",
    keywords: ["colesterol","triglicerido","hdl","ldl","vldl","lipoproteina",
               "colesterol no hdl","apolipoproteina","indice aterogenico"] },
  { name: "Perfil Hepático",         icon: "zap",           color: "#D4870A",
    keywords: ["tgo","tgp","ast","alt","bilirrubina","fosfatasa alcalina","ggt",
               "transaminasa","dhl","ldh"] },
  { name: "Perfil Tiroideo",         icon: "shield",        color: "#0891B2",
    keywords: ["tsh","t3","t4","tiroxina","triyodotironina","tiroglobulina","tpo"] },
  { name: "Electrolitos",            icon: "zap-off",       color: "#059669",
    keywords: ["sodio","potasio","cloro","calcio","magnesio","fosforo","bicarbonato","electrolito"] },
  { name: "Hemoglobina Glucosilada", icon: "percent",       color: "#DC2626",
    keywords: ["hemoglobina glucosilada","hba1c","hb a1c","a1c","glucosilada","fructosamina"] },
  { name: "Examen General de Orina", icon: "droplet",       color: "#0369A1",
    keywords: ["orina","urina","densidad urinaria","ph orina","glucosa orina","proteina orina",
               "sedimento","leucocitos orina","eritrocitos orina","nitritos","cetonas","urobilinogeno"] },
];

/**
 * Clasifica un componente individual en su categoría clínica.
 * Prioriza comp.category (asignado por la IA), con fallback a keyword matching.
 */
function classifyComponent(comp) {
  // Usar la categoría asignada por la IA si es válida
  if (comp.category) {
    const valid = STUDY_PANELS.find(p => p.name === comp.category);
    if (valid) return valid.name;
  }

  // Fallback: keyword matching sobre el nombre del componente
  const norm = (comp.name || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ");

  let bestPanel = null;
  let bestScore = 0;
  for (const panel of STUDY_PANELS) {
    const score = panel.keywords.reduce((acc, kw) => acc + (norm.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestPanel = panel; }
  }
  return bestScore > 0 ? bestPanel.name : "Otros";
}

/**
 * Construye un mapa de categorías a partir de un array de estudios.
 * Agrupa a nivel de componente (un estudio puede aparecer en varias categorías).
 * Retorna Map<categoryName, { studies: Study[], componentCount: number }>
 */
function buildCategoryMap(studies) {
  const map = new Map(); // categoryName → { studyIds: Set, componentCount }

  for (const study of studies) {
    for (const comp of (study.components || [])) {
      const cat = classifyComponent(comp);
      if (!map.has(cat)) map.set(cat, { studyIds: new Set(), componentCount: 0 });
      map.get(cat).studyIds.add(study.id);
      map.get(cat).componentCount++;
    }
  }

  // Convertir studyIds → studies array, preservando orden original
  const result = new Map();
  for (const [cat, { studyIds, componentCount }] of map) {
    result.set(cat, {
      studies: studies.filter(s => studyIds.has(s.id)),
      componentCount,
    });
  }
  return result;
}

/**
 * Devuelve la metadata del panel para un nombre de categoría dado.
 */
function getPanelMeta(categoryName) {
  return STUDY_PANELS.find(p => p.name === categoryName)
    || { name: categoryName, icon: "folder", color: "#636B78" };
}

// Mapas de tinte y color por estado
const TINT_MAP = {
  normal:      "card-tint card-tint-mint",
  bajo:        "card-tint card-tint-peach",
  alto:        "card-tint card-tint-rose",
  desconocido: "",
  nd:          "",
};
const VALUE_COLOR = {
  normal:      "var(--green)",
  bajo:        "var(--amber)",
  alto:        "var(--red)",
  desconocido: "var(--text)",
  nd:          "var(--text-light)",
};

/**
 * Renderiza las tarjetas de componentes de un estudio en el contenedor dado.
 * Depende de escHtml y getStatusBadge definidos en utils.js.
 *
 * @param {Object}      study     - objeto estudio con .components[]
 * @param {HTMLElement} container - elemento DOM donde inyectar
 */
function renderComponentCards(study, container) {
  if (!container) return;

  const components = study.components || [];

  if (components.length === 0) {
    container.innerHTML = `
      <p style="color:var(--text-light);font-size:var(--fs-sm);padding:var(--space-4) 0">
        Este estudio no tiene componentes registrados.
      </p>`;
    return;
  }

  const rows = components.map(c => {
    const status = (c.status || "nd").toLowerCase();
    const ref    = buildRefText(c);

    // Color de fondo por fila según estatus
    const rowBg = status === "alto"   ? "background:rgba(192,57,43,0.04)"
                : status === "bajo"   ? "background:rgba(212,135,10,0.04)"
                : "";

    // Color del valor
    const valColor = VALUE_COLOR[status] || "var(--text)";

    return `
      <tr style="border-bottom:1px solid var(--border);${rowBg}">
        <td style="padding:10px 16px;font-weight:600;font-size:var(--fs-sm);color:var(--text)">
          ${escHtml(c.name)}
        </td>
        <td style="padding:10px 12px;text-align:right;font-family:var(--font-display);
                   font-weight:700;font-size:15px;color:${valColor};white-space:nowrap">
          ${c.value ?? "—"}
        </td>
        <td style="padding:10px 12px;font-size:var(--fs-xs);color:var(--text-muted);
                   white-space:nowrap">
          ${escHtml(c.unit || "—")}
        </td>
        <td style="padding:10px 12px;text-align:center">${getStatusBadge(status)}</td>
        <td style="padding:10px 16px;text-align:right;font-size:var(--fs-xs);
                   color:var(--text-muted);white-space:nowrap">
          ${escHtml(ref)}
        </td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);
                border-radius:var(--radius-lg);overflow:hidden">
      <table style="width:100%;border-collapse:collapse;font-family:var(--font-body)">
        <thead>
          <tr style="background:var(--surface-tint);border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:10px 16px;font-size:var(--fs-xs);
                       font-weight:700;color:var(--text-muted);text-transform:uppercase;
                       letter-spacing:0.5px">Componente</th>
            <th style="text-align:right;padding:10px 12px;font-size:var(--fs-xs);
                       font-weight:700;color:var(--text-muted);text-transform:uppercase;
                       letter-spacing:0.5px">Valor</th>
            <th style="padding:10px 12px;font-size:var(--fs-xs);font-weight:700;
                       color:var(--text-muted);text-transform:uppercase;
                       letter-spacing:0.5px">Unidad</th>
            <th style="text-align:center;padding:10px 12px;font-size:var(--fs-xs);
                       font-weight:700;color:var(--text-muted);text-transform:uppercase;
                       letter-spacing:0.5px">Resultado</th>
            <th style="text-align:right;padding:10px 16px;font-size:var(--fs-xs);
                       font-weight:700;color:var(--text-muted);text-transform:uppercase;
                       letter-spacing:0.5px">Rango de referencia</th>
          </tr>
        </thead>
        <tbody style="divide-y:var(--border)">
          ${rows}
        </tbody>
      </table>
    </div>`;
}

function componentCard(c) {
  // Mantenida por compatibilidad, ya no se usa directamente
  const status   = (c.status || "nd").toLowerCase();
  const tint     = TINT_MAP[status] || "";
  const valColor = VALUE_COLOR[status] || "var(--text)";
  const ref      = buildRefText(c);

  return `
    <div class="${tint || "card"}" style="${!tint ? "border:1px solid var(--border)" : ""}">
      <p style="font-weight:700;font-size:13px;color:var(--text);
                line-height:1.3;margin-bottom:var(--space-2)">
        ${escHtml(c.name)}
      </p>
      <p style="font-size:20px;font-weight:700;line-height:1;
                margin-bottom:var(--space-2);font-family:var(--font-display);color:${valColor}">
        ${c.value ?? "—"}<span style="font-size:var(--fs-xs);font-weight:400;
          color:var(--text-light);margin-left:3px;font-family:var(--font-body)">
          ${escHtml(c.unit || "")}
        </span>
      </p>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2)">
        ${getStatusBadge(status)}
        <span style="font-size:10px;color:var(--text-light);text-align:right;line-height:1.3">
          ${escHtml(ref)}
        </span>
      </div>
    </div>`;
}

function buildRefText(c) {
  if (c.lowerLimit != null && c.upperLimit != null)
    return `${c.lowerLimit} – ${c.upperLimit} ${c.unit || ""}`.trim();
  if (c.upperLimit != null)
    return `< ${c.upperLimit} ${c.unit || ""}`.trim();
  if (c.lowerLimit != null)
    return `> ${c.lowerLimit} ${c.unit || ""}`.trim();
  return "—";
}

/**
 * Calcula el resumen estadístico de un estudio.
 * @param {Object} study
 * @returns {{ total, altos, bajos, normales }}
 */
function getStudySummary(study) {
  const components = study.components || [];
  return {
    total:    components.length,
    altos:    components.filter(c => (c.status || "").toLowerCase() === "alto").length,
    bajos:    components.filter(c => (c.status || "").toLowerCase() === "bajo").length,
    normales: components.filter(c => (c.status || "").toLowerCase() === "normal").length,
  };
}

// ── Fase 6: Tabla pivote comparativa ─────────────────────────────────────────

function buildPivotData(studies) {
  const sorted = [...studies].sort((a, b) => {
    if (!a.fecha && !b.fecha) return 0;
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    return a.fecha.localeCompare(b.fecha);
  });

  // Clave de fila: nombre normalizado + unidad + lowerLimit + upperLimit
  // Componentes del mismo nombre pero diferente unidad o límites → filas separadas
  const rowMap = new Map(); // key → { displayName, unit, lower, upper, cells[] }

  for (const study of sorted) {
    for (const comp of (study.components || [])) {
      const norm  = localNormalize(comp.name);
      const unit  = comp.unit        ?? "";
      const lower = comp.lowerLimit  ?? null;
      const upper = comp.upperLimit  ?? null;
      const key   = `${norm}||${unit}||${lower}||${upper}`;

      if (!rowMap.has(key)) {
        rowMap.set(key, {
          norm,
          displayName: comp.name,
          unit,
          lower,
          upper,
          // inicializar todas las celdas en null
          cells: sorted.map(() => null),
        });
      }
    }
  }

  // Rellenar celdas de cada fila
  for (let si = 0; si < sorted.length; si++) {
    const study = sorted[si];
    for (const comp of (study.components || [])) {
      const norm  = localNormalize(comp.name);
      const unit  = comp.unit       ?? "";
      const lower = comp.lowerLimit ?? null;
      const upper = comp.upperLimit ?? null;
      const key   = `${norm}||${unit}||${lower}||${upper}`;
      const row   = rowMap.get(key);
      if (row) row.cells[si] = { value: comp.value, status: comp.status };
    }
  }

  const rows = [...rowMap.values()];

  // Ordenar: mismo nombre agrupado y contiguo, dentro del grupo más relleno primero
  rows.sort((a, b) => {
    const nameComp = a.norm.localeCompare(b.norm, "es");
    if (nameComp !== 0) return nameComp;
    const aFill = a.cells.filter(Boolean).length;
    const bFill = b.cells.filter(Boolean).length;
    return bFill - aFill;
  });

  return { studies: sorted, rows };
}

function renderPivotTable(studies, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!studies || studies.length < 2) {
    el.innerHTML = "";
    return;
  }

  const { studies: sorted, rows } = buildPivotData(studies);
  // Guardar para la descarga CSV
  el._pivotData = { sorted, rows };

  // Fila 1 del thead: laboratorios (fondo crimson via CSS)
  const labHeaders = sorted.map(s =>
    `<th>${escHtml(s.labName || "Laboratorio")}</th>`
  ).join("");

  // Fila 2 del thead: fechas (fondo surface-tint via CSS)
  const dateHeaders = sorted.map(s =>
    `<th>${escHtml(formatDate(s.fecha))}</th>`
  ).join("");

  // Detectar qué nombres de componente tienen más de una variante (distintos límites/unidad)
  const normCounts = new Map();
  for (const row of rows) normCounts.set(row.norm, (normCounts.get(row.norm) || 0) + 1);

  // Filas del cuerpo
  const bodyRows = rows.map(row => {
    const statuses = row.cells.filter(Boolean).map(c => (c.status || "nd").toLowerCase());
    let rowClass = "";
    if (statuses.some(s => s === "alto"))      rowClass = "row-status-high";
    else if (statuses.some(s => s === "bajo")) rowClass = "row-status-low";
    else if (statuses.length && statuses.every(s => s === "normal")) rowClass = "row-status-normal";

    const cells = row.cells.map(cell => {
      if (!cell) return `<td class="pivot-cell-empty" style="text-align:center;color:var(--text-light);font-size:var(--fs-xs)">NA</td>`;
      const s = (cell.status || "nd").toLowerCase();
      const cls = s === "alto" ? "pivot-cell-alto"
        : s === "bajo"   ? "pivot-cell-bajo"
        : s === "normal" ? "pivot-cell-normal"
        : "pivot-cell-nd";
      return `<td style="text-align:center">
        <span class="${cls}">${cell.value ?? "—"}</span>
      </td>`;
    }).join("");

    // Columna de rango
    const hasLower = row.lower != null;
    const hasUpper = row.upper != null;
    let rangeCell = `<td style="text-align:center;color:var(--text-light);font-size:var(--fs-xs)">—</td>`;
    if (hasLower && hasUpper) {
      rangeCell = `<td style="text-align:center;white-space:nowrap;font-size:var(--fs-xs);color:var(--text-muted)">
        ${row.lower} – ${row.upper} <span style="color:var(--text-light)">${escHtml(row.unit)}</span>
      </td>`;
    } else if (hasUpper) {
      rangeCell = `<td style="text-align:center;white-space:nowrap;font-size:var(--fs-xs);color:var(--text-muted)">
        &lt; ${row.upper} <span style="color:var(--text-light)">${escHtml(row.unit)}</span>
      </td>`;
    } else if (hasLower) {
      rangeCell = `<td style="text-align:center;white-space:nowrap;font-size:var(--fs-xs);color:var(--text-muted)">
        &gt; ${row.lower} <span style="color:var(--text-light)">${escHtml(row.unit)}</span>
      </td>`;
    }

    // Si el componente tiene variantes, añadir sub-label con los límites para distinguirlas
    const hasVariants = normCounts.get(row.norm) > 1;
    const nameHtml = hasVariants
      ? `${escHtml(row.displayName)}<br><span style="font-size:10px;color:var(--text-light);font-weight:400">
           ref. ${row.lower ?? "?"} – ${row.upper ?? "?"} ${escHtml(row.unit)}
         </span>`
      : escHtml(row.displayName);

    return `<tr class="${rowClass}">
      <td>${nameHtml}</td>
      <td style="text-align:center;color:var(--text-muted)">${escHtml(row.unit)}</td>
      ${cells}
      ${rangeCell}
    </tr>`;
  }).join("");

  const dot = (color, label) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;
                  font-size:var(--fs-xs);color:var(--text-muted)">
      <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
      ${label}
    </span>`;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
                gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <h2 style="font-family:var(--font-display);font-size:var(--fs-h2);color:var(--text)">
          Tabla comparativa
        </h2>
        <span class="badge-count">${sorted.length} estudios</span>
      </div>
      <div style="display:flex;gap:var(--space-4);align-items:center;flex-wrap:wrap">
        ${dot("var(--red)",   "Alto")}
        ${dot("var(--amber)", "Bajo")}
        ${dot("var(--green)", "Normal")}
        <button
          class="btn-ghost"
          style="display:inline-flex;align-items:center;gap:var(--space-2);font-size:var(--fs-sm)"
          onclick="downloadPivotCSV('${containerId}')"
          title="Descargar tabla como CSV"
        >
          <i data-lucide="download" class="icon icon-sm" aria-hidden="true"></i>
          Descargar tabla
        </button>
      </div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);
                border-radius:var(--radius-xl);overflow:hidden;box-shadow:var(--shadow-sm)">
      <div class="table-container">
        <table class="pivot-table">
          <thead>
            <tr>
              <th style="text-align:left">Componente</th>
              <th style="text-align:center">Unidad</th>
              ${dateHeaders}
              <th style="text-align:center">Rango de referencia</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Descarga CSV de la tabla pivote ──────────────────────────────────────────

function downloadPivotCSV(containerId) {
  const el   = document.getElementById(containerId);
  const data = el?._pivotData;
  if (!data) return;

  const { sorted, rows } = data;

  const csvCell = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const labRow  = ["Componente", "Unidad", ...sorted.map(s => formatDate(s.fecha)), "Rango de referencia"];

  const csvRows = [labRow];

  for (const row of rows) {
    const cells = row.cells.map(cell => cell ? String(cell.value ?? "—") : "NA");

    let range = "";
    if (row.lower != null && row.upper != null) range = `${row.lower} – ${row.upper} ${row.unit}`.trim();
    else if (row.upper != null) range = `< ${row.upper} ${row.unit}`.trim();
    else if (row.lower != null) range = `> ${row.lower} ${row.unit}`.trim();

    csvRows.push([row.displayName, row.unit, ...cells, range]);
  }

  const csv  = csvRows.map(r => r.map(csvCell).join(",")).join("\r\n");
  const bom  = "﻿"; // BOM para que Excel reconozca UTF-8
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `tabla-comparativa-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
