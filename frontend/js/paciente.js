/* BioBlood — Detalle de paciente (Fase 5 · rediseño layout) */
// Depende de: api.js, utils.js, estudios.js, graficas.js, header.js

// ── Estado ────────────────────────────────────────────────────────────────────
const state = {
  patientId:      null,
  patient:        null,
  studies:        [],
  loading:        true,
  error:          null,
  uploading:      false,
  uploadCurrent:  0,
  uploadTotal:    0,
  uploadProgress: 0,
  expandedId:     null,
  pendingFiles:   [],
  activeCategory:    null,
  recentCategories:  new Set(),
  activeTab:         "tipos",    // "tipos" | "archivos"
  openCharts:        new Set(),  // set de component keys con gráfica abierta
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(window.location.search);
  state.patientId = params.get("id");
  if (!state.patientId) { window.location.replace("/pacientes.html"); return; }

  await requireSession();
  render();

  const [patient, studies] = await Promise.all([
    fetchPatient(state.patientId),
    fetchStudies(state.patientId),
  ]);

  state.patient = patient;
  state.studies = studies;
  state.loading = false;
  render();
}

// ── API ───────────────────────────────────────────────────────────────────────
async function fetchPatient(id) {
  try {
    const res = await apiFetch(`/patients/${id}`);
    if (res.status === 401) {
      window.location.replace(`/login.html?returnTo=${encodeURIComponent(window.location.href)}`);
      return null;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      state.error = body.error || `Error ${res.status} al cargar el paciente.`;
      return null;
    }
    return res.json();
  } catch (err) {
    state.error = "Error de red. Verifica que el servidor esté corriendo.";
    return null;
  }
}

async function fetchStudies(patientId) {
  try {
    const res = await apiFetch(`/studies?patientId=${patientId}`);
    if (!res.ok) return [];
    return res.json();
  } catch (_) { return []; }
}

async function uploadStudy(file) {
  state.uploadProgress = 0;
  renderUploadBar();

  const timer = setInterval(() => {
    if (state.uploadProgress < 85) {
      state.uploadProgress += Math.random() * 7;
      const bar = document.getElementById("upload-bar-fill");
      if (bar) bar.style.width = `${Math.min(state.uploadProgress, 85)}%`;
    }
  }, 450);

  try {
    const base64 = await fileToBase64(file);
    const res = await apiFetch("/studies", {
      method: "POST",
      body: JSON.stringify({ patientId: state.patientId, pdfBase64: base64, filename: file.name }),
    });
    clearInterval(timer);
    state.uploadProgress = 100;
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || "Error al procesar el PDF." };
    }
    return { ok: true, study: await res.json() };
  } catch {
    clearInterval(timer);
    return { ok: false, error: "Error de red. Intenta de nuevo." };
  }
}

async function confirmUploadAll() {
  if (state.pendingFiles.length === 0) return;

  const batch = [...state.pendingFiles];
  state.pendingFiles  = [];
  state.uploading     = true;
  state.uploadTotal   = batch.length;
  state.uploadCurrent = 0;

  const failed = [];
  let anyAdded = false;

  for (let i = 0; i < batch.length; i++) {
    state.uploadCurrent  = i + 1;
    state.uploadProgress = 0;
    renderUploadBar();

    const result = await uploadStudy(batch[i].file);
    if (result.ok) {
      state.studies.unshift(result.study);
      anyAdded = true;
    } else {
      failed.push({ name: batch[i].file.name, error: result.error });
    }
  }

  state.uploading     = false;
  state.uploadTotal   = 0;
  state.uploadCurrent = 0;

  if (anyAdded) {
    state.expandedId      = null;
    state.activeCategory  = null;
    state.recentCategories = new Set();
    for (const study of state.studies.slice(0, batch.length))
      for (const comp of (study.components || []))
        state.recentCategories.add(classifyComponent(comp));

    _aiSummaryState.text           = null;
    _aiSummaryState.error          = null;
    _aiSummaryState.loading        = false;
    _aiSummaryState.loadedForCount = null;
  }

  render();

  if (failed.length === 0) {
    const n = batch.length;
    showToast(`${n} estudio${n !== 1 ? "s" : ""} analizado${n !== 1 ? "s" : ""} y guardado${n !== 1 ? "s" : ""}.`, "success");
  } else if (anyAdded) {
    showToast(`${batch.length - failed.length} subido${batch.length - failed.length !== 1 ? "s" : ""}. ${failed.length} fallido${failed.length !== 1 ? "s" : ""}: ${failed.map(f => f.name).join(", ")}`, "error");
  } else {
    showToast(`No se pudo procesar ningún archivo. ${failed[0]?.error ?? ""}`, "error");
  }
}

async function apiDeleteStudy(id) {
  try {
    const res = await apiFetch(`/studies/${id}`, { method: "DELETE" });
    if (res.ok) {
      state.studies    = state.studies.filter(s => s.id !== id);
      state.expandedId = null;
      renderFilesTab();
      showToast("Estudio eliminado.", "success");
    } else {
      showToast("No se pudo eliminar.", "error");
    }
  } catch (_) {
    showToast("Error de red.", "error");
  }
}

