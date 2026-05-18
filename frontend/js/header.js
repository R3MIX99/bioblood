/* BioBlood — Top navigation inyectable */

const NAV_TABS = [
  { label: "Dashboard",     href: "/dashboard",     page: "dashboard",  icon: "layout-dashboard" },
  { label: "Pacientes",     href: "/pacientes",     page: "pacientes",  icon: "users" },
  { label: "Configuracion", href: "#",              page: "config",     icon: "settings" },
];

async function initHeader() {
  const container = document.getElementById("app-header");
  if (!container) return;

  // Obtener el doctor de la sesión
  let doctor = window.__doctor || null;
  if (!doctor) {
    try {
      const res = await apiFetch("/auth/me");
      if (res.ok) {
        doctor = await res.json();
        window.__doctor = doctor;
      }
    } catch (_) {}
  }
  if (!doctor) return; // requireSession() en la página manejará la redirección

  // Determinar tab activa según data-page del body
  const currentPage = document.body.dataset.page || "";

  // Inicial del nombre para el avatar
  const initial = (doctor.nombre || doctor.email || "?")[0].toUpperCase();

  const tabsHtml = NAV_TABS.map((t) => `
    <a
      href="${t.href}"
      class="nav-tab ${currentPage === t.page ? "active" : ""}"
      aria-current="${currentPage === t.page ? "page" : "false"}"
    >
      <i data-lucide="${t.icon}" class="icon icon-md" aria-hidden="true"></i>
      ${t.label}
    </a>
  `).join("");

  container.innerHTML = `
    <nav class="nav-wrapper" role="navigation" aria-label="Navegación principal">
      <div class="top-nav container">

        <!-- Logo -->
        <a href="/dashboard" class="nav-logo" aria-label="BioBlood — inicio">
          <div class="nav-logo-icon">
            <i data-lucide="droplet" class="icon icon-lg" aria-hidden="true"></i>
          </div>
          <span class="nav-brand">BioBlood</span>
        </a>

        <!-- Tabs centrales -->
        <div class="nav-tabs" role="tablist">
          ${tabsHtml}
        </div>

        <!-- Derecha: iconos + avatar -->
        <div class="nav-right">
          <button class="btn-icon" aria-label="Notificaciones" title="Notificaciones">
            <i data-lucide="bell" class="icon icon-md" aria-hidden="true"></i>
          </button>
          <button class="btn-icon" aria-label="Configuración" title="Configuración">
            <i data-lucide="settings" class="icon icon-md" aria-hidden="true"></i>
          </button>
          <button
            class="nav-avatar"
            aria-label="Menú de usuario: ${doctor.nombre || doctor.email}"
            title="${doctor.nombre || doctor.email}"
            onclick="handleAvatarMenu(event)"
          >${initial}</button>
        </div>

      </div>
    </nav>
  `;

  // Renderizar íconos Lucide tras inyectar el HTML
  if (window.lucide) lucide.createIcons();
}

function handleAvatarMenu(e) {
  e.stopPropagation();
  // Menú simple: solo logout por ahora
  const existing = document.getElementById("avatar-menu");
  if (existing) { existing.remove(); return; }

  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();

  const menu = document.createElement("div");
  menu.id = "avatar-menu";
  menu.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 8}px;
    right: ${window.innerWidth - rect.right}px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    padding: 8px;
    z-index: 200;
    min-width: 180px;
    font-family: var(--font-body);
  `;

  const doctor = window.__doctor || {};
  menu.innerHTML = `
    <div style="padding: 8px 12px 10px; border-bottom: 1px solid var(--border); margin-bottom: 6px;">
      <p style="font-weight:600; font-size:13px; color:var(--text); margin:0; font-family:var(--font-body)">${doctor.nombre || ""}</p>
      <p style="font-size:11px; color:var(--text-light); margin:2px 0 0; font-family:var(--font-body)">${doctor.email || ""}</p>
    </div>
    <button onclick="doLogout()" style="
      width:100%; display:flex; align-items:center; gap:8px;
      padding: 8px 12px; border:none; border-radius:8px;
      background:transparent; color:var(--crimson);
      font-size:13px; font-weight:500; cursor:pointer;
      font-family:var(--font-body);
    ">
      <i data-lucide="log-out" style="width:16px;height:16px;stroke-width:1.75" aria-hidden="true"></i>
      Cerrar sesión
    </button>
  `;

  document.body.appendChild(menu);
  if (window.lucide) lucide.createIcons();

  // Cerrar al hacer clic fuera
  const close = (ev) => {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", close); }
  };
  setTimeout(() => document.addEventListener("click", close), 0);
}

async function doLogout() {
  try { await apiFetch("/auth/logout", { method: "POST" }); } catch (_) {}
  window.location.replace("/login.html");
}

// Auto-inicializar al cargar
document.addEventListener("DOMContentLoaded", initHeader);
