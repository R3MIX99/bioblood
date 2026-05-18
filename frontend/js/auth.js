/* BioBlood — Auth (login.html) */

// Redirigir si ya tiene sesión activa
(async () => {
  const doctor = await getSession();
  if (doctor) window.location.replace(resolveReturnTo());
})();

function resolveReturnTo() {
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (!raw) return "/pacientes.html";
  try {
    const decoded = decodeURIComponent(raw);
    if (new URL(decoded).origin === window.location.origin) return decoded;
  } catch (_) {}
  return "/pacientes.html";
}

// ── Estado ────────────────────────────────────────────────────────────────
let activeTab = "login"; // "login" | "register"

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById("login-root");
  if (!root) return;

  root.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card">

        <!-- Logo -->
        <div class="auth-logo">
          <div class="auth-logo-icon">
            <i data-lucide="droplet" class="icon" style="width:28px;height:28px;color:#C0392B;stroke-width:1.75"></i>
          </div>
          <div>
            <h1 class="auth-brand">BioBlood</h1>
            <p class="auth-brand-sub">ANÁLISIS CLÍNICOS</p>
          </div>
        </div>

        <!-- Tabs -->
        <div class="auth-tabs">
          <button
            class="auth-tab ${activeTab === "login" ? "active" : ""}"
            onclick="switchTab('login')"
          >Iniciar sesión</button>
          <button
            class="auth-tab ${activeTab === "register" ? "active" : ""}"
            onclick="switchTab('register')"
          >Registrarse</button>
        </div>

        <!-- Error banner -->
        <div id="auth-error" class="auth-error" style="display:none"></div>

        <!-- Formulario -->
        <form id="auth-form" onsubmit="handleSubmit(event)">
          ${activeTab === "register" ? `
            <div class="auth-field">
              <label class="auth-label">Nombre completo</label>
              <input
                type="text"
                id="field-nombre"
                class="auth-input"
                placeholder="Dr. Juan Pérez"
                required
                autocomplete="name"
              />
            </div>
          ` : ""}

          <div class="auth-field">
            <label class="auth-label">Correo electrónico</label>
            <input
              type="email"
              id="field-email"
              class="auth-input"
              placeholder="doctor@ejemplo.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="auth-field">
            <label class="auth-label">Contraseña</label>
            <input
              type="password"
              id="field-password"
              class="auth-input"
              placeholder="${activeTab === "register" ? "Mínimo 6 caracteres" : "••••••••"}"
              required
              autocomplete="${activeTab === "register" ? "new-password" : "current-password"}"
            />
          </div>

          <button type="submit" class="auth-btn-primary" id="auth-submit">
            <span id="auth-submit-text">
              ${activeTab === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </span>
            <i data-lucide="loader-2" class="icon spin" id="auth-spinner" style="display:none;width:16px;height:16px"></i>
          </button>
        </form>

        <!-- Divisor -->
        <div class="auth-divider">
          <span>o continúa con</span>
        </div>

        <!-- Google -->
        <button class="auth-btn-google" onclick="loginWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>

      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// ── Funciones globales (llamadas desde HTML inline) ───────────────────────
function switchTab(tab) {
  activeTab = tab;
  clearError();
  render();
  // Focus en el primer input
  setTimeout(() => {
    const first = document.querySelector(".auth-input");
    if (first) first.focus();
  }, 50);
}

function clearError() {
  const el = document.getElementById("auth-error");
  if (el) el.style.display = "none";
}

function showError(msg) {
  const el = document.getElementById("auth-error");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
}

function setLoading(on) {
  const btn  = document.getElementById("auth-submit");
  const text = document.getElementById("auth-submit-text");
  const spin = document.getElementById("auth-spinner");
  if (!btn) return;
  btn.disabled       = on;
  text.style.display = on ? "none"   : "inline";
  spin.style.display = on ? "inline" : "none";
  if (on && window.lucide) lucide.createIcons();
}

async function handleSubmit(e) {
  e.preventDefault();
  clearError();
  setLoading(true);

  const email    = document.getElementById("field-email")?.value.trim();
  const password = document.getElementById("field-password")?.value;
  const nombre   = document.getElementById("field-nombre")?.value.trim();

  const path = activeTab === "login" ? "/auth/login" : "/auth/register";
  const body = activeTab === "login"
    ? { email, password }
    : { email, password, nombre };

  try {
    const res  = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Error al iniciar sesión");
      setLoading(false);
      return;
    }

    // Éxito — redirigir
    window.location.replace(resolveReturnTo());
  } catch {
    showError("Error de conexión. Verifica que el backend esté corriendo.");
    setLoading(false);
  }
}

function loginWithGoogle() {
  window.location.href = `${API_URL}/auth/google`;
}

// ── Init ──────────────────────────────────────────────────────────────────
// Leer ?error= de la URL (fallo de OAuth)
const urlError = new URLSearchParams(window.location.search).get("error");
if (urlError === "oauth") {
  activeTab = "login";
}

render();

if (urlError === "oauth") {
  showError("No se pudo iniciar sesión con Google. Intenta con email y contraseña.");
}