// ── Render principal ──────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById("paciente-root");
  if (!root) return;

  if (state.error) { renderErrorState(root); return; }

  root.innerHTML = `
    <div class="page-body">

      <!-- Breadcrumb -->
      <div style="margin-bottom:var(--space-5)">
        <a href="/pacientes.html"
           style="display:inline-flex;align-items:center;gap:var(--space-2);
                  font-size:var(--fs-sm);color:var(--text-muted);text-decoration:none">
          <i data-lucide="arrow-left" class="icon icon-md" aria-hidden="true"></i>
          Pacientes
        </a>
      </div>

      <!-- Layout dos columnas -->
      <div class="pac-detail-layout">

        <!-- ── Sidebar ─────────────────────────────── -->
        <aside class="pac-detail-sidebar">
          <div id="pac-sidebar-card"></div>
          <div id="pac-antecedentes-card" style="margin-top:var(--space-4)"></div>
        </aside>

        <!-- ── Main ───────────────────────────────── -->
        <div class="pac-detail-main">
          <!-- Gráfica salud general -->
          <div id="pac-health-chart" style="margin-bottom:var(--space-4)"></div>

          <!-- Upload bar -->
          <div id="pac-upload-bar" style="margin-bottom:var(--space-4)"></div>

          <!-- Pestañas + contenido -->
          <div id="pac-tabs-section"></div>

          <!-- Panel inline de categoría activa -->
          <div id="pac-category-panel" style="margin-top:var(--space-1)"></div>
        </div>

      </div>

    </div>`;

  if (window.lucide) lucide.createIcons();

  renderSidebar();
  renderHealthChart();
  renderUploadBar();
  renderTabsSection();
}

// ── Error state ───────────────────────────────────────────────────────────────
function renderErrorState(root) {
  root.innerHTML = `
    <div class="page-body">
      <div style="margin-bottom:var(--space-5)">
        <a href="/pacientes.html"
           style="display:inline-flex;align-items:center;gap:var(--space-2);
                  font-size:var(--fs-sm);color:var(--text-muted);text-decoration:none">
          <i data-lucide="arrow-left" class="icon icon-md" aria-hidden="true"></i>
          Volver a pacientes
        </a>
      </div>
      <div class="card" style="text-align:center;padding:60px 40px">
        <div style="margin-bottom:var(--space-4);color:var(--red)">
          <i data-lucide="alert-circle" class="icon" style="width:48px;height:48px;stroke-width:1.5" aria-hidden="true"></i>
        </div>
        <h2 style="font-family:var(--font-display);font-size:var(--fs-h2);color:var(--text);margin-bottom:var(--space-2)">
          No se pudo cargar el paciente
        </h2>
        <p style="font-size:var(--fs-sm);color:var(--text-light);margin-bottom:var(--space-5)">
          ${escHtml(state.error)}
        </p>
        <a href="/pacientes.html" class="btn-primary">
          <i data-lucide="arrow-left" class="icon icon-md" aria-hidden="true"></i>
          Ir a directorio de pacientes
        </a>
      </div>
    </div>`;
  if (window.lucide) lucide.createIcons();
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  renderSidebarCard();
  renderAntecedentes();
}

function renderSidebarCard() {
  const el = document.getElementById("pac-sidebar-card");
  if (!el) return;

  if (state.loading) {
    el.innerHTML = `
      <div class="card" style="display:flex;flex-direction:column;gap:var(--space-3)">
        <div style="display:flex;justify-content:center">
          <div class="skeleton" style="width:60px;height:60px;border-radius:50%"></div>
        </div>
        <div class="skeleton skeleton-title" style="width:70%;margin:0 auto"></div>
        <div class="skeleton skeleton-text"  style="width:50%;margin:0 auto"></div>
      </div>`;
    return;
  }

  const p = state.patient;
  if (!p) return;

  const initial = (p.nombre || "?")[0].toUpperCase();
  const meta = [p.edad ? `${p.edad} años` : null, p.sexo || null].filter(Boolean);
  const totalStudies = state.studies.length;

  el.innerHTML = `
    <div class="card" style="text-align:center;padding:var(--space-6) var(--space-5)">
      <div style="width:60px;height:60px;border-radius:50%;background:var(--crimson-100);
                  display:flex;align-items:center;justify-content:center;
                  color:var(--crimson);font-weight:800;font-size:22px;
                  font-family:var(--font-display);margin:0 auto var(--space-3)">
        ${initial}
      </div>
      <h1 style="font-family:var(--font-display);font-size:var(--fs-h2);color:var(--text);
                 margin-bottom:var(--space-1);line-height:1.2">${escHtml(p.nombre)}</h1>
      ${p.email ? `<p style="font-size:var(--fs-xs);color:var(--text-light);
                              margin-bottom:var(--space-3)">${escHtml(p.email)}</p>` : ""}
      ${meta.length ? `
        <div style="display:flex;justify-content:center;gap:var(--space-2);
                    flex-wrap:wrap;margin-bottom:var(--space-4)">
          ${meta.map(m => `<span class="chip" style="cursor:default">${escHtml(m)}</span>`).join("")}
        </div>` : ""}
      <div class="divider" style="margin:var(--space-4) 0"></div>
      <div style="text-align:left;margin-bottom:var(--space-4)">
        <div style="font-size:10px;color:var(--text-light);text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:4px">Estudios subidos</div>
        <div style="font-size:26px;font-weight:700;color:var(--text);
                    font-family:var(--font-display)">${totalStudies}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        <button class="btn-ghost" style="width:100%;justify-content:center"
                onclick="openEditPatient()">
          <i data-lucide="pencil" class="icon icon-sm" aria-hidden="true"></i>
          Editar paciente
        </button>
        <button class="btn-ghost" style="width:100%;justify-content:center;color:var(--red)"
                onclick="openDeletePatient()">
          <i data-lucide="trash-2" class="icon icon-sm" aria-hidden="true"></i>
          Eliminar
        </button>
      </div>
    </div>`;
  if (window.lucide) lucide.createIcons();
}

function renderAntecedentes() {
  const el = document.getElementById("pac-antecedentes-card");
  if (!el || state.loading || !state.patient) return;

  const p = state.patient;
  const fields = [
    { label: "Padecimientos", val: p.padecimientos },
    { label: "Alergias",      val: p.alergias },
    { label: "Medicamentos",  val: p.medicamentos },
    { label: "Notas",         val: p.notas },
  ].filter(f => f.val);

  if (!fields.length) return;

  el.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:var(--space-2);
                  margin-bottom:var(--space-4);font-weight:600;font-size:var(--fs-body);color:var(--text)">
        <i data-lucide="notes-medical" class="icon icon-md" style="color:var(--crimson)" aria-hidden="true"></i>
        Antecedentes
      </div>
      ${fields.map(f => `
        <div style="margin-bottom:var(--space-3)">
          <div style="font-size:10px;color:var(--text-light);text-transform:uppercase;
                      letter-spacing:.05em;margin-bottom:3px">${f.label}</div>
          <div style="font-size:var(--fs-sm);color:var(--text-muted);line-height:1.5">${escHtml(f.val)}</div>
        </div>`).join("")}
    </div>`;
  if (window.lucide) lucide.createIcons();
}

