/* BioBlood — Detalle de paciente (Fase 5) */
// Depende de: api.js, utils.js, estudios.js, graficas.js, header.js

// ── Estado ────────────────────────────────────────────────────────────────────
const state = {
  patientId:      null,
  patient:        null,
  studies:        [],
  loading:        true,
  error:          null,
  uploading:      false,
  uploadCurrent:  0,   // which file is being processed (1-based)
  uploadTotal:    0,   // total files in the current batch
  uploadProgress: 0,   // 0-100 for the current file's progress bar
  expandedId:     null,
  pendingFiles:   [],  // [{ id: string, file: File }]
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(window.location.search);
  state.patientId = params.get("id");

  if (!state.patientId) {
    window.location.replace("/pacientes.html");
    return;
  }

  await requireSession();
  render();

  // Carga en paralelo
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
      const returnTo = encodeURIComponent(window.location.href);
      window.location.replace(`/login.html?returnTo=${returnTo}`);
      return null;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      state.error = body.error || `Error ${res.status} al cargar el paciente.`;
      console.error("fetchPatient:", res.status, state.error);
      return null;
    }
    return res.json();
  } catch (err) {
    state.error = "Error de red. Verifica que el servidor esté corriendo.";
    console.error("fetchPatient:", err);
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

// Uploads a single file. Returns { ok, study?, error? }.
async function uploadStudy(file) {
  state.uploadProgress = 0;
  renderUploadSection();

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
    const study = await res.json();
    return { ok: true, study };
  } catch {
    clearInterval(timer);
    return { ok: false, error: "Error de red. Intenta de nuevo." };
  }
}

