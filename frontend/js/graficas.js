/* BioBlood — Gráficas de tendencias con Chart.js */

const _chartInstances = [];

/**
 * Renderiza las gráficas de tendencia para un conjunto de estudios.
 * Agrupación: nombre normalizado + unidad + lowerLimit + upperLimit.
 * Componentes con la misma unidad y mismos límites → una sola gráfica.
 * Cualquier diferencia en unidad o límites → gráfica separada.
 * Solo muestra series con 2+ puntos (tendencia real).
 */
function renderGraficas(studies, containerId, patientName) {
  _chartInstances.forEach(c => { try { c.destroy(); } catch (_) {} });
  _chartInstances.length = 0;

  const el = document.getElementById(containerId);
  if (!el) return;

  if (!studies || studies.length < 2) { el.innerHTML = ""; return; }

  const sorted = [...studies].sort((a, b) => {
    if (!a.fecha && !b.fecha) return 0;
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    return a.fecha.localeCompare(b.fecha);
  });

  // ── Agrupación idéntica a la tabla pivote ──────────────────────────────────
  // Clave: nombre_normalizado || unidad || lowerLimit || upperLimit
  // Garantiza que solo se grafican juntos los puntos que comparten exactamente
  // la misma unidad de medida y el mismo rango de referencia.
  const compMap = new Map();

  for (const study of sorted) {
    for (const comp of (study.components || [])) {
      // No graficar valores cualitativos (texto como NEGATIVO, POSITIVO, etc.)
      if (comp.value == null || isNaN(Number(comp.value))) continue;
      const norm  = localNormalize(comp.name);
      const unit  = comp.unit        ?? "";
      const lower = comp.lowerLimit  ?? null;
      const upper = comp.upperLimit  ?? null;
      const key   = `${norm}||${unit}||${lower}||${upper}`;

      if (!compMap.has(key)) {
        compMap.set(key, {
          norm,
          displayName: comp.name,
          unit,
          lower,
          upper,
          points: [],
        });
      }
      compMap.get(key).points.push({
        date:   study.fecha,
        value:  Number(comp.value),   // asegurar numérico
        status: (comp.status || "desconocido").toLowerCase(),
      });
    }
  }

  // Graficar todas las series con al menos 1 punto.
  // Series con 1 punto muestran el valor puntual respecto a los límites de referencia,
  // sin línea de tendencia (un solo punto no genera línea).
  const components = [...compMap.values()].filter(c => c.points.length >= 1);

  if (components.length === 0) { el.innerHTML = ""; return; }

  // Detectar nombres con múltiples variantes para mostrar sub-label en la tarjeta
  const normCounts = new Map();
  for (const c of components) normCounts.set(c.norm, (normCounts.get(c.norm) || 0) + 1);

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
                gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <h2 style="font-family:var(--font-display);font-size:var(--fs-h2);color:var(--text)">
          Tendencias
        </h2>
        <span class="badge-count">${components.length} serie${components.length !== 1 ? "s" : ""}</span>
      </div>
      <div style="display:flex;gap:var(--space-4);align-items:center;flex-wrap:wrap">
        ${legendDot("#C0392B", "Alto")}
        ${legendDot("#D4870A", "Bajo")}
        ${legendDot("#1A7A4A", "Normal")}
        <span style="font-size:var(--fs-xs);color:var(--text-light)">— Límite referencia</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));
                gap:var(--space-5)">
      ${components.map((comp, i) => chartCard(comp, i, patientName || "", normCounts.get(comp.norm) > 1)).join("")}
    </div>`;

  if (window.lucide) lucide.createIcons();

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

function chartCard(comp, i, patientName, hasVariants) {
  // Rango de referencia legible
  let refLabel = "";
  if (comp.lower != null && comp.upper != null)
    refLabel = `Ref: ${comp.lower} – ${comp.upper} ${comp.unit}`;
  else if (comp.upper != null)
    refLabel = `Ref: < ${comp.upper} ${comp.unit}`;
  else if (comp.lower != null)
    refLabel = `Ref: > ${comp.lower} ${comp.unit}`;

  // Si hay variantes del mismo nombre, el sub-label ya incluye el rango;
  // si no, mostrarlo igual para que el doctor vea el rango en la tarjeta.
  const subLabel = refLabel || comp.unit;

  return `
    <div class="card" style="padding:20px;overflow:hidden">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;
                  gap:var(--space-2);margin-bottom:14px">
        <div style="min-width:0">
          <p style="font-weight:700;font-size:13px;color:var(--text);
                    line-height:1.3;white-space:normal;margin:0">
            ${escHtml(comp.displayName)}
          </p>
          <p style="font-size:11px;color:var(--text-light);margin:3px 0 0;line-height:1.4">
            ${escHtml(subLabel)}
          </p>
        </div>
        <button
          class="btn-icon"
          title="Descargar PNG"
          aria-label="Descargar gráfica"
          data-chart="grafica-${i}"
          data-name="${escHtml(comp.displayName)}"
          data-unit="${escHtml(comp.unit)}"
          data-patient="${escHtml(patientName)}"
          onclick="downloadChart(this.dataset.chart, this.dataset.name, this.dataset.unit, this.dataset.patient)"
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

  const STATUS_COLOR = {
    alto:         "#C0392B",
    bajo:         "#D4870A",
    normal:       "#1A7A4A",
    desconocido:  "#8891A0",
    nd:           "#8891A0",
  };

  const pointColors = comp.points.map(p => STATUS_COLOR[p.status] || "#8891A0");

  // ── Escala Y: incluir todos los valores Y las líneas de referencia ──────────
  // Con un margen del 10 % para que nada quede cortado en el borde.
  const allNumbers = [...values];
  if (comp.lower != null) allNumbers.push(comp.lower);
  if (comp.upper != null) allNumbers.push(comp.upper);
  const dataMin = Math.min(...allNumbers);
  const dataMax = Math.max(...allNumbers);
  const padding = (dataMax - dataMin) * 0.15 || Math.abs(dataMax) * 0.15 || 1;
  const yMin = Math.floor((dataMin - padding) * 100) / 100;
  const yMax = Math.ceil( (dataMax + padding) * 100) / 100;

  const datasets = [
    {
      label:                comp.displayName,
      data:                 values,
      borderColor:          "#4A6FA5",
      borderWidth:          2,
      pointBackgroundColor: pointColors,
      pointBorderColor:     "#fff",
      pointBorderWidth:     2,
      pointRadius:          5,
      pointHoverRadius:     7,
      // tension = 0: líneas rectas entre mediciones reales.
      // Una curva suavizada implicaría valores intermedios que NO existen en el estudio.
      tension:              0,
      fill:                 false,
      order:                1,
    },
  ];

  // Líneas de referencia: exactamente en los valores del estudio
  if (comp.upper != null) {
    datasets.push({
      label:       `Límite sup. (${comp.upper} ${comp.unit})`,
      data:        labels.map(() => comp.upper),
      borderColor: "rgba(192,57,43,0.55)",
      borderDash:  [6, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill:        false,
      order:       2,
    });
  }
  if (comp.lower != null) {
    datasets.push({
      label:       `Límite inf. (${comp.lower} ${comp.unit})`,
      data:        labels.map(() => comp.lower),
      borderColor: "rgba(212,135,10,0.55)",
      borderDash:  [6, 4],
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
          filter: item => item.datasetIndex === 0,
          callbacks: {
            title: ctx => ctx[0]?.label ?? "",
            label: ctx => {
              const p      = comp.points[ctx.dataIndex];
              const status = p?.status ?? "desconocido";
              const statusLabel = status === "alto"    ? "↑ ALTO"
                                : status === "bajo"    ? "↓ BAJO"
                                : status === "normal"  ? "Normal"
                                : "Sin clasificar";
              const refStr = (comp.lower != null && comp.upper != null)
                ? `  Ref: ${comp.lower} – ${comp.upper} ${comp.unit}`
                : comp.upper != null ? `  Ref: < ${comp.upper} ${comp.unit}`
                : comp.lower != null ? `  Ref: > ${comp.lower} ${comp.unit}`
                : "";
              return [
                `  ${ctx.raw} ${comp.unit}  [${statusLabel}]`,
                ...(refStr ? [refStr] : []),
              ];
            },
          },
          backgroundColor: "#111318",
          titleFont:    { size: 11, weight: "600" },
          bodyFont:     { size: 12 },
          padding:      12,
          cornerRadius: 8,
          multiKeyBackground: "transparent",
        },
      },
      scales: {
        x: {
          grid:  { color: "rgba(228,230,234,0.5)" },
          ticks: { font: { size: 10 }, color: "#8891A0", maxRotation: 35 },
        },
        y: {
          min:   yMin,
          max:   yMax,
          grid:  { color: "rgba(228,230,234,0.5)" },
          ticks: {
            font:      { size: 10 },
            color:     "#8891A0",
            // Mostrar el número exacto sin redondeo artificial
            callback:  v => Number.isInteger(v) ? v : +v.toFixed(3),
            maxTicksLimit: 6,
          },
        },
      },
    },
  });
}

