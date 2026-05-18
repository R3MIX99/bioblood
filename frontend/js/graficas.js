/* BioBlood — Gráficas de tendencias con Chart.js (Fase 7) */

const _chartInstances = [];

/**
 * Renderiza las gráficas de tendencia para un conjunto de estudios.
 * Solo muestra componentes presentes en 2+ estudios.
 * @param {Object[]} studies    - lista de estudios con .components[]
 * @param {string}   containerId - ID del elemento DOM donde renderizar
 */
function renderGraficas(studies, containerId) {
  // Destruir instancias previas para evitar memory leaks
  _chartInstances.forEach(c => { try { c.destroy(); } catch (_) {} });
  _chartInstances.length = 0;

  const el = document.getElementById(containerId);
  if (!el) return;

  if (!studies || studies.length < 2) {
    el.innerHTML = "";
    return;
  }

  const sorted = [...studies].sort((a, b) => {
    if (!a.fecha && !b.fecha) return 0;
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    return a.fecha.localeCompare(b.fecha);
  });

  // Agrupar datos por componente (nombre normalizado)
  const compMap = new Map();
  for (const study of sorted) {
    for (const comp of (study.components || [])) {
      const norm = localNormalize(comp.name);
      if (!compMap.has(norm)) {
        compMap.set(norm, { displayName: comp.name, unit: comp.unit || "", points: [] });
      }
      compMap.get(norm).points.push({
        date:       study.fecha,
        value:      comp.value,
        status:     comp.status || "nd",
        lowerLimit: comp.lowerLimit ?? null,
        upperLimit: comp.upperLimit ?? null,
      });
    }
  }

  // Solo los componentes con 2+ puntos tienen tendencia real
  const components = [...compMap.values()].filter(c => c.points.length >= 2);

  if (components.length === 0) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
                gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <h2 style="font-family:var(--font-display);font-size:var(--fs-h2);color:var(--text)">
          Tendencias
        </h2>
        <span class="badge-count">${components.length} componentes</span>
      </div>
      <div style="display:flex;gap:var(--space-4);align-items:center;flex-wrap:wrap">
        ${legendDot("#C0392B", "Alto")}
        ${legendDot("#D4870A", "Bajo")}
        ${legendDot("#1A7A4A", "Normal")}
        <span style="font-size:var(--fs-xs);color:var(--text-light)">
          — Límite referencia
        </span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));
                gap:var(--space-5)">
      ${components.map((comp, i) => chartCard(comp, i)).join("")}
    </div>`;

  if (window.lucide) lucide.createIcons();

  // Crear instancias de Chart.js después de que el DOM esté listo
  components.forEach((comp, i) => {
    const chart = createTrendChart(`grafica-${i}`, comp);
    if (chart) _chartInstances.push(chart);
  });
}

// ── Helpers de render ─────────────────────────────────────────────────────────

function legendDot(color, label) {
  return `<span style="display:inline-flex;align-items:center;gap:5px;
                        font-size:var(--fs-xs);color:var(--text-muted)">
    <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
    ${label}
  </span>`;
}

function chartCard(comp, i) {
  return `
    <div class="card" style="padding:20px;overflow:hidden">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;
                  gap:var(--space-2);margin-bottom:14px">
        <div style="min-width:0">
          <p style="font-weight:700;font-size:13px;color:var(--text);
                    line-height:1.3;white-space:normal">
            ${escHtml(comp.displayName)}
          </p>
          <p style="font-size:11px;color:var(--text-light);margin-top:2px">
            ${escHtml(comp.unit)}
          </p>
        </div>
        <button
          class="btn-icon"
          title="Descargar PNG"
          aria-label="Descargar gráfica"
          data-chart="grafica-${i}"
          data-name="${escHtml(comp.displayName)}"
          onclick="downloadChart(this.dataset.chart, this.dataset.name)"
          style="flex-shrink:0"
        >
          <i data-lucide="download" class="icon icon-md" aria-hidden="true"></i>
        </button>
      </div>
      <div style="position:relative;height:180px">
        <canvas id="grafica-${i}"></canvas>
      </div>
    </div>`;
}

// ── Chart.js ─────────────────────────────────────────────────────────────────

function createTrendChart(canvasId, comp) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return null;

  const labels = comp.points.map(p => formatDate(p.date));
  const values = comp.points.map(p => p.value);

  const pointColors = comp.points.map(p => {
    const s = (p.status || "nd").toLowerCase();
    return s === "alto" ? "#C0392B" : s === "bajo" ? "#D4870A" : "#1A7A4A";
  });

  const upper = comp.points.find(p => p.upperLimit != null)?.upperLimit ?? null;
  const lower = comp.points.find(p => p.lowerLimit != null)?.lowerLimit ?? null;

  const datasets = [
    {
      data:                 values,
      borderColor:          "#C0392B",
      borderWidth:          2.5,
      pointBackgroundColor: pointColors,
      pointBorderColor:     "#fff",
      pointBorderWidth:     2,
      pointRadius:          5,
      pointHoverRadius:     7,
      tension:              0.3,
      fill:                 false,
      order:                1,
    },
  ];

  // Líneas de referencia punteadas
  if (upper != null) {
    datasets.push({
      data:        labels.map(() => upper),
      borderColor: "rgba(192,57,43,0.40)",
      borderDash:  [5, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill:        false,
      order:       2,
    });
  }
  if (lower != null) {
    datasets.push({
      data:        labels.map(() => lower),
      borderColor: "rgba(212,135,10,0.45)",
      borderDash:  [5, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill:        false,
      order:       2,
    });
  }

  return new Chart(canvas, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ctx.datasetIndex === 0
              ? `${ctx.raw} ${comp.unit}`
              : ctx.datasetIndex === 1 && upper != null
                ? `Límite sup.: ${ctx.raw} ${comp.unit}`
                : `Límite inf.: ${ctx.raw} ${comp.unit}`,
          },
          backgroundColor: "#111318",
          titleFont:   { size: 11 },
          bodyFont:    { size: 12, weight: "700" },
          padding:     10,
          cornerRadius: 8,
          filter: item => item.datasetIndex === 0, // solo tooltip del dato real
        },
      },
      scales: {
        x: {
          grid:  { color: "rgba(228,230,234,0.5)" },
          ticks: { font: { size: 10 }, color: "#8891A0", maxRotation: 35 },
        },
        y: {
          grid:  { color: "rgba(228,230,234,0.5)" },
          ticks: {
            font:     { size: 10 },
            color:    "#8891A0",
            callback: v => `${v}`,
          },
        },
      },
    },
  });
}

// ── Descarga PNG ─────────────────────────────────────────────────────────────

function downloadChart(canvasId, name) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Compositar sobre fondo blanco (canvas de Chart.js es transparente)
  const tmp       = document.createElement("canvas");
  tmp.width       = canvas.width;
  tmp.height      = canvas.height;
  const ctx       = tmp.getContext("2d");
  ctx.fillStyle   = "#ffffff";
  ctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(canvas, 0, 0);

  const link    = document.createElement("a");
  link.download = `${(name || "grafica").replace(/[^a-z0-9_\-]/gi, "_")}.png`;
  link.href     = tmp.toDataURL("image/png");
  link.click();
}
