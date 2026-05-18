/* BioBlood — Directorio de pacientes (Fase 4) */

// ── Estado ────────────────────────────────────────────────────────────────────
const state = {
  patients: [],
  search:   "",
  loading:  true,
  modal:    null,  // null | "add" | "edit" | "delete"
  editing:  null,  // patient object al editar
  saving:   false,
};

// ── Arranque ──────────────────────────────────────────────────────────────────
async function init() {
  await requireSession();
  render();
  await fetchPatients();
}

// ── API ───────────────────────────────────────────────────────────────────────
async function fetchPatients() {
  state.loading = true;
  renderList();
  try {
    const res = await apiFetch("/patients");
    if (res.ok) state.patients = await res.json();
  } catch (_) {}
  state.loading = false;
  renderList();
}

async function apiSavePatient(data) {
  const isEdit = !!state.editing;
  const url    = isEdit ? `/patients/${state.editing.id}` : "/patients";
  const method = isEdit ? "PUT" : "POST";
  return apiFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function apiDeletePatient(id) {
  const res = await apiFetch(`/patients/${id}`, { method: "DELETE" });
  return res.ok;
}

// ── Render principal ──────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById("pacientes-root");
  if (!root) return;

  root.innerHTML = `
    <div class="page-body">

      <!-- Cabecera de página -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);margin-bottom:var(--space-6)">
        <div>
          <h1 style="font-family:var(--font-display);font-size:var(--fs-h1);color:var(--text);margin-bottom:4px">
            Pacientes
          </h1>
          <p id="pac-count" style="font-size:var(--fs-sm);color:var(--text-light)">Cargando...</p>
        </div>
        <button class="btn-primary" onclick="openAddModal()">
          <i data-lucide="plus" class="icon icon-md" aria-hidden="true"></i>
          Nuevo paciente
        </button>
      </div>

      <!-- Buscador -->
      <div style="margin-bottom:var(--space-5)">
        <div class="search-wrapper" style="max-width:420px">
          <i data-lucide="search" class="icon icon-md search-icon" aria-hidden="true"></i>
          <input
            id="pac-search"
            class="search-bar"
            type="search"
            placeholder="Buscar por nombre o correo..."
            aria-label="Buscar paciente"
            oninput="handleSearch(this.value)"
          />
        </div>
      </div>

      <!-- Lista -->
      <div id="pac-list"></div>

    </div>

    <!-- Modal container -->
    <div id="pac-modal"></div>

    <!-- Toasts -->
    <div id="toast-container"></div>
  `;

  if (window.lucide) lucide.createIcons();
  renderList();
}

