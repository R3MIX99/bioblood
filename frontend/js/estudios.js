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