// ── Descarga PNG ─────────────────────────────────────────────────────────────

function downloadChart(canvasId, componentName, unit, patientName) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const HEADER_H = 72;
  const PAD      = 16;
  const W        = canvas.width;
  const H        = canvas.height;

  const tmp   = document.createElement("canvas");
  tmp.width   = W;
  tmp.height  = H + HEADER_H;
  const ctx   = tmp.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  ctx.strokeStyle = "#e8eaed";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(W, HEADER_H);
  ctx.stroke();

  ctx.fillStyle = "#C0392B";
  ctx.beginPath();
  ctx.arc(PAD + 6, HEADER_H / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  const nameWithUnit = unit ? `${componentName || "Gráfica"} (${unit})` : (componentName || "Gráfica");
  ctx.fillStyle = "#111318";
  ctx.font      = `700 15px Inter, -apple-system, sans-serif`;
  ctx.fillText(nameWithUnit, PAD + 20, HEADER_H / 2 - 7);

  ctx.fillStyle = "#636B78";
  ctx.font      = `500 11px Inter, -apple-system, sans-serif`;
  ctx.fillText(patientName ? `Paciente: ${patientName}` : "", PAD + 20, HEADER_H / 2 + 11);

  const dateStr = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
  ctx.fillStyle = "#9BA3AE";
  ctx.font      = `400 10px Inter, -apple-system, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(dateStr, W - PAD, HEADER_H / 2 + 4);
  ctx.textAlign = "left";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, HEADER_H, W, H);
  ctx.drawImage(canvas, 0, HEADER_H);

  const slug     = s => (s || "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = [slug(patientName), slug(componentName), dateSlug].filter(Boolean).join("_") + ".png";

  const link    = document.createElement("a");
  link.download = filename;
  link.href     = tmp.toDataURL("image/png");
  link.click();
}