// ── Render lista ──────────────────────────────────────────────────────────────
function renderList() {
  const listEl  = document.getElementById("pac-list");
  const countEl = document.getElementById("pac-count");
  if (!listEl) return;

  // Skeleton mientras carga
  if (state.loading) {
    listEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${[1, 2, 3, 4, 5].map(() => `<div class="skeleton skeleton-row"></div>`).join("")}
      </div>`;
    if (countEl) countEl.textContent = "Cargando...";
    return;
  }

  // Filtrar por búsqueda
  const q = state.search.toLowerCase().trim();
  const filtered = q
    ? state.patients.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
      )
    : state.patients;

  // Contador
  if (countEl) {
    const total = state.patients.length;
    if (total === 0) {
      countEl.textContent = "Sin pacientes aún";
    } else {
      countEl.textContent = `${total} paciente${total !== 1 ? "s" : ""}` +
        (q ? ` · ${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}` : "");
    }
  }

  // Empty state — sin ningún paciente
  if (state.patients.length === 0) {
    listEl.innerHTML = `
      <div class="card" style="margin-top:var(--space-2)">
        <div class="empty-state">
          <div class="empty-state-icon">
            <i data-lucide="users" class="icon" style="width:56px;height:56px;stroke-width:1.5;color:var(--crimson-200)" aria-hidden="true"></i>
          </div>
          <h2>Sin pacientes aún</h2>
          <p>Agrega tu primer paciente para empezar a registrar estudios de laboratorio.</p>
          <button class="btn-primary" onclick="openAddModal()">
            <i data-lucide="plus" class="icon icon-md" aria-hidden="true"></i>
            Agregar paciente
          </button>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Sin resultados de búsqueda
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:60px var(--space-8)">
        <div class="empty-state-icon">
          <i data-lucide="search-x" class="icon" style="width:40px;height:40px;stroke-width:1.5;color:var(--text-light)" aria-hidden="true"></i>
        </div>
        <h2 style="font-size:var(--fs-h3)">Sin resultados</h2>
        <p style="font-size:var(--fs-sm)">Ningún paciente coincide con "<strong>${escHtml(state.search)}</strong>".</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Lista de pacientes
  listEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-2)">
      ${filtered.map(patientRow).join("")}
    </div>`;
  if (window.lucide) lucide.createIcons();
}

function patientRow(p) {
  const initial  = (p.nombre || "?")[0].toUpperCase();
  const meta     = [
    p.edad ? `${p.edad} años` : null,
    p.sexo || null,
  ].filter(Boolean).join(" · ");
  const ultimoTxt = p.ultimoEstudio ? formatDate(p.ultimoEstudio) : "Sin estudios";
  const ultimoColor = p.ultimoEstudio ? "var(--text)" : "var(--text-light)";

  // Serializar el objeto para pasarlo al modal de edición de forma segura
  const pJson = escAttr(JSON.stringify(p));

  return `
    <div
      class="card-list"
      role="button"
      tabindex="0"
      aria-label="Ver paciente ${escHtml(p.nombre)}"
      onclick="goToPatient('${p.id}')"
      onkeydown="if(event.key==='Enter'||event.key===' ')goToPatient('${p.id}')"
      style="border:1px solid var(--border)"
    >
      <!-- Avatar -->
      <div style="width:42px;height:42px;border-radius:50%;background:var(--crimson-100);
                  display:flex;align-items:center;justify-content:center;
                  color:var(--crimson);font-weight:700;font-size:15px;flex-shrink:0">
        ${initial}
      </div>

      <!-- Nombre + meta -->
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:var(--fs-body);color:var(--text);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escHtml(p.nombre)}
        </div>
        <div style="font-size:var(--fs-sm);color:var(--text-light);margin-top:2px">
          ${meta || "&nbsp;"}
        </div>
      </div>

      <!-- Último estudio -->
      <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:3px">
        <span style="font-size:var(--fs-xs);color:var(--text-light)">Último estudio</span>
        <span style="font-size:var(--fs-sm);font-weight:500;color:${ultimoColor}">${ultimoTxt}</span>
      </div>

      <!-- Acciones (no propagan click al row) -->
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
        <button
          class="btn-icon"
          aria-label="Editar ${escHtml(p.nombre)}"
          title="Editar"
          onclick="openEditModal('${p.id}')"
        >
          <i data-lucide="pencil" class="icon icon-md" aria-hidden="true"></i>
        </button>
        <button
          class="btn-icon"
          aria-label="Eliminar ${escHtml(p.nombre)}"
          title="Eliminar"
          style="color:var(--red)"
          onclick="openDeleteModal('${p.id}','${escAttr(p.nombre)}')"
        >
          <i data-lucide="trash-2" class="icon icon-md" aria-hidden="true"></i>
        </button>
        <i data-lucide="chevron-right" class="icon icon-md" style="color:var(--text-light)" aria-hidden="true"></i>
      </div>
    </div>`;
}

// ── Modal agregar / editar ────────────────────────────────────────────────────
function openAddModal() {
  state.modal   = "add";
  state.editing = null;
  state.saving  = false;
  renderFormModal();
}

function openEditModal(id) {
  const p = state.patients.find(x => x.id === id);
  if (!p) return;
  state.modal   = "edit";
  state.editing = p;
  state.saving  = false;
  renderFormModal();
}

function closeModal() {
  state.modal   = null;
  state.editing = null;
  const el = document.getElementById("pac-modal");
  if (el) el.innerHTML = "";
}

function renderFormModal() {
  const isEdit = state.modal === "edit";
  const p      = state.editing || {};
  const title  = isEdit ? "Editar paciente" : "Nuevo paciente";
  const btnTxt = isEdit ? "Guardar cambios" : "Crear paciente";

  const modalEl = document.getElementById("pac-modal");
  if (!modalEl) return;

  modalEl.innerHTML = `
    <div class="modal-overlay"
         role="dialog" aria-modal="true" aria-labelledby="modal-title"
         onclick="if(event.target===this)closeModal()">
      <div class="modal-card">

        <div class="modal-header">
          <div>
            <h2 id="modal-title"
                style="font-size:var(--fs-h2);font-family:var(--font-display);color:var(--text)">
              ${title}
            </h2>
            ${isEdit
              ? `<p style="font-size:var(--fs-sm);color:var(--text-light);margin-top:4px">${escHtml(p.nombre)}</p>`
              : ""}
          </div>
          <button class="btn-icon" aria-label="Cerrar" onclick="closeModal()">
            <i data-lucide="x" class="icon icon-md" aria-hidden="true"></i>
          </button>
        </div>

        <div class="modal-body">

          <!-- Error inline -->
          <div id="modal-error" style="display:none;margin-bottom:var(--space-4)"></div>

          <!-- Datos básicos -->
          <p class="uppercase-label" style="margin-bottom:var(--space-4)">Datos básicos</p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 var(--space-4)">

            <div class="form-field" style="grid-column:1/-1">
              <label class="form-label" for="f-nombre">
                Nombre completo <span style="color:var(--red)">*</span>
              </label>
              <input id="f-nombre" class="form-input" type="text"
                     placeholder="Ej. María López Ruiz"
                     value="${escHtml(p.nombre || "")}" />
            </div>

            <div class="form-field">
              <label class="form-label" for="f-edad">Edad</label>
              <input id="f-edad" class="form-input" type="number"
                     min="0" max="150" placeholder="45"
                     value="${p.edad ?? ""}" />
            </div>

            <div class="form-field">
              <label class="form-label" for="f-sexo">Sexo</label>
              <select id="f-sexo" class="form-select">
                <option value="">Sin especificar</option>
                <option value="Masculino"  ${p.sexo === "Masculino"  ? "selected" : ""}>Masculino</option>
                <option value="Femenino"   ${p.sexo === "Femenino"   ? "selected" : ""}>Femenino</option>
                <option value="Otro"       ${p.sexo === "Otro"       ? "selected" : ""}>Otro</option>
              </select>
            </div>

            <div class="form-field">
              <label class="form-label" for="f-tel">Teléfono</label>
              <input id="f-tel" class="form-input" type="tel"
                     placeholder="55 1234 5678"
                     value="${escHtml(p.telefono || "")}" />
            </div>

            <div class="form-field">
              <label class="form-label" for="f-email">Correo</label>
              <input id="f-email" class="form-input" type="email"
                     placeholder="paciente@email.com"
                     value="${escHtml(p.email || "")}" />
            </div>

          </div>

          <div class="divider"></div>

          <!-- Historial clínico -->
          <p class="uppercase-label" style="margin-bottom:var(--space-4)">Historial clínico</p>

          <div class="form-field">
            <label class="form-label" for="f-alergias">Alergias</label>
            <textarea id="f-alergias" class="form-textarea"
                      placeholder="Penicilina, mariscos...">${escHtml(p.alergias || "")}</textarea>
          </div>

          <div class="form-field">
            <label class="form-label" for="f-padecimientos">Padecimientos</label>
            <textarea id="f-padecimientos" class="form-textarea"
                      placeholder="Diabetes tipo 2, hipertensión...">${escHtml(p.padecimientos || "")}</textarea>
          </div>

          <div class="form-field">
            <label class="form-label" for="f-medicamentos">Medicamentos</label>
            <textarea id="f-medicamentos" class="form-textarea"
                      placeholder="Metformina 500mg...">${escHtml(p.medicamentos || "")}</textarea>
          </div>

          <div class="form-field" style="margin-bottom:0">
            <label class="form-label" for="f-notas">Notas clínicas</label>
            <textarea id="f-notas" class="form-textarea"
                      placeholder="Antecedentes relevantes...">${escHtml(p.notas || "")}</textarea>
          </div>

        </div>

        <div class="modal-footer">
          <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
          <button id="btn-save" class="btn-primary" onclick="handleSave()">
            ${btnTxt}
          </button>
        </div>

      </div>
    </div>`;

  if (window.lucide) lucide.createIcons();
  setTimeout(() => document.getElementById("f-nombre")?.focus(), 50);
}

async function handleSave() {
  if (state.saving) return;

  const nombre = (document.getElementById("f-nombre")?.value || "").trim();
  if (!nombre) {
    showModalError("El nombre es requerido.");
    document.getElementById("f-nombre")?.focus();
    return;
  }

  const data = {
    nombre,
    edad:          document.getElementById("f-edad")?.value        || null,
    sexo:          document.getElementById("f-sexo")?.value        || null,
    telefono:      (document.getElementById("f-tel")?.value   || "").trim() || null,
    email:         (document.getElementById("f-email")?.value || "").trim() || null,
    alergias:      document.getElementById("f-alergias")?.value      || "",
    padecimientos: document.getElementById("f-padecimientos")?.value || "",
    medicamentos:  document.getElementById("f-medicamentos")?.value  || "",
    notas:         document.getElementById("f-notas")?.value         || "",
  };
  if (data.edad) data.edad = Number(data.edad);

  // UI de carga
  state.saving = true;
  const btnTxt = state.modal === "edit" ? "Guardar cambios" : "Crear paciente";
  const btn    = document.getElementById("btn-save");
  if (btn) {
    btn.disabled  = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="icon icon-md spin" aria-hidden="true"></i> Guardando...`;
    if (window.lucide) lucide.createIcons();
  }

  try {
    const res = await apiSavePatient(data);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showModalError(body.error || "Error al guardar el paciente.");
      state.saving = false;
      if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
      return;
    }

    const saved = await res.json();

    if (state.modal === "edit") {
      state.patients = state.patients.map(p => p.id === saved.id ? saved : p);
      showToast("Paciente actualizado.", "success");
    } else {
      state.patients.unshift(saved);
      showToast("Paciente creado.", "success");
    }

    closeModal();
    renderList();

  } catch (_) {
    showModalError("Error de red. Intenta de nuevo.");
    state.saving = false;
    if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
  }
}

