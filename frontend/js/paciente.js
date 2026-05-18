/* BioBlood — Detalle de paciente (Fase 5) */
// Depende de: api.js, utils.js, estudios.js, graficas.js, header.js

// ── Estado ────────────────────────────────────────────────────────────────────
const state = {
  patientId:      null,
  patient:        null,
  studies:        [],
  loading:        true,
  error:          null,   // mensaje de error global
  uploading:      false,
  uploadProgress: 0,
  expandedId:     null,
  pendingFile:    null,
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

async function uploadStudy(file) {
  state.uploading      = true;
  state.uploadProgress = 0;
  state.pendingFile    = null;
  renderUploadSection();

  // Barra de progreso animada (fetch no expone progreso real)
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
      body: JSON.stringify({
        patientId: state.patientId,
        pdfBase64: base64,
        filename:  file.name,
      }),
    });

    clearInterval(timer);
    state.uploadProgress = 100;

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      state.uploading = false;
      renderUploadSection();
      showToast(body.error || "Error al procesar el PDF.", "error");
      return;
    }

    const study = await res.json();
    state.studies.unshift(study);
    state.expandedId = study.id;
    state.uploading  = false;
    render();
    showToast("Estudio analizado y guardado.", "success");

  } catch (_) {
    clearInterval(timer);
    state.uploading      = false;
    state.uploadProgress = 0;
    renderUploadSection();
    showToast("Error de red. Intenta de nuevo.", "error");
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
      <div id="upload-section" style="margin-bottom:var(--space-8)"></div>

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
    p.edad     ? `${p.edad} anos`  : null,
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

  // Estado: subiendo con barra de progreso
  if (state.uploading) {
    el.innerHTML = `
      <div class="card">
        <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4)">
          <i data-lucide="loader-2" class="icon icon-md spin"
             style="color:var(--crimson)" aria-hidden="true"></i>
          <span style="font-weight:600;font-size:var(--fs-body);color:var(--text)">
            Analizando PDF con IA...
          </span>
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

  // Estado: archivo seleccionado, pendiente de confirmar
  if (state.pendingFile) {
    const f      = state.pendingFile;
    const sizeKb = Math.round(f.size / 1024);
    el.innerHTML = `
      <div class="card">
        <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-5)">
          <div style="width:44px;height:44px;border-radius:var(--radius-md);
                      background:var(--crimson-50);display:flex;align-items:center;
                      justify-content:center;flex-shrink:0">
            <i data-lucide="file-text" class="icon icon-lg"
               style="color:var(--crimson)" aria-hidden="true"></i>
          </div>
          <div style="flex:1;min-width:0">
            <p style="font-weight:600;font-size:var(--fs-body);color:var(--text);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${escHtml(f.name)}
            </p>
            <p style="font-size:var(--fs-xs);color:var(--text-light)">${sizeKb} KB</p>
          </div>
          <button class="btn-icon" aria-label="Quitar archivo" onclick="clearPending()">
            <i data-lucide="x" class="icon icon-md" aria-hidden="true"></i>
          </button>
        </div>
        <div style="display:flex;gap:var(--space-3)">
          <button class="btn-ghost" onclick="clearPending()">Cancelar</button>
          <button class="btn-primary" onclick="confirmUpload()">
            <i data-lucide="sparkles" class="icon icon-md" aria-hidden="true"></i>
            Analizar con IA
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
      aria-label="Subir PDF de estudio de laboratorio"
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
      <p class="dropzone-title">Sube un estudio de laboratorio</p>
      <p class="dropzone-sub">
        Arrastra un PDF aqui o haz clic para seleccionar &mdash; max. 20 MB
      </p>
    </div>
    <input id="pdf-input" type="file" accept=".pdf,application/pdf"
           style="display:none" onchange="onFileInput(this.files[0])" />`;

  if (window.lucide) lucide.createIcons();
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
function onFileInput(file) {
  if (!file) return;
  if (file.type !== "application/pdf") {
    showToast("Solo se aceptan archivos PDF.", "error");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast("El archivo supera el limite de 20 MB.", "error");
    return;
  }
  state.pendingFile = file;
  renderUploadSection();
}

function clearPending() {
  state.pendingFile = null;
  renderUploadSection();
}

async function confirmUpload() {
  if (!state.pendingFile) return;
  await uploadStudy(state.pendingFile);
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
  const file = e.dataTransfer?.files?.[0];
  if (file) onFileInput(file);
}

// ── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
