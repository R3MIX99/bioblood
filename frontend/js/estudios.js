/* BioBlood — Renderizado de componentes de un estudio (Fase 5) */

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

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:var(--space-3)">
      ${components.map(componentCard).join("")}
    </div>`;
}

function componentCard(c) {
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

  // Recopilar nombres únicos de componentes (normalizado → metadatos)
  const seen = new Map();
  for (const study of sorted) {
    for (const comp of (study.components || [])) {
      const norm = localNormalize(comp.name);
      if (!seen.has(norm)) seen.set(norm, { displayName: comp.name, unit: comp.unit || "" });
    }
  }

  // Construir filas: una por componente
  const rows = [...seen.entries()].map(([norm, meta]) => ({
    displayName: meta.displayName,
    unit: meta.unit,
    cells: sorted.map(study => {
      const comp = (study.components || []).find(c => localNormalize(c.name) === norm);
      return comp ? { value: comp.value, unit: comp.unit, status: comp.status } : null;
    }),
  }));

  // Ordenar: primero los que aparecen en más estudios, luego alfabético
  rows.sort((a, b) => {
    const aFill = a.cells.filter(Boolean).length;
    const bFill = b.cells.filter(Boolean).length;
    if (bFill !== aFill) return bFill - aFill;
    return a.displayName.localeCompare(b.displayName, "es");
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

  // Fila 1 del thead: laboratorios (fondo crimson via CSS)
  const labHeaders = sorted.map(s =>
    `<th>${escHtml(s.labName || "Laboratorio")}</th>`
  ).join("");

  // Fila 2 del thead: fechas (fondo surface-tint via CSS)
  const dateHeaders = sorted.map(s =>
    `<th>${escHtml(formatDate(s.fecha))}</th>`
  ).join("");

  // Filas del cuerpo
  const bodyRows = rows.map(row => {
    const statuses = row.cells.filter(Boolean).map(c => (c.status || "nd").toLowerCase());
    let rowClass = "";
    if (statuses.some(s => s === "alto"))      rowClass = "row-status-high";
    else if (statuses.some(s => s === "bajo")) rowClass = "row-status-low";
    else if (statuses.length && statuses.every(s => s === "normal")) rowClass = "row-status-normal";

    const cells = row.cells.map(cell => {
      if (!cell) return `<td class="pivot-cell-empty" style="text-align:center">—</td>`;
      const s = (cell.status || "nd").toLowerCase();
      const cls = s === "alto" ? "pivot-cell-alto"
        : s === "bajo"   ? "pivot-cell-bajo"
        : s === "normal" ? "pivot-cell-normal"
        : "pivot-cell-nd";
      return `<td style="text-align:center">
        <span class="${cls}">${cell.value ?? "—"}</span>
      </td>`;
    }).join("");

    return `<tr class="${rowClass}">
      <td>${escHtml(row.displayName)}</td>
      <td style="text-align:center;color:var(--text-muted)">${escHtml(row.unit)}</td>
      ${cells}
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
      <div style="display:flex;gap:var(--space-4);align-items:center">
        ${dot("var(--red)",   "Alto")}
        ${dot("var(--amber)", "Bajo")}
        ${dot("var(--green)", "Normal")}
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
              ${labHeaders}
            </tr>
            <tr>
              <th></th>
              <th></th>
              ${dateHeaders}
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>`;
}