// Processes all pending files sequentially.
async function confirmUploadAll() {
  if (state.pendingFiles.length === 0) return;

  const batch           = [...state.pendingFiles];
  state.pendingFiles    = [];
  state.uploading       = true;
  state.uploadTotal     = batch.length;
  state.uploadCurrent   = 0;

  const failed = [];
  let anyAdded = false;

  for (let i = 0; i < batch.length; i++) {
    state.uploadCurrent  = i + 1;
    state.uploadProgress = 0;
    renderUploadSection();

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
    state.expandedId = state.studies[0]?.id ?? null;
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
      renderStudiesSection();
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

      <!-- Header del paciente -->
      <div id="patient-header" style="margin-bottom:var(--space-6)"></div>

      <!-- Subida de PDF -->
      <div id="upload-section" style="margin-bottom:var(--space-6)"></div>

      <!-- Resumen IA -->
      <div id="ai-summary-section" style="margin-bottom:var(--space-8)"></div>

      <!-- Lista de estudios -->
      <div id="studies-section"></div>

      <!-- Tabla pivote comparativa (visible con ≥2 estudios) -->
      <div id="pivot-section" style="margin-top:var(--space-8)"></div>

      <!-- Gráficas de tendencia (visible con ≥2 estudios) -->
      <div id="graficas-section" style="margin-top:var(--space-8)"></div>

    </div>
    <div id="toast-container"></div>`;

  if (state.error) {
    renderErrorState();
  } else {
    renderPatientHeader();
    renderUploadSection();
    renderAiSummary();
    renderStudiesSection();
  }
  if (window.lucide) lucide.createIcons();
}

// ── Estado de error ───────────────────────────────────────────────────────────
function renderErrorState() {
  const root = document.getElementById("paciente-root");
  if (!root) return;
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
    </div>
    <div id="toast-container"></div>`;
  if (window.lucide) lucide.createIcons();
}

// ── Header del paciente ───────────────────────────────────────────────────────
function renderPatientHeader() {
  const el = document.getElementById("patient-header");
  if (!el) return;

  if (state.loading) {
    el.innerHTML = `
      <div class="card" style="display:flex;flex-direction:column;gap:var(--space-3)">
        <div class="skeleton skeleton-title" style="width:45%"></div>
        <div class="skeleton skeleton-text"  style="width:65%"></div>
      </div>`;
    return;
  }

  if (!state.patient) return;
  const p       = state.patient;
  const initial = (p.nombre || "?")[0].toUpperCase();

  const metaParts = [
    p.edad     ? `${p.edad} años`  : null,
    p.sexo     || null,
    p.telefono || null,
    p.email    || null,
  ].filter(Boolean);

  const clinicalChips = [
    p.alergias      ? { label: "Alergias",      icon: "alert-triangle", val: p.alergias }      : null,
    p.padecimientos ? { label: "Padecimientos", icon: "heart-pulse",    val: p.padecimientos } : null,
    p.medicamentos  ? { label: "Medicamentos",  icon: "pill",           val: p.medicamentos }  : null,
  ].filter(Boolean);

  el.innerHTML = `
    <div class="card" style="display:flex;align-items:flex-start;gap:var(--space-5)">

      <!-- Avatar -->
      <div style="width:64px;height:64px;border-radius:50%;background:var(--crimson-100);
                  display:flex;align-items:center;justify-content:center;
                  color:var(--crimson);font-weight:800;font-size:26px;
                  font-family:var(--font-display);flex-shrink:0">
        ${initial}
      </div>

      <!-- Info -->
      <div style="flex:1;min-width:0">
        <h1 style="font-family:var(--font-display);font-size:var(--fs-h1);
                   color:var(--text);margin-bottom:var(--space-1)">
          ${escHtml(p.nombre)}
        </h1>

        ${metaParts.length ? `
          <p style="font-size:var(--fs-sm);color:var(--text-light);margin-bottom:var(--space-3)">
            ${metaParts.map(escHtml).join("&ensp;&middot;&ensp;")}
          </p>` : ""}

        ${clinicalChips.length ? `
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
            ${clinicalChips.map(ch => `
              <span class="chip" title="${escHtml(ch.val)}" style="cursor:default">
                <i data-lucide="${ch.icon}" class="icon icon-sm" aria-hidden="true"></i>
                ${ch.label}
              </span>`).join("")}
          </div>` : ""}

        ${p.notas ? `
          <p style="font-size:var(--fs-sm);color:var(--text-muted);
                    margin-top:var(--space-3);font-style:italic">
            ${escHtml(p.notas)}
          </p>` : ""}
      </div>

    </div>`;

  if (window.lucide) lucide.createIcons();
}

// ── Seccion de upload ─────────────────────────────────────────────────────────
function renderUploadSection() {
  const el = document.getElementById("upload-section");
  if (!el || state.loading) return;

  // Estado: analizando archivos
  if (state.uploading) {
    const label = state.uploadTotal > 1
      ? `Analizando archivo ${state.uploadCurrent} de ${state.uploadTotal}...`
      : "Analizando PDF con IA...";
    el.innerHTML = `
      <div class="card">
        <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4)">
          <i data-lucide="loader-2" class="icon icon-md spin"
             style="color:var(--crimson)" aria-hidden="true"></i>
          <span style="font-weight:600;font-size:var(--fs-body);color:var(--text)">${label}</span>
        </div>
        <div class="progress-bar-track" style="margin:0;width:100%">
          <div id="upload-bar-fill" class="progress-bar-fill"
               style="width:${state.uploadProgress}%"></div>
        </div>
        <p style="font-size:var(--fs-xs);color:var(--text-light);
                  margin-top:var(--space-2);text-align:center">
          Extrayendo componentes del laboratorio...
        </p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Estado: hay archivos en la cola
  if (state.pendingFiles.length > 0) {
    const fileRows = state.pendingFiles.map(({ id, file }) => {
      const sizeKb = Math.round(file.size / 1024);
      return `
        <div style="display:flex;align-items:center;gap:var(--space-3);
                    padding:var(--space-3) 0;border-bottom:1px solid var(--border)">
          <div style="width:36px;height:36px;border-radius:var(--radius-md);
                      background:var(--crimson-50);display:flex;align-items:center;
                      justify-content:center;flex-shrink:0">
            <i data-lucide="file-text" class="icon icon-sm"
               style="color:var(--crimson)" aria-hidden="true"></i>
          </div>
          <div style="flex:1;min-width:0">
            <p style="font-weight:600;font-size:var(--fs-sm);color:var(--text);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0">
              ${escHtml(file.name)}
            </p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);margin:2px 0 0">
              ${sizeKb} KB
            </p>
          </div>
          <button class="btn-icon" aria-label="Quitar archivo"
                  onclick="removePendingFile('${id}')">
            <i data-lucide="x" class="icon icon-sm" aria-hidden="true"></i>
          </button>
        </div>`;
    }).join("");

    const n = state.pendingFiles.length;
    el.innerHTML = `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:var(--space-4)">
          <span style="font-weight:700;font-size:var(--fs-body);color:var(--text)">
            ${n} archivo${n !== 1 ? "s" : ""} listo${n !== 1 ? "s" : ""} para analizar
          </span>
          <label style="display:inline-flex;align-items:center;gap:var(--space-2);
                        font-size:var(--fs-sm);color:var(--crimson);font-weight:600;
                        cursor:pointer">
            <i data-lucide="plus" class="icon icon-sm" aria-hidden="true"></i>
            Agregar más
            <input type="file" accept=".pdf,application/pdf" multiple style="display:none"
                   onchange="onFilesInput(this.files); this.value=''" />
          </label>
        </div>

        <div style="max-height:220px;overflow-y:auto;margin-bottom:var(--space-5)">
          ${fileRows}
        </div>

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

  // Estado normal: dropzone
  el.innerHTML = `
    <div
      id="dz"
      class="dropzone"
      role="button"
      tabindex="0"
      aria-label="Subir PDFs de estudios de laboratorio"
      onclick="document.getElementById('pdf-input').click()"
      ondragover="onDragOver(event)"
      ondragleave="onDragLeave()"
      ondrop="onDrop(event)"
      onkeydown="if(event.key==='Enter'||event.key===' ')document.getElementById('pdf-input').click()"
    >
      <div class="dropzone-icon">
        <i data-lucide="upload" class="icon"
           style="width:48px;height:48px;stroke-width:1.5" aria-hidden="true"></i>
      </div>
      <p class="dropzone-title">Sube estudios de laboratorio</p>
      <p class="dropzone-sub">
        Arrastra uno o varios PDFs aquí o haz clic para seleccionar &mdash; max. 20 MB por archivo
      </p>
    </div>
    <input id="pdf-input" type="file" accept=".pdf,application/pdf" multiple
           style="display:none" onchange="onFilesInput(this.files); this.value=''" />`;

  if (window.lucide) lucide.createIcons();
}

// ── Resumen IA ────────────────────────────────────────────────────────────────
const _aiSummaryState = { text: null, loading: false, error: null, loadedForCount: null };

function renderAiSummary() {
  const el = document.getElementById("ai-summary-section");
  if (!el || state.loading) return;

  // Ocultar si no hay estudios
  if (state.studies.length === 0) {
    el.innerHTML = "";
    return;
  }

  // Si ya tenemos el resumen cargado para el mismo número de estudios, solo renderizarlo
  if (_aiSummaryState.text !== null && _aiSummaryState.loadedForCount === state.studies.length) {
    el.innerHTML = buildAiSummaryHtml(_aiSummaryState.text);
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Si hay error previo, mostrar con opción de reintentar
  if (_aiSummaryState.error && _aiSummaryState.loadedForCount === state.studies.length) {
    el.innerHTML = `
      <div class="card" style="border-left:3px solid var(--yellow)">
        <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3)">
          <i data-lucide="bot" class="icon icon-md" style="color:var(--text-muted)" aria-hidden="true"></i>
          <span style="font-weight:700;font-size:var(--fs-body);color:var(--text)">Resumen IA</span>
          <span style="font-size:var(--fs-xs);color:var(--text-muted);padding:2px 8px;
                       background:var(--surface-2);border-radius:999px">Generado con IA</span>
        </div>
        <p style="font-size:var(--fs-sm);color:var(--text-muted);margin-bottom:var(--space-3)">
          ${escHtml(_aiSummaryState.error)}
        </p>
        <button class="btn-ghost" onclick="refreshAiSummary()">
          <i data-lucide="refresh-cw" class="icon icon-sm" aria-hidden="true"></i>
          Reintentar
        </button>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Estado de carga
  el.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3)">
        <i data-lucide="loader-2" class="icon icon-md spin"
           style="color:var(--crimson)" aria-hidden="true"></i>
        <span style="font-weight:700;font-size:var(--fs-body);color:var(--text)">
          Generando resumen de estudios...
        </span>
        <span style="font-size:var(--fs-xs);color:var(--text-muted);padding:2px 8px;
                     background:var(--surface-2);border-radius:999px">Generado con IA</span>
      </div>
      <div class="skeleton skeleton-text" style="width:90%"></div>
      <div class="skeleton skeleton-text" style="width:75%;margin-top:8px"></div>
      <div class="skeleton skeleton-text" style="width:85%;margin-top:8px"></div>
    </div>`;
  if (window.lucide) lucide.createIcons();

  // Cargar resumen si no está en progreso
  if (!_aiSummaryState.loading) {
    _aiSummaryState.loading = true;
    _aiSummaryState.error   = null;
    const countAtLoad = state.studies.length;

    apiFetch("/studies/summary", {
      method: "POST",
      body:   JSON.stringify({ patientId: state.patientId }),
    }).then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      return res.json();
    }).then(data => {
      _aiSummaryState.text            = data.summary;
      _aiSummaryState.loadedForCount  = countAtLoad;
      _aiSummaryState.loading         = false;
      const el2 = document.getElementById("ai-summary-section");
      if (el2) {
        el2.innerHTML = buildAiSummaryHtml(data.summary);
        if (window.lucide) lucide.createIcons();
      }
    }).catch(err => {
      _aiSummaryState.error           = err.message || "No se pudo generar el resumen.";
      _aiSummaryState.loadedForCount  = countAtLoad;
      _aiSummaryState.loading         = false;
      renderAiSummary();
    });
  }
}

function refreshAiSummary() {
  _aiSummaryState.text    = null;
  _aiSummaryState.error   = null;
  _aiSummaryState.loading = false;
  _aiSummaryState.loadedForCount = null;
  renderAiSummary();
}

function buildAiSummaryHtml(text) {
  const escaped = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Split into lines, render bullet lines as <li>, rest as plain text
  const items = escaped.split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const isBullet = line.startsWith("•") || line.startsWith("-");
      const content  = line.replace(/^[•\-]\s*/, "")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/↑/g, '<span style="color:var(--red)">↑</span>')
        .replace(/↓/g, '<span style="color:var(--amber)">↓</span>');
      return isBullet
        ? `<li style="margin-bottom:var(--space-2);line-height:1.55">${content}</li>`
        : `<p style="margin:0 0 var(--space-2)">${content}</p>`;
    });

  const body = items.some(l => l.startsWith("<li"))
    ? `<ul style="margin:0;padding-left:var(--space-5);list-style:disc">${items.join("")}</ul>`
    : items.join("");

  return `
    <div class="card" style="border-left:3px solid var(--crimson)">
      <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4)">
        <i data-lucide="bot" class="icon icon-md" style="color:var(--crimson)" aria-hidden="true"></i>
        <span style="font-weight:700;font-size:var(--fs-body);color:var(--text)">Resumen de estudios</span>
        <span style="font-size:var(--fs-xs);color:var(--crimson);padding:2px 8px;
                     background:var(--crimson-50);border-radius:999px;font-weight:600">
          ✦ Generado con IA
        </span>
        <button class="btn-icon" style="margin-left:auto" title="Actualizar resumen"
                onclick="refreshAiSummary()">
          <i data-lucide="refresh-cw" class="icon icon-sm" aria-hidden="true"></i>
        </button>
      </div>
      <div style="font-size:var(--fs-sm);color:var(--text)">
        ${body}
      </div>
      <p style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:var(--space-4);
                padding-top:var(--space-3);border-top:1px solid var(--border)">
        Generado automáticamente a partir de los datos extraídos del estudio. No constituye consejo médico.
      </p>
    </div>`;
}