function showModalError(msg) {
  const el = document.getElementById("modal-error");
  if (!el) return;
  el.style.display = "block";
  el.innerHTML = `
    <div class="alert alert-error" role="alert">
      <i data-lucide="alert-circle" class="icon icon-md" aria-hidden="true"></i>
      <span>${escHtml(msg)}</span>
    </div>`;
  if (window.lucide) lucide.createIcons();
}

// ── Modal eliminar ────────────────────────────────────────────────────────────
function openDeleteModal(id, nombre) {
  state.modal   = "delete";
  state.editing = { id };

  const modalEl = document.getElementById("pac-modal");
  if (!modalEl) return;

  modalEl.innerHTML = `
    <div class="modal-overlay"
         role="dialog" aria-modal="true" aria-labelledby="del-title"
         onclick="if(event.target===this)closeModal()">
      <div class="modal-card" style="width:min(440px,100%)">

        <div class="modal-header">
          <h2 id="del-title"
              style="font-size:var(--fs-h3);font-weight:700;color:var(--text)">
            Eliminar paciente
          </h2>
          <button class="btn-icon" aria-label="Cerrar" onclick="closeModal()">
            <i data-lucide="x" class="icon icon-md" aria-hidden="true"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="alert alert-error" style="margin-bottom:var(--space-5)">
            <i data-lucide="alert-triangle" class="icon icon-md" aria-hidden="true"></i>
            <span>Esta acción es irreversible. Se eliminarán también todos los estudios asociados.</span>
          </div>
          <p style="font-size:var(--fs-body);color:var(--text)">
            ¿Eliminar a <strong>${escHtml(nombre)}</strong> y todo su historial?
          </p>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
          <button id="btn-del" class="btn-danger" onclick="handleDelete('${id}')">
            <i data-lucide="trash-2" class="icon icon-md" aria-hidden="true"></i>
            Eliminar
          </button>
        </div>

      </div>
    </div>`;

  if (window.lucide) lucide.createIcons();
}

async function handleDelete(id) {
  const btn = document.getElementById("btn-del");
  if (btn) {
    btn.disabled  = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="icon icon-md spin" aria-hidden="true"></i> Eliminando...`;
    if (window.lucide) lucide.createIcons();
  }

  try {
    const ok = await apiDeletePatient(id);
    if (ok) {
      state.patients = state.patients.filter(p => p.id !== id);
      closeModal();
      renderList();
      showToast("Paciente eliminado.", "success");
    } else {
      closeModal();
      showToast("No se pudo eliminar. Intenta de nuevo.", "error");
    }
  } catch (_) {
    closeModal();
    showToast("Error de red. Intenta de nuevo.", "error");
  }
}

// ── Navegación ────────────────────────────────────────────────────────────────
function goToPatient(id) {
  window.location.href = `/paciente.html?id=${id}`;
}

// ── Utilidades ────────────────────────────────────────────────────────────────
function handleSearch(q) {
  state.search = q;
  renderList();
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch (_) { return dateStr; }
}

/** Escapa HTML para insertar en innerHTML */
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

/** Escapa para usar en atributos HTML simples (sin innerHTML) */
function escAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function showToast(msg, type = "") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const t = document.createElement("div");
  t.className  = `toast${type ? " " + type : ""}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
