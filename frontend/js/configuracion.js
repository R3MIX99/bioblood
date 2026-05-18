/* BioBlood — Configuración (Fase 11) */

async function initConfig() {
  const doctor = await requireSession();
  if (!doctor) return;

  const root = document.getElementById("config-root");
  if (!root) return;

  // Carga datos frescos del perfil
  let me = doctor;
  try {
    const res = await apiFetch("/me");
    if (res.ok) me = await res.json();
  } catch (_) {}

  root.innerHTML = renderShell(me);
  if (window.lucide) lucide.createIcons();

  attachProfileHandlers(me);
  attachPasswordHandlers();
  attachSessionHandlers();
  attachExportHandlers();
  attachDeleteHandlers();
}

// ── Shell ─────────────────────────────────────────────────────────────────────

function renderShell(me) {
  const initial   = (me.nombre || me.email || "?")[0].toUpperCase();
  const avatarHtml = me.avatarUrl
    ? `<img src="${me.avatarUrl}" alt="Avatar" class="cfg-avatar-img" />`
    : `<span class="cfg-avatar-initials">${initial}</span>`;

  return `
    <div class="cfg-wrap">

      <div class="cfg-greeting">
        <h1>Configuración</h1>
        <p>Administra tu perfil, seguridad y cuenta</p>
      </div>

      <!-- ── PERFIL ─────────────────────────────────────── -->
      <div class="cfg-card" style="animation-delay:0ms">
        <div class="cfg-card-header">
          <div class="cfg-card-title">
            <i data-lucide="user" class="icon icon-md" aria-hidden="true"></i>
            Perfil
          </div>
        </div>
        <div class="cfg-card-body">

          <div class="cfg-avatar-row">
            <div class="cfg-avatar" id="cfg-avatar-display" title="Cambiar foto">
              ${avatarHtml}
              <div class="cfg-avatar-overlay">
                <i data-lucide="camera" class="icon icon-sm" aria-hidden="true"></i>
              </div>
            </div>
            <div>
              <p class="cfg-hint">JPG o PNG · máx. 2 MB</p>
              <input type="file" id="avatar-file" accept="image/*" style="display:none" />
              <button class="btn-ghost cfg-link-btn" id="btn-change-avatar">Cambiar foto</button>
            </div>
          </div>

          <div class="cfg-field-row">
            <div class="cfg-field">
              <label class="cfg-label" for="field-nombre">Nombre</label>
              <input class="form-input" id="field-nombre" type="text"
                value="${escHtml(me.nombre || "")}" placeholder="Tu nombre completo" />
            </div>
            <div class="cfg-field">
              <label class="cfg-label">Correo electrónico</label>
              <input class="form-input" type="email"
                value="${escHtml(me.email || "")}" disabled
                style="opacity:0.5;cursor:not-allowed" />
            </div>
          </div>

          <div class="cfg-actions">
            <button class="btn-primary" id="btn-save-profile">Guardar cambios</button>
          </div>

        </div>
      </div>

      <!-- ── CONTRASEÑA ─────────────────────────────────── -->
      <div class="cfg-card" style="animation-delay:60ms">
        <div class="cfg-card-header">
          <div class="cfg-card-title">
            <i data-lucide="lock" class="icon icon-md" aria-hidden="true"></i>
            Contraseña
          </div>
        </div>
        <div class="cfg-card-body">

          <div class="cfg-field-col">
            <div class="cfg-field">
              <label class="cfg-label" for="field-current-pw">Contraseña actual</label>
              <input class="form-input" id="field-current-pw" type="password"
                placeholder="••••••••" autocomplete="current-password" />
            </div>
            <div class="cfg-field-row">
              <div class="cfg-field">
                <label class="cfg-label" for="field-new-pw">Nueva contraseña</label>
                <input class="form-input" id="field-new-pw" type="password"
                  placeholder="Mínimo 6 caracteres" autocomplete="new-password" />
              </div>
              <div class="cfg-field">
                <label class="cfg-label" for="field-confirm-pw">Confirmar contraseña</label>
                <input class="form-input" id="field-confirm-pw" type="password"
                  placeholder="Repite la nueva contraseña" autocomplete="new-password" />
              </div>
            </div>
          </div>

          <div class="cfg-actions">
            <button class="btn-primary" id="btn-save-password">Actualizar contraseña</button>
          </div>

        </div>
      </div>

      <!-- ── SESIONES ───────────────────────────────────── -->
      <div class="cfg-card" style="animation-delay:120ms">
        <div class="cfg-card-header">
          <div class="cfg-card-title">
            <i data-lucide="monitor" class="icon icon-md" aria-hidden="true"></i>
            Sesiones activas
          </div>
        </div>
        <div class="cfg-card-body">
          <p class="cfg-description">
            Cierra sesión en todos los dispositivos donde estés conectado.
            Tendrás que volver a iniciar sesión en este dispositivo también.
          </p>
          <div class="cfg-actions">
            <button class="btn-outline-danger" id="btn-revoke-sessions">
              <i data-lucide="log-out" class="icon icon-sm" aria-hidden="true"></i>
              Cerrar todas las sesiones
            </button>
          </div>
        </div>
      </div>

      <!-- ── EXPORTAR ───────────────────────────────────── -->
      <div class="cfg-card" style="animation-delay:180ms">
        <div class="cfg-card-header">
          <div class="cfg-card-title">
            <i data-lucide="download" class="icon icon-md" aria-hidden="true"></i>
            Exportar datos
          </div>
        </div>
        <div class="cfg-card-body">
          <p class="cfg-description">
            Descarga un archivo ZIP con todos tus pacientes y estudios en formato JSON.
          </p>
          <div class="cfg-actions">
            <button class="cfg-export-btn" id="btn-export">
              <i data-lucide="download" class="icon icon-sm" aria-hidden="true"></i>
              Descargar mis datos
            </button>
          </div>
        </div>
      </div>

      <!-- ── ZONA DE PELIGRO ────────────────────────────── -->
      <div class="cfg-card cfg-danger" style="animation-delay:240ms">
        <div class="cfg-card-header">
          <div class="cfg-card-title" style="color:var(--red)">
            <i data-lucide="triangle-alert" class="icon icon-md" aria-hidden="true"></i>
            Zona de peligro
          </div>
        </div>
        <div class="cfg-card-body">
          <p class="cfg-description">
            Eliminar tu cuenta borrará permanentemente todos tus pacientes, estudios y datos.
            <strong>Esta acción no se puede deshacer.</strong>
          </p>
          <div class="cfg-field" style="max-width:360px;margin-bottom:var(--space-4)">
            <label class="cfg-label" for="field-delete-pw">
              Escribe tu contraseña para confirmar
            </label>
            <input class="form-input" id="field-delete-pw" type="password"
              placeholder="Tu contraseña actual" />
          </div>
          <div class="cfg-actions">
            <button class="btn-danger" id="btn-delete-account">
              <i data-lucide="trash-2" class="icon icon-sm" aria-hidden="true"></i>
              Eliminar mi cuenta
            </button>
          </div>
        </div>
      </div>

      <div style="height:var(--space-12)"></div>
    </div>
  `;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setLoading(btnId, loading, defaultLabel) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.label = btn.textContent.trim();
    btn.textContent   = "Guardando…";
  } else {
    btn.textContent = btn.dataset.label || defaultLabel;
    delete btn.dataset.label;
  }
}