// ── Gráfica de salud general ──────────────────────────────────────────────────
function renderHealthChart() {
  const el = document.getElementById("pac-health-chart");
  if (!el) return;

  if (state.loading) {
    el.innerHTML = `
      <div class="card">
        <div class="skeleton skeleton-title" style="width:40%;margin-bottom:var(--space-4)"></div>
        <div class="skeleton" style="height:80px;border-radius:var(--radius-md)"></div>
      </div>`;
    return;
  }

  if (!state.studies.length) { el.innerHTML = ""; return; }

  // Calcular índice de salud por estudio (% de componentes en rango)
  const sorted = [...state.studies].sort((a, b) =>
    (a.fecha || "").localeCompare(b.fecha || "")
  );

  const dataPoints = sorted.map(s => {
    const comps = s.components || [];
    if (!comps.length) return null;
    const normales = comps.filter(c => (c.status || "").toLowerCase() === "normal").length;
    return { fecha: s.fecha, pct: Math.round((normales / comps.length) * 100) };
  }).filter(Boolean);

  if (!dataPoints.length) { el.innerHTML = ""; return; }

  // Totales acumulados del último estudio
  const lastStudy   = sorted[sorted.length - 1];
  const allComps    = lastStudy.components || [];
  const enRango     = allComps.filter(c => (c.status || "").toLowerCase() === "normal").length;
  const fueraRango  = allComps.length - enRango;
  const indiceActual = allComps.length ? Math.round((enRango / allComps.length) * 100) : null;

  const summaryCards = indiceActual !== null ? `
    <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4)">
      <div style="background:#EDFAF4;border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);
                  flex:1;text-align:center">
        <div style="font-size:20px;font-weight:700;color:#1E7E4B">${enRango}</div>
        <div style="font-size:10px;color:#1E7E4B;margin-top:2px">en rango</div>
      </div>
      <div style="background:#FEECEC;border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);
                  flex:1;text-align:center">
        <div style="font-size:20px;font-weight:700;color:var(--red)">${fueraRango}</div>
        <div style="font-size:10px;color:var(--red);margin-top:2px">fuera de rango</div>
      </div>
      <div style="background:var(--surface-tint);border-radius:var(--radius-md);
                  padding:var(--space-3) var(--space-4);flex:1;text-align:center">
        <div style="font-size:20px;font-weight:700;color:var(--text)">${indiceActual}%</div>
        <div style="font-size:10px;color:var(--text-light);margin-top:2px">índice actual</div>
      </div>
    </div>` : "";

  el.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:var(--space-2);
                  margin-bottom:var(--space-4);font-weight:600;font-size:var(--fs-body);color:var(--text)">
        <i data-lucide="heart-pulse" class="icon icon-md" style="color:var(--crimson)" aria-hidden="true"></i>
        Tendencia de salud general
        <span style="font-size:var(--fs-xs);color:var(--text-light);font-weight:400;margin-left:4px">
          · % de componentes en rango por estudio
        </span>
      </div>
      ${summaryCards}
      <div style="position:relative;height:90px">
        <canvas id="health-trend-chart"></canvas>
      </div>
      ${dataPoints.length < 2
        ? `<p style="font-size:var(--fs-xs);color:var(--text-light);margin-top:var(--space-2);text-align:center">
             Sube más estudios para ver la tendencia de salud evolucionar.
           </p>`
        : `<p style="font-size:var(--fs-xs);color:var(--text-light);margin-top:var(--space-2)">
             El índice sube cuando más componentes están dentro del rango de referencia.
           </p>`}
    </div>`;

  if (window.lucide) lucide.createIcons();

  // Render con Chart.js después del paint
  requestAnimationFrame(() => {
    const canvas = document.getElementById("health-trend-chart");
    if (!canvas || typeof Chart === "undefined") return;
    const ctx = canvas.getContext("2d");

    const labels = dataPoints.map(d => {
      if (!d.fecha) return "";
      const [y, m] = d.fecha.split("-");
      return new Date(+y, +m - 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
    });
    const values = dataPoints.map(d => d.pct);

    const grad = ctx.createLinearGradient(0, 0, 0, 90);
    grad.addColorStop(0,   "rgba(192,57,43,0.12)");
    grad.addColorStop(1,   "rgba(192,57,43,0.0)");

    new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor:           "rgba(192,57,43,0.80)",
          backgroundColor:       grad,
          borderWidth:           2,
          pointRadius:           4,
          pointBackgroundColor:  "#fff",
          pointBorderColor:      "rgba(192,57,43,0.80)",
          pointBorderWidth:      2,
          pointHoverRadius:      5,
          tension:               0.35,
          fill:                  true,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation:           { duration: 500, easing: "easeOutQuart" },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#111318",
            titleColor:      "#fff",
            bodyColor:       "rgba(255,255,255,0.75)",
            padding:         8,
            cornerRadius:    6,
            callbacks: { label: ctx => ` ${ctx.parsed.y}% en rango` },
          },
        },
        scales: {
          x: {
            grid:   { display: false },
            border: { display: false },
            ticks:  { font: { size: 10 }, color: "#8891A0" },
          },
          y: {
            min:    0,
            max:    100,
            border: { display: false, dash: [4, 4] },
            ticks:  { stepSize: 25, font: { size: 10 }, color: "#8891A0",
                      callback: v => `${v}%` },
            grid:   { color: "rgba(228,230,234,0.6)" },
          },
        },
      },
    });
  });
}

// ── Upload bar ────────────────────────────────────────────────────────────────
function renderUploadBar() {
  const el = document.getElementById("pac-upload-bar");
  if (!el || state.loading) return;

  // Estado: analizando
  if (state.uploading) {
    const label = state.uploadTotal > 1
      ? `Analizando archivo ${state.uploadCurrent} de ${state.uploadTotal}...`
      : "Analizando PDF con IA...";
    el.innerHTML = `
      <div class="card" style="padding:var(--space-4) var(--space-5)">
        <div style="display:flex;align-items:center;gap:var(--space-4)">
          <div style="width:40px;height:40px;border-radius:var(--radius-md);
                      background:var(--crimson-50);display:flex;align-items:center;
                      justify-content:center;flex-shrink:0">
            <i data-lucide="loader-2" class="icon icon-md spin"
               style="color:var(--crimson)" aria-hidden="true"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        margin-bottom:var(--space-2)">
              <span style="font-weight:600;font-size:var(--fs-body);color:var(--text)">${label}</span>
              <span style="font-size:var(--fs-sm);color:var(--crimson);font-weight:600">
                ${Math.round(state.uploadProgress)}%
              </span>
            </div>
            <div class="progress-bar-track" style="margin:0;width:100%">
              <div id="upload-bar-fill" class="progress-bar-fill"
                   style="width:${state.uploadProgress}%"></div>
            </div>
            <p style="font-size:var(--fs-xs);color:var(--text-light);margin-top:var(--space-1)">
              Extrayendo y clasificando componentes con IA · paso 2 de 3
            </p>
          </div>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Estado: archivos en cola
  if (state.pendingFiles.length > 0) {
    const n = state.pendingFiles.length;
    const rows = state.pendingFiles.map(({ id, file }) => {
      const sizeKb = Math.round(file.size / 1024);
      return `
        <div style="display:flex;align-items:center;gap:var(--space-3);
                    padding:var(--space-2) 0;border-bottom:1px solid var(--border)">
          <i data-lucide="file-text" class="icon icon-sm" style="color:var(--crimson);flex-shrink:0" aria-hidden="true"></i>
          <div style="flex:1;min-width:0">
            <p style="font-weight:600;font-size:var(--fs-sm);color:var(--text);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0">
              ${escHtml(file.name)}
            </p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);margin:1px 0 0">${sizeKb} KB</p>
          </div>
          <button class="btn-icon" aria-label="Quitar" onclick="removePendingFile('${id}')">
            <i data-lucide="x" class="icon icon-sm" aria-hidden="true"></i>
          </button>
        </div>`;
    }).join("");

    el.innerHTML = `
      <div class="card" style="padding:var(--space-4) var(--space-5)">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:var(--space-3)">
          <span style="font-weight:600;font-size:var(--fs-body);color:var(--text)">
            ${n} archivo${n !== 1 ? "s" : ""} listo${n !== 1 ? "s" : ""} para analizar
          </span>
          <label style="display:inline-flex;align-items:center;gap:var(--space-2);
                        font-size:var(--fs-sm);color:var(--crimson);font-weight:600;cursor:pointer">
            <i data-lucide="plus" class="icon icon-sm" aria-hidden="true"></i>
            Agregar más
            <input type="file" accept=".pdf,application/pdf" multiple style="display:none"
                   onchange="onFilesInput(this.files); this.value=''" />
          </label>
        </div>
        <div style="max-height:180px;overflow-y:auto;margin-bottom:var(--space-3)">${rows}</div>
        <div style="display:flex;gap:var(--space-3)">
          <button class="btn-ghost" onclick="clearAllPending()">Cancelar</button>
          <button class="btn-primary" onclick="confirmUploadAll()">
            <i data-lucide="sparkles" class="icon icon-md" aria-hidden="true"></i>
            Analizar ${n > 1 ? n + " estudios" : "estudio"} con IA
          </button>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Estado normal: barra con dropzone integrado
  el.innerHTML = `
    <div
      id="pac-upload-zone"
      style="border:1.5px dashed var(--crimson-400);border-radius:var(--radius-lg);
             padding:var(--space-4) var(--space-5);background:var(--crimson-50);
             display:flex;align-items:center;gap:var(--space-4);cursor:pointer;
             transition:border-color .15s,background .15s"
      role="button"
      tabindex="0"
      aria-label="Subir estudios de laboratorio"
      onclick="document.getElementById('pdf-input').click()"
      ondragover="onDragOver(event)"
      ondragleave="onDragLeave()"
      ondrop="onDrop(event)"
      onkeydown="if(event.key==='Enter'||event.key===' ')document.getElementById('pdf-input').click()"
    >
      <div style="width:42px;height:42px;border-radius:var(--radius-md);
                  background:rgba(192,57,43,0.12);display:flex;align-items:center;
                  justify-content:center;flex-shrink:0">
        <i data-lucide="upload" class="icon icon-md" style="color:var(--crimson)" aria-hidden="true"></i>
      </div>
      <div style="flex:1;min-width:0">
        <p style="font-weight:600;font-size:var(--fs-body);color:var(--crimson);margin-bottom:2px">
          Subir nuevo estudio de laboratorio
        </p>
        <p style="font-size:var(--fs-xs);color:var(--text-light);margin:0">
          Arrastra un PDF aquí o haz clic · La IA lo analiza y clasifica automáticamente · máx. 20 MB
        </p>
      </div>
      <button class="btn-primary" style="flex-shrink:0"
              onclick="event.stopPropagation();document.getElementById('pdf-input').click()">
        <i data-lucide="upload" class="icon icon-sm" aria-hidden="true"></i>
        Seleccionar
      </button>
    </div>
    <input id="pdf-input" type="file" accept=".pdf,application/pdf" multiple
           style="display:none" onchange="onFilesInput(this.files); this.value=''" />`;

  if (window.lucide) lucide.createIcons();
}

// ── Pestañas: Tipos / Archivos ────────────────────────────────────────────────
function renderTabsSection() {
  const el = document.getElementById("pac-tabs-section");
  if (!el) return;

  if (state.loading) {
    el.innerHTML = `
      <div class="card">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3)">
          ${[1,2,3,4].map(() => `
            <div class="skeleton" style="height:72px;border-radius:var(--radius-md)"></div>`).join("")}
        </div>
      </div>`;
    return;
  }

  const tabs = [
    { id: "tipos",    icon: "layout-grid",  label: "Tipos de estudio" },
    { id: "archivos", icon: "files",        label: "Todos los archivos" },
  ];

  const tabNav = tabs.map(t => `
    <button
      class="pac-tab${state.activeTab === t.id ? " pac-tab-active" : ""}"
      onclick="switchTab('${t.id}')"
    >
      <i data-lucide="${t.icon}" class="icon icon-sm" aria-hidden="true"></i>
      ${t.label}
    </button>`).join("");

  el.innerHTML = `
    <div>
      <div class="pac-tab-nav">${tabNav}</div>
      <div id="pac-tab-body" class="pac-tab-body"></div>
    </div>`;

  if (window.lucide) lucide.createIcons();
  renderActiveTab();
}

function switchTab(tabId) {
  state.activeTab      = tabId;
  state.activeCategory = null;
  const navEl = document.querySelector(".pac-tab-nav");
  if (navEl) {
    navEl.querySelectorAll(".pac-tab").forEach(btn => {
      btn.classList.toggle("pac-tab-active", btn.textContent.trim().includes(tabId === "tipos" ? "Tipos" : "archivos") ||
        btn.getAttribute("onclick")?.includes(tabId));
    });
  }
  renderActiveTab();
  const panel = document.getElementById("pac-category-panel");
  if (panel) panel.innerHTML = "";
}

function renderActiveTab() {
  if (state.activeTab === "tipos") renderTiposTab();
  else renderFilesTab();
}

// ── Tab: Tipos de estudio ─────────────────────────────────────────────────────
function renderTiposTab() {
  const el = document.getElementById("pac-tab-body");
  if (!el) return;

  if (!state.studies.length) {
    el.innerHTML = `
      <div style="padding:var(--space-8);text-align:center;color:var(--text-light)">
        <i data-lucide="flask-conical" class="icon"
           style="width:40px;height:40px;stroke-width:1.5;color:var(--crimson-200);margin-bottom:var(--space-3)"
           aria-hidden="true"></i>
        <p style="font-size:var(--fs-sm)">Sube el primer estudio para ver los tipos disponibles.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const categoryMap = buildCategoryMap(state.studies);

  const chips = [...categoryMap.entries()].map(([catName, { studies: catStudies, componentCount }]) => {
    const meta   = getPanelMeta(catName);
    const isNew  = state.recentCategories.has(catName);
    const count  = catStudies.length;
    const isActive = state.activeCategory === catName;

    return `
      <button
        class="pac-cat-chip${isActive ? " pac-cat-chip-active" : ""}"
        onclick="selectCategory('${escAttr(catName)}')"
        title="${escHtml(catName)}"
      >
        <div class="pac-cat-icon" style="background:${meta.color}18">
          <i data-lucide="${meta.icon}" style="color:${meta.color};width:16px;height:16px;stroke-width:1.75"
             aria-hidden="true"></i>
        </div>
        <div class="pac-cat-name">${escHtml(catName)}</div>
        <div class="pac-cat-count">${count} estudio${count !== 1 ? "s" : ""}</div>
        ${isNew ? `<span class="pac-cat-badge-new">NUEVO</span>` : ""}
      </button>`;
  }).join("");

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
                gap:var(--space-3);padding:var(--space-4)">
      ${chips}
    </div>`;

  if (window.lucide) lucide.createIcons();
}

// ── Tab: Todos los archivos ───────────────────────────────────────────────────
function renderFilesTab() {
  const el = document.getElementById("pac-tab-body");
  if (!el) return;

  if (!state.studies.length) {
    el.innerHTML = `
      <div style="padding:var(--space-8);text-align:center;color:var(--text-light)">
        <i data-lucide="files" class="icon"
           style="width:40px;height:40px;stroke-width:1.5;color:var(--crimson-200);margin-bottom:var(--space-3)"
           aria-hidden="true"></i>
        <p style="font-size:var(--fs-sm)">No hay archivos subidos todavía.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const rows = state.studies.map(s => {
    const summary = getStudySummary(s);
    const altered = summary.altos + summary.bajos;

    // Categoría principal del estudio (la que tiene más componentes)
    const catCounts = new Map();
    for (const comp of (s.components || [])) {
      const cat = classifyComponent(comp);
      catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    }
    let mainCat = null, maxCount = 0;
    for (const [cat, cnt] of catCounts) if (cnt > maxCount) { maxCount = cnt; mainCat = cat; }
    const meta = mainCat ? getPanelMeta(mainCat) : null;

    const altBadge = altered > 0
      ? `<span style="font-size:10px;font-weight:600;background:#FEECEC;color:var(--red);
                      padding:2px 8px;border-radius:999px">${altered} alterado${altered !== 1 ? "s" : ""}</span>`
      : summary.total > 0
        ? `<span style="font-size:10px;font-weight:600;background:#EDFAF4;color:#1E7E4B;
                        padding:2px 8px;border-radius:999px">Todo normal</span>`
        : "";

    return `
      <div style="display:flex;align-items:center;gap:var(--space-3);
                  padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--border)">
        <i data-lucide="file-text" class="icon icon-md"
           style="color:var(--crimson);flex-shrink:0" aria-hidden="true"></i>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:var(--fs-sm);color:var(--text);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escHtml(s.filename || "Estudio")}
          </div>
          <div style="font-size:var(--fs-xs);color:var(--text-light);margin-top:2px;
                      display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap">
            ${s.fecha ? escHtml(formatDate(s.fecha)) : "Sin fecha"}
            · ${summary.total} componente${summary.total !== 1 ? "s" : ""}
            ${meta ? `· <span style="background:${meta.color}18;color:${meta.color};
                             font-size:10px;font-weight:600;padding:1px 7px;
                             border-radius:999px">${escHtml(mainCat)}</span>` : ""}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2);flex-shrink:0">
          ${altBadge}
          <button class="btn-icon" style="color:var(--red)"
                  aria-label="Eliminar estudio"
                  onclick="confirmDeleteStudy('${s.id}')">
            <i data-lucide="trash-2" class="icon icon-sm" aria-hidden="true"></i>
          </button>
        </div>
      </div>`;
  }).join("");

  el.innerHTML = `
    <div>
      ${rows}
    </div>`;

  if (window.lucide) lucide.createIcons();
}

// ── Panel inline de categoría ─────────────────────────────────────────────────
const _aiSummaryState = { text: null, loading: false, error: null, loadedForCount: null, forCategory: null };

function selectCategory(catName) {
  if (state.activeCategory === catName) {
    // Toggle: cerrar si ya está abierta
    state.activeCategory = null;
    state.openCharts     = new Set();
    const panel = document.getElementById("pac-category-panel");
    if (panel) panel.innerHTML = "";
    renderTiposTab();
    return;
  }

  state.activeCategory = catName;
  state.openCharts     = new Set();
  renderTiposTab();
  renderCategoryPanel();
}

function renderCategoryPanel() {
  const el = document.getElementById("pac-category-panel");
  if (!el || !state.activeCategory) { if (el) el.innerHTML = ""; return; }

  const cat     = state.activeCategory;
  const meta    = getPanelMeta(cat);
  const filtered = state.studies
    .map(s => ({
      ...s,
      components: (s.components || []).filter(c => classifyComponent(c) === cat),
    }))
    .filter(s => s.components.length > 0);

  if (!filtered.length) {
    el.innerHTML = `
      <div class="card" style="border-top:2px solid ${meta.color};text-align:center;
                               padding:var(--space-6)">
        <p style="color:var(--text-light);font-size:var(--fs-sm)">
          No hay componentes de "${escHtml(cat)}" en los estudios.
        </p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="card" style="border-top:2px solid ${meta.color};padding:0;overflow:hidden">

      <!-- Header del panel -->
      <div style="display:flex;align-items:center;gap:var(--space-3);
                  padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--border)">
        <div style="width:34px;height:34px;border-radius:var(--radius-md);
                    background:${meta.color}18;display:flex;align-items:center;
                    justify-content:center;flex-shrink:0">
          <i data-lucide="${meta.icon}" style="width:16px;height:16px;stroke-width:1.75;color:${meta.color}"
             aria-hidden="true"></i>
        </div>
        <div>
          <div style="font-weight:700;font-size:var(--fs-body);color:var(--text)">${escHtml(cat)}</div>
          <div style="font-size:var(--fs-xs);color:var(--text-light)">
            ${filtered.length} estudio${filtered.length !== 1 ? "s" : ""} encontrado${filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button class="btn-icon" style="margin-left:auto;border:1px solid var(--border)"
                onclick="selectCategory('${escAttr(cat)}')" aria-label="Cerrar panel">
          <i data-lucide="x" class="icon icon-sm" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Resumen IA -->
      <div id="pac-ai-summary" style="padding:var(--space-4) var(--space-5);
                                       border-bottom:1px solid var(--border)">
        ${buildAiSummaryLoading()}
      </div>

      <!-- Filtros + Tabla pivote -->
      <div style="padding:var(--space-4) var(--space-5)">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">
          <div style="font-weight:600;font-size:var(--fs-body);color:var(--text);
                      display:flex;align-items:center;gap:var(--space-2)">
            <i data-lucide="table-2" class="icon icon-sm" aria-hidden="true"></i>
            Tabla comparativa
          </div>
          <div style="display:flex;gap:var(--space-2)" id="pivot-filter-btns">
            <button class="btn-ghost pivot-filter-btn pivot-filter-active"
                    style="font-size:var(--fs-xs);padding:4px 12px"
                    onclick="setPivotFilter('todos')">Todos</button>
            <button class="btn-ghost pivot-filter-btn"
                    style="font-size:var(--fs-xs);padding:4px 12px"
                    onclick="setPivotFilter('alterados')">Fuera de rango</button>
          </div>
        </div>
        <div id="pac-pivot-section"></div>
      </div>

      <!-- Gráficas individuales -->
      <div id="pac-graficas-section" style="padding:0 var(--space-5) var(--space-5)"></div>

    </div>`;

  if (window.lucide) lucide.createIcons();

  // Render tabla y gráficas reutilizando funciones existentes
  renderPivotTable(filtered, "pac-pivot-section");
  renderGraficas(filtered, "pac-graficas-section", state.patient?.nombre || "");

  // Cargar resumen IA
  loadAiSummaryForCategory(cat, filtered);
}

// ── Resumen IA ────────────────────────────────────────────────────────────────
function buildAiSummaryLoading() {
  return `
    <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3)">
      <i data-lucide="loader-2" class="icon icon-sm spin" style="color:var(--crimson)" aria-hidden="true"></i>
      <span style="font-weight:600;font-size:var(--fs-sm);color:var(--text)">Generando análisis IA...</span>
      <span style="font-size:10px;color:var(--crimson);padding:2px 8px;
                   background:var(--crimson-50);border-radius:999px;font-weight:600">✦ IA</span>
    </div>
    <div class="skeleton skeleton-text" style="width:90%"></div>
    <div class="skeleton skeleton-text" style="width:75%;margin-top:6px"></div>
    <div class="skeleton skeleton-text" style="width:82%;margin-top:6px"></div>`;
}

function loadAiSummaryForCategory(cat, filteredStudies) {
  if (_aiSummaryState.loading) return;

  // Reusar si ya tenemos el resumen para esta categoría y mismo número de estudios
  if (_aiSummaryState.text &&
      _aiSummaryState.forCategory === cat &&
      _aiSummaryState.loadedForCount === filteredStudies.length) {
    const el = document.getElementById("pac-ai-summary");
    if (el) { el.innerHTML = buildAiSummaryHtml(_aiSummaryState.text); if (window.lucide) lucide.createIcons(); }
    return;
  }

  _aiSummaryState.loading     = true;
  _aiSummaryState.error       = null;
  _aiSummaryState.forCategory = cat;
  const countAtLoad = filteredStudies.length;

  apiFetch("/studies/summary", {
    method: "POST",
    body:   JSON.stringify({ patientId: state.patientId }),
  }).then(async res => {
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Error ${res.status}`); }
    return res.json();
  }).then(data => {
    _aiSummaryState.text            = data.summary;
    _aiSummaryState.loadedForCount  = countAtLoad;
    _aiSummaryState.loading         = false;
    const el = document.getElementById("pac-ai-summary");
    if (el) { el.innerHTML = buildAiSummaryHtml(data.summary); if (window.lucide) lucide.createIcons(); }
  }).catch(err => {
    _aiSummaryState.error           = err.message || "No se pudo generar el resumen.";
    _aiSummaryState.loading         = false;
    const el = document.getElementById("pac-ai-summary");
    if (el) {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <i data-lucide="alert-circle" class="icon icon-sm" style="color:var(--amber)" aria-hidden="true"></i>
          <span style="font-size:var(--fs-sm);color:var(--text-muted)">${escHtml(_aiSummaryState.error)}</span>
          <button class="btn-ghost" style="font-size:var(--fs-xs);margin-left:auto"
                  onclick="loadAiSummaryForCategory('${escAttr(cat)}', [])">
            <i data-lucide="refresh-cw" class="icon icon-sm" aria-hidden="true"></i> Reintentar
          </button>
        </div>`;
      if (window.lucide) lucide.createIcons();
    }
  });
}

function buildAiSummaryHtml(text) {
  const escaped = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const items = escaped.split("\n")
    .map(line => line.trim()).filter(Boolean)
    .map(line => {
      const isBullet = line.startsWith("•") || line.startsWith("-");
      const content  = line.replace(/^[•\-]\s*/, "")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/↑/g, `<span style="color:var(--red)">↑</span>`)
        .replace(/↓/g, `<span style="color:var(--amber)">↓</span>`);
      return isBullet
        ? `<li style="margin-bottom:6px;line-height:1.55">${content}</li>`
        : `<p style="margin:0 0 6px">${content}</p>`;
    });

  const body = items.some(l => l.startsWith("<li"))
    ? `<ul style="margin:0;padding-left:var(--space-5);list-style:disc">${items.join("")}</ul>`
    : items.join("");

  return `
    <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3)">
      <i data-lucide="sparkles" class="icon icon-sm" style="color:var(--crimson)" aria-hidden="true"></i>
      <span style="font-weight:600;font-size:var(--fs-sm);color:var(--text)">Análisis IA</span>
      <span style="font-size:10px;color:var(--crimson);padding:2px 8px;
                   background:var(--crimson-50);border-radius:999px;font-weight:600">✦ IA</span>
      <button class="btn-icon" style="margin-left:auto" title="Actualizar"
              onclick="refreshAiSummary()">
        <i data-lucide="refresh-cw" class="icon icon-sm" aria-hidden="true"></i>
      </button>
    </div>
    <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">${body}</div>
    <p style="font-size:10px;color:var(--text-light);margin-top:var(--space-3);
              padding-top:var(--space-2);border-top:1px solid var(--border)">
      Generado automáticamente · No constituye consejo médico.
    </p>`;
}

function refreshAiSummary() {
  _aiSummaryState.text    = null;
  _aiSummaryState.error   = null;
  _aiSummaryState.loading = false;
  _aiSummaryState.loadedForCount = null;
  const el = document.getElementById("pac-ai-summary");
  if (el && state.activeCategory) {
    el.innerHTML = buildAiSummaryLoading();
    if (window.lucide) lucide.createIcons();
    const filtered = state.studies
      .map(s => ({ ...s, components: (s.components || []).filter(c => classifyComponent(c) === state.activeCategory) }))
      .filter(s => s.components.length > 0);
    loadAiSummaryForCategory(state.activeCategory, filtered);
  }
}

// ── Filtro de tabla pivote (Todos / Fuera de rango) ──────────────────────────
let _pivotFilter = "todos";

function setPivotFilter(filter) {
  _pivotFilter = filter;

  // Actualizar botones activos
  document.querySelectorAll(".pivot-filter-btn").forEach(btn => {
    const isActive = btn.getAttribute("onclick")?.includes(filter);
    btn.classList.toggle("pivot-filter-active", isActive);
  });

  // Re-render tabla con el filtro
  if (!state.activeCategory) return;
  const cat = state.activeCategory;
  let filtered = state.studies
    .map(s => ({
      ...s,
      components: (s.components || []).filter(c => classifyComponent(c) === cat),
    }))
    .filter(s => s.components.length > 0);

  if (filter === "alterados") {
    filtered = filtered.map(s => ({
      ...s,
      components: s.components.filter(c => {
        const st = (c.status || "").toLowerCase();
        return st === "alto" || st === "bajo";
      }),
    })).filter(s => s.components.length > 0);
  }

  renderPivotTable(filtered, "pac-pivot-section");
}

// ── Interacciones de archivos ─────────────────────────────────────────────────
function validateFile(file) {
  if (file.type !== "application/pdf") return "Solo se aceptan archivos PDF.";
  if (file.size > 20 * 1024 * 1024)   return "El archivo supera el límite de 20 MB.";
  return null;
}

function onFilesInput(fileList) {
  if (!fileList || fileList.length === 0) return;
  const existingNames = new Set(state.pendingFiles.map(p => p.file.name));
  let rejected = 0, duplicates = 0;
  for (const file of Array.from(fileList)) {
    const err = validateFile(file);
    if (err) { showToast(`${file.name}: ${err}`, "error"); rejected++; continue; }
    if (existingNames.has(file.name)) { duplicates++; continue; }
    state.pendingFiles.push({ id: crypto.randomUUID(), file });
    existingNames.add(file.name);
  }
  if (duplicates > 0)
    showToast(`${duplicates} archivo${duplicates !== 1 ? "s" : ""} ya estaba${duplicates !== 1 ? "n" : ""} en la lista.`, "error");
  renderUploadBar();
}

function removePendingFile(id) {
  state.pendingFiles = state.pendingFiles.filter(p => p.id !== id);
  renderUploadBar();
}

function clearAllPending() {
  state.pendingFiles = [];
  renderUploadBar();
}

function onDragOver(e) {
  e.preventDefault();
  document.getElementById("pac-upload-zone")?.classList.add("drag-over");
}
function onDragLeave() {
  document.getElementById("pac-upload-zone")?.classList.remove("drag-over");
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById("pac-upload-zone")?.classList.remove("drag-over");
  if (e.dataTransfer?.files?.length) onFilesInput(e.dataTransfer.files);
}

function confirmDeleteStudy(id) {
  const study = state.studies.find(s => s.id === id);
  const label = study?.fecha ? formatDate(study.fecha) : "este estudio";
  if (confirm(`¿Eliminar el estudio del ${label}?\nEsta acción no se puede deshacer.`))
    apiDeleteStudy(id);
}

// ── Editar / Eliminar paciente (stubs — usan modal existente de pacientes) ────
function openEditPatient() {
  showToast("Edita este paciente desde el directorio de pacientes.", "");
}
function openDeletePatient() {
  if (confirm("¿Eliminar este paciente y todos sus estudios? Esta acción no se puede deshacer.")) {
    apiFetch(`/patients/${state.patientId}`, { method: "DELETE" })
      .then(r => {
        if (r.ok || r.status === 204) window.location.replace("/pacientes.html");
        else showToast("No se pudo eliminar el paciente.", "error");
      }).catch(() => showToast("Error de red.", "error"));
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch (_) { return dateStr; }
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

function escAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