// ── Seccion de estudios ───────────────────────────────────────────────────────
function renderStudiesSection() {
  const el = document.getElementById("studies-section");
  if (!el || state.loading) return;

  const count = state.studies.length;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4)">
      <h2 style="font-family:var(--font-display);font-size:var(--fs-h2);color:var(--text)">
        Estudios
      </h2>
      ${count > 0 ? `<span class="badge-count">${count}</span>` : ""}
    </div>
    <div id="studies-list"></div>`;

  renderStudiesList();
  renderPivotTable(state.studies, "pivot-section");
  renderGraficas(state.studies, "graficas-section");
}

function renderStudiesList() {
  const el = document.getElementById("studies-list");
  if (!el) return;

  if (state.studies.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="padding:60px var(--space-8)">
        <div class="empty-state-icon">
          <i data-lucide="flask-conical" class="icon"
             style="width:48px;height:48px;stroke-width:1.5;color:var(--crimson-200)"
             aria-hidden="true"></i>
        </div>
        <h2 style="font-size:var(--fs-h3)">Sin estudios aun</h2>
        <p style="font-size:var(--fs-sm)">
          Sube el primer PDF de laboratorio para comenzar el historial clinico.
        </p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  el.innerHTML = state.studies.map(studyRow).join("");

  // Inyectar componentes del estudio expandido
  if (state.expandedId) {
    const study     = state.studies.find(s => s.id === state.expandedId);
    const container = document.getElementById(`comp-${state.expandedId}`);
    if (study && container) renderComponentCards(study, container);
  }

  if (window.lucide) lucide.createIcons();
}

function studyRow(s) {
  const summary  = getStudySummary(s);
  const expanded = state.expandedId === s.id;
  const altered  = summary.altos + summary.bajos;

  const altBadge = altered > 0
    ? `<span class="badge-status alto">${altered} alterado${altered !== 1 ? "s" : ""}</span>`
    : summary.total > 0
      ? `<span class="badge-status normal">Todo normal</span>`
      : `<span class="badge-status nd">Sin datos</span>`;

  return `
    <div class="card" style="padding:0;margin-bottom:var(--space-3);overflow:hidden">

      <!-- Fila principal (clickable) -->
      <div
        style="display:flex;align-items:center;gap:var(--space-4);
               padding:16px 20px;cursor:pointer;user-select:none"
        onclick="toggleStudy('${s.id}')"
        role="button" tabindex="0"
        aria-expanded="${expanded}"
        onkeydown="if(event.key==='Enter'||event.key===' ')toggleStudy('${s.id}')"
      >
        <!-- Icono -->
        <div style="width:42px;height:42px;border-radius:var(--radius-md);
                    background:var(--crimson-50);display:flex;align-items:center;
                    justify-content:center;flex-shrink:0">
          <i data-lucide="flask-conical" class="icon icon-md"
             style="color:var(--crimson)" aria-hidden="true"></i>
        </div>

        <!-- Fecha y laboratorio -->
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:var(--fs-body);color:var(--text)">
            ${escHtml(s.fecha ? formatDate(s.fecha) : "Sin fecha")}
          </div>
          <div style="font-size:var(--fs-sm);color:var(--text-light);margin-top:2px">
            ${escHtml(s.labName || "Laboratorio")}
            &ensp;&middot;&ensp;
            ${summary.total} componente${summary.total !== 1 ? "s" : ""}
          </div>
        </div>

        <!-- Badge de estado -->
        <div style="flex-shrink:0">${altBadge}</div>

        <!-- Acciones (no propagan el click al row) -->
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0"
             onclick="event.stopPropagation()">
          <button class="btn-icon" style="color:var(--red)"
                  aria-label="Eliminar estudio" title="Eliminar"
                  onclick="confirmDeleteStudy('${s.id}')">
            <i data-lucide="trash-2" class="icon icon-md" aria-hidden="true"></i>
          </button>
          <i data-lucide="${expanded ? "chevron-up" : "chevron-down"}"
             class="icon icon-md" style="color:var(--text-light)" aria-hidden="true"></i>
        </div>
      </div>

      <!-- Panel de componentes (visible al expandir) -->
      ${expanded ? `
        <div style="border-top:1px solid var(--border);padding:20px 20px 24px">
          <div id="comp-${s.id}"></div>
        </div>` : ""}

    </div>`;
}

// ── Interacciones ─────────────────────────────────────────────────────────────
function toggleStudy(id) {
  state.expandedId = state.expandedId === id ? null : id;
  renderStudiesList();
}

function confirmDeleteStudy(id) {
  const study = state.studies.find(s => s.id === id);
  const label = study?.fecha ? formatDate(study.fecha) : "este estudio";
  if (confirm(`Eliminar el estudio del ${label}?\nEsta accion no se puede deshacer.`)) {
    apiDeleteStudy(id);
  }
}

// ── Manejo de archivos ────────────────────────────────────────────────────────

function validateFile(file) {
  if (file.type !== "application/pdf") return "Solo se aceptan archivos PDF.";
  if (file.size > 20 * 1024 * 1024) return "El archivo supera el límite de 20 MB.";
  return null;
}

function onFilesInput(fileList) {
  if (!fileList || fileList.length === 0) return;

  const existingNames = new Set(state.pendingFiles.map(p => p.file.name));
  let rejected = 0;
  let duplicates = 0;

  for (const file of Array.from(fileList)) {
    const err = validateFile(file);
    if (err) { showToast(`${file.name}: ${err}`, "error"); rejected++; continue; }
    if (existingNames.has(file.name)) { duplicates++; continue; }
    state.pendingFiles.push({ id: crypto.randomUUID(), file });
    existingNames.add(file.name);
  }

  if (duplicates > 0) {
    showToast(`${duplicates} archivo${duplicates !== 1 ? "s" : ""} ya estaba${duplicates !== 1 ? "n" : ""} en la lista.`, "error");
  }

  renderUploadSection();
}

function removePendingFile(id) {
  state.pendingFiles = state.pendingFiles.filter(p => p.id !== id);
  renderUploadSection();
}

function clearAllPending() {
  state.pendingFiles = [];
  renderUploadSection();
}

function onDragOver(e) {
  e.preventDefault();
  document.getElementById("dz")?.classList.add("drag-over");
}
function onDragLeave() {
  document.getElementById("dz")?.classList.remove("drag-over");
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById("dz")?.classList.remove("drag-over");
  if (e.dataTransfer?.files?.length) onFilesInput(e.dataTransfer.files);
}

// ── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