// ── Perfil ────────────────────────────────────────────────────────────────────

function attachProfileHandlers(me) {
  const avatarDisplay   = document.getElementById("cfg-avatar-display");
  const avatarFile      = document.getElementById("avatar-file");
  const btnChangeAvatar = document.getElementById("btn-change-avatar");

  const openPicker = () => avatarFile.click();
  avatarDisplay.addEventListener("click", openPicker);
  btnChangeAvatar.addEventListener("click", openPicker);

  avatarFile.addEventListener("change", async () => {
    const file = avatarFile.files[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res  = await apiFetch("/me/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Error al subir foto", "error"); return; }

      const display = document.getElementById("cfg-avatar-display");
      display.innerHTML = `
        <img src="${data.avatarUrl}" alt="Avatar" class="cfg-avatar-img" />
        <div class="cfg-avatar-overlay">
          <i data-lucide="camera" class="icon icon-sm" aria-hidden="true"></i>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ nodes: [display] });
      showToast("Foto actualizada", "success");
    } catch (_) {
      showToast("Error al subir la foto", "error");
    }
  });

  document.getElementById("btn-save-profile").addEventListener("click", async () => {
    const nombre = document.getElementById("field-nombre").value.trim();
    if (!nombre) { showToast("El nombre no puede estar vacío", "error"); return; }

    setLoading("btn-save-profile", true);
    try {
      const res  = await apiFetch("/me", { method: "PATCH", body: JSON.stringify({ nombre }) });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Error al guardar", "error"); return; }

      if (window.__doctor) window.__doctor.nombre = data.nombre;
      showToast("Perfil guardado", "success");
    } catch (_) {
      showToast("Error al guardar el perfil", "error");
    } finally {
      setLoading("btn-save-profile", false, "Guardar cambios");
    }
  });
}

// ── Contraseña ────────────────────────────────────────────────────────────────

function attachPasswordHandlers() {
  document.getElementById("btn-save-password").addEventListener("click", async () => {
    const currentPassword = document.getElementById("field-current-pw").value;
    const newPassword     = document.getElementById("field-new-pw").value;
    const confirm         = document.getElementById("field-confirm-pw").value;

    if (newPassword.length < 6) {
      showToast("La contraseña debe tener al menos 6 caracteres", "error"); return;
    }
    if (newPassword !== confirm) {
      showToast("Las contraseñas no coinciden", "error"); return;
    }

    setLoading("btn-save-password", true);
    try {
      const res  = await apiFetch("/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Error al cambiar contraseña", "error"); return; }

      document.getElementById("field-current-pw").value = "";
      document.getElementById("field-new-pw").value     = "";
      document.getElementById("field-confirm-pw").value = "";
      showToast("Contraseña actualizada", "success");
    } catch (_) {
      showToast("Error al cambiar la contraseña", "error");
    } finally {
      setLoading("btn-save-password", false, "Actualizar contraseña");
    }
  });
}

// ── Sesiones ──────────────────────────────────────────────────────────────────

function attachSessionHandlers() {
  document.getElementById("btn-revoke-sessions").addEventListener("click", async () => {
    if (!confirm("¿Cerrar sesión en todos los dispositivos? Tendrás que volver a iniciar sesión.")) return;

    try {
      const res = await apiFetch("/me/revoke-sessions", { method: "POST" });
      if (!res.ok) { showToast("Error al revocar sesiones", "error"); return; }
      showToast("Sesiones cerradas. Redirigiendo…", "success");
      setTimeout(() => window.location.replace("/login.html"), 1600);
    } catch (_) {
      showToast("Error al revocar sesiones", "error");
    }
  });
}

// ── Exportar ──────────────────────────────────────────────────────────────────

function attachExportHandlers() {
  document.getElementById("btn-export").addEventListener("click", async () => {
    const btn = document.getElementById("btn-export");
    btn.disabled    = true;
    btn.textContent = "Generando…";

    try {
      const res = await apiFetch("/me/export");
      if (!res.ok) { showToast("Error al exportar datos", "error"); return; }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href     = url;
      a.download = `bioblood-export-${date}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Datos exportados correctamente", "success");
    } catch (_) {
      showToast("Error al exportar los datos", "error");
    } finally {
      btn.disabled    = false;
      btn.innerHTML   = `<i data-lucide="download" class="icon icon-sm" aria-hidden="true"></i> Descargar mis datos`;
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
    }
  });
}

// ── Eliminar cuenta ───────────────────────────────────────────────────────────

function attachDeleteHandlers() {
  document.getElementById("btn-delete-account").addEventListener("click", async () => {
    const password = document.getElementById("field-delete-pw").value;
    if (!password) {
      showToast("Escribe tu contraseña para confirmar", "error"); return;
    }
    if (!confirm("¿Eliminar tu cuenta? Se borrarán todos tus pacientes y estudios. Esta acción no se puede deshacer.")) return;

    try {
      const res = await apiFetch("/me", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });

      if (res.status === 204 || res.ok) {
        showToast("Cuenta eliminada. Hasta luego.", "success", 2200);
        setTimeout(() => window.location.replace("/login.html"), 2200);
        return;
      }
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Error al eliminar la cuenta", "error");
    } catch (_) {
      showToast("Error al eliminar la cuenta", "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", initConfig);
