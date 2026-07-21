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
let activeTab    = "login"; // "login" | "register"
let activeScreen = "auth";  // "auth" | "forgot-email" | "forgot-code" | "forgot-reset" | "verify-email"
let forgotEmail  = "";      // persisted across forgot screens
let verifyEmail  = "";      // correo pendiente de verificación al registrarse

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  if (activeScreen === "verify-email") { renderVerifyEmail(); return; }
  if (activeScreen !== "auth") { renderForgot(); return; }

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
            <div class="${activeTab === "register" ? "pw-input-wrap" : ""}">
              <input
                type="password"
                id="field-password"
                class="auth-input"
                placeholder="${activeTab === "register" ? "Crea una contraseña segura" : "••••••••"}"
                required
                autocomplete="${activeTab === "register" ? "new-password" : "current-password"}"
                ${activeTab === "register" ? 'oninput="onPasswordInput()"' : ""}
              />
              ${activeTab === "register" ? `<button type="button" class="pw-eye-btn" onclick="togglePwVisibility('field-password', this)" aria-label="Mostrar contraseña" tabindex="-1">
                <i data-lucide="eye" style="width:18px;height:18px"></i>
              </button>` : ""}
            </div>
          </div>

          ${activeTab === "register" ? `
          <div id="pw-requirements" class="pw-requirements">
            <p class="pw-req-title">La contraseña debe tener:</p>
            <ul class="pw-req-list">
              <li class="pw-req" id="req-length">
                <span class="pw-req-icon">○</span> Mínimo 8 caracteres
              </li>
              <li class="pw-req" id="req-upper">
                <span class="pw-req-icon">○</span> Al menos una mayúscula
              </li>
              <li class="pw-req" id="req-lower">
                <span class="pw-req-icon">○</span> Al menos una minúscula
              </li>
              <li class="pw-req" id="req-number">
                <span class="pw-req-icon">○</span> Al menos un número
              </li>
            </ul>
          </div>

          <div class="auth-field">
            <label class="auth-label">Confirmar contraseña</label>
            <div class="pw-input-wrap">
              <input
                type="password"
                id="field-confirm-password"
                class="auth-input"
                placeholder="Repite tu contraseña"
                required
                autocomplete="new-password"
                oninput="onConfirmInput()"
              />
              <button type="button" class="pw-eye-btn" onclick="togglePwVisibility('field-confirm-password', this)" aria-label="Mostrar contraseña" tabindex="-1">
                <i data-lucide="eye" style="width:18px;height:18px"></i>
              </button>
            </div>
            <p id="confirm-error" class="pw-confirm-error" style="display:none">Las contraseñas no coinciden</p>
          </div>
          ` : ""}

          <button type="submit" class="auth-btn-primary" id="auth-submit">
            <span id="auth-submit-text">
              ${activeTab === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </span>
            <i data-lucide="loader-2" class="icon spin" id="auth-spinner" style="display:none;width:16px;height:16px"></i>
          </button>

          ${activeTab === "login" ? `
          <div style="text-align:center;margin-top:var(--space-4)">
            <button type="button"
              onclick="goForgot()"
              style="background:none;border:none;cursor:pointer;font-size:var(--fs-sm);
                     color:var(--text-muted);text-decoration:underline;padding:0">
              Olvidé mi contraseña
            </button>
          </div>` : ""}
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

  if (activeTab === "register") {
    const btn = document.getElementById("auth-submit");
    if (btn) btn.disabled = true;
  }
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

// ── Password validation (register only) ───────────────────────────────────
const PW_RULES = {
  "req-length": (v) => v.length >= 8,
  "req-upper":  (v) => /[A-Z]/.test(v),
  "req-lower":  (v) => /[a-z]/.test(v),
  "req-number": (v) => /[0-9]/.test(v),
};

function checkPasswordRules(value) {
  let allOk = true;
  for (const [id, test] of Object.entries(PW_RULES)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const ok = test(value);
    if (!ok) allOk = false;
    el.classList.toggle("pw-req--ok",   ok);
    el.classList.toggle("pw-req--fail", !ok && value.length > 0);
    el.querySelector(".pw-req-icon").textContent = ok ? "✓" : (value.length > 0 ? "✗" : "○");
  }
  return allOk;
}

function checkConfirmMatch() {
  const pw  = document.getElementById("field-password")?.value ?? "";
  const cpw = document.getElementById("field-confirm-password")?.value ?? "";
  const errEl = document.getElementById("confirm-error");
  const match = pw === cpw;
  if (errEl) errEl.style.display = (!match && cpw.length > 0) ? "block" : "none";
  return match && cpw.length > 0;
}

function updateSubmitState() {
  const btn = document.getElementById("auth-submit");
  if (!btn) return;
  const pw = document.getElementById("field-password")?.value ?? "";
  const rulesOk  = checkPasswordRules(pw);
  const matchOk  = checkConfirmMatch();
  btn.disabled = !(rulesOk && matchOk);
}

function togglePwVisibility(fieldId, btn) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.innerHTML = show
    ? `<i data-lucide="eye-off" style="width:18px;height:18px"></i>`
    : `<i data-lucide="eye" style="width:18px;height:18px"></i>`;
  btn.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
  if (window.lucide) lucide.createIcons();
}

function onPasswordInput() {
  updateSubmitState();
}

function onConfirmInput() {
  updateSubmitState();
}

async function handleSubmit(e) {
  e.preventDefault();
  clearError();

  if (activeTab === "register") {
    const pw = document.getElementById("field-password")?.value ?? "";
    const rulesOk = Object.values(PW_RULES).every((fn) => fn(pw));
    const matchOk = checkConfirmMatch();
    if (!rulesOk || !matchOk) return;
  }

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

    // Registro pendiente — ir a verificación de correo
    if (data.pending) {
      verifyEmail  = email;
      activeScreen = "verify-email";
      render();
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

// ── Verificación de correo (registro) ────────────────────────────────────

function renderVerifyEmail() {
  const root = document.getElementById("login-root");
  if (!root) return;

  const logoHtml = `
    <div class="auth-logo">
      <div class="auth-logo-icon">
        <i data-lucide="droplet" class="icon" style="width:28px;height:28px;color:#C0392B;stroke-width:1.75"></i>
      </div>
      <div>
        <h1 class="auth-brand">BioBlood</h1>
        <p class="auth-brand-sub">ANÁLISIS CLÍNICOS</p>
      </div>
    </div>`;

  root.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card">
        ${logoHtml}
        <div style="text-align:center;margin-bottom:var(--space-5)">
          <div style="width:56px;height:56px;background:var(--crimson-50);border-radius:50%;
                      display:inline-flex;align-items:center;justify-content:center;margin-bottom:var(--space-4)">
            <i data-lucide="mail" style="width:26px;height:26px;color:var(--crimson);stroke-width:1.75"></i>
          </div>
          <h2 style="font-size:var(--fs-h2);font-family:var(--font-display);color:var(--text);margin:0 0 var(--space-2)">
            Verifica tu correo
          </h2>
          <p style="font-size:var(--fs-sm);color:var(--text-muted);margin:0">
            Enviamos un código de 6 dígitos a<br><strong>${verifyEmail}</strong>
          </p>
        </div>

        <div id="auth-error" class="auth-error" style="display:none"></div>

        <form onsubmit="handleVerifyEmail(event)">
          <div class="auth-field">
            <label class="auth-label">Código de verificación</label>
            <input type="text" id="verify-code-input" class="auth-input"
                   placeholder="000000" required maxlength="6"
                   style="letter-spacing:6px;font-size:22px;text-align:center"
                   autocomplete="one-time-code" inputmode="numeric" />
          </div>
          <button type="submit" class="auth-btn-primary" id="auth-submit">
            <span id="auth-submit-text">Verificar y crear cuenta</span>
            <i data-lucide="loader-2" class="icon spin" id="auth-spinner" style="display:none;width:16px;height:16px"></i>
          </button>
        </form>

        <div style="text-align:center;margin-top:var(--space-4);display:flex;flex-direction:column;gap:var(--space-2)">
          <button type="button" onclick="handleResendVerification()"
            style="background:none;border:none;cursor:pointer;font-size:var(--fs-sm);
                   color:var(--text-muted);text-decoration:underline;padding:0">
            Reenviar código
          </button>
          <button type="button" onclick="backToRegister()"
            style="background:none;border:none;cursor:pointer;font-size:var(--fs-sm);
                   color:var(--text-light);padding:0">
            Volver al registro
          </button>
        </div>
      </div>
    </div>`;

  if (window.lucide) lucide.createIcons();
  setTimeout(() => { const f = document.getElementById("verify-code-input"); if (f) f.focus(); }, 50);
}

async function handleVerifyEmail(e) {
  e.preventDefault();
  clearError();
  const code = document.getElementById("verify-code-input")?.value.trim();
  if (!code) return;

  setLoading(true);
  try {
    const res  = await apiFetch("/auth/verify-email", {
      method: "POST",
      body:   JSON.stringify({ email: verifyEmail, code }),
    });
    const data = await res.json();

    if (!res.ok) {
      // Si el código expiró o demasiados intentos → regresar al registro
      if (data.reason === "expired" || data.reason === "locked") {
        activeScreen = "auth";
        activeTab    = "register";
        render();
        setTimeout(() => showError(data.error), 50);
      } else {
        showError(data.error || "Código incorrecto");
      }
      setLoading(false);
      return;
    }

    window.location.replace(resolveReturnTo());
  } catch {
    showError("Error de conexión.");
    setLoading(false);
  }
}

async function handleResendVerification() {
  clearError();
  setLoading(true);
  try {
    const res  = await apiFetch("/auth/resend-verification", {
      method: "POST",
      body:   JSON.stringify({ email: verifyEmail }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (data.error?.includes("pendiente")) {
        // No hay registro pendiente — regresar al registro
        activeScreen = "auth";
        activeTab    = "register";
        render();
        setTimeout(() => showError("El código expiró. Por favor regístrate de nuevo."), 50);
      } else {
        showError(data.error || "Error al reenviar el código");
      }
      return;
    }
    showVerifySuccess("Código reenviado. Revisa tu bandeja de entrada.");
  } catch {
    showError("Error de conexión.");
    setLoading(false);
  }
}

function showVerifySuccess(msg) {
  const el = document.getElementById("auth-error");
  if (!el) return;
  el.textContent       = msg;
  el.style.display     = "block";
  el.style.background  = "var(--green-50, #f0fdf4)";
  el.style.borderColor = "var(--green, #27ae60)";
  el.style.color       = "var(--green, #27ae60)";
}

function backToRegister() {
  activeScreen = "auth";
  activeTab    = "register";
  verifyEmail  = "";
  render();
}

// ── Forgot password ───────────────────────────────────────────────────────

function goForgot() {
  activeScreen = "forgot-email";
  forgotEmail  = "";
  render();
}

function backToLogin() {
  activeScreen = "auth";
  activeTab    = "login";
  render();
}

function renderForgot() {
  const root = document.getElementById("login-root");
  if (!root) return;

  const logoHtml = `
    <div class="auth-logo">
      <div class="auth-logo-icon">
        <i data-lucide="droplet" class="icon" style="width:28px;height:28px;color:#C0392B;stroke-width:1.75"></i>
      </div>
      <div>
        <h1 class="auth-brand">BioBlood</h1>
        <p class="auth-brand-sub">ANÁLISIS CLÍNICOS</p>
      </div>
    </div>`;

  const backBtn = `
    <button type="button" onclick="backToLogin()"
      style="background:none;border:none;cursor:pointer;display:inline-flex;align-items:center;
             gap:6px;font-size:var(--fs-sm);color:var(--text-muted);padding:0;margin-bottom:var(--space-6)">
      <i data-lucide="arrow-left" style="width:15px;height:15px"></i> Volver al inicio de sesión
    </button>`;

  if (activeScreen === "forgot-email") {
    root.innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card">
          ${logoHtml}
          ${backBtn}
          <h2 style="font-size:var(--fs-h2);font-family:var(--font-display);color:var(--text);
                     margin:0 0 var(--space-2)">Recuperar contraseña</h2>
          <p style="font-size:var(--fs-sm);color:var(--text-muted);margin:0 0 var(--space-6)">
            Ingresa tu correo y te enviaremos un código de verificación.
          </p>
          <div id="auth-error" class="auth-error" style="display:none"></div>
          <form onsubmit="handleForgotEmail(event)">
            <div class="auth-field">
              <label class="auth-label">Correo electrónico</label>
              <input type="email" id="forgot-email-input" class="auth-input"
                     placeholder="doctor@ejemplo.com" required autocomplete="email"
                     value="${forgotEmail}" />
            </div>
            <button type="submit" class="auth-btn-primary" id="auth-submit">
              <span id="auth-submit-text">Enviar código</span>
              <i data-lucide="loader-2" class="icon spin" id="auth-spinner" style="display:none;width:16px;height:16px"></i>
            </button>
          </form>
        </div>
      </div>`;

  } else if (activeScreen === "forgot-code") {
    root.innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card">
          ${logoHtml}
          ${backBtn}
          <h2 style="font-size:var(--fs-h2);font-family:var(--font-display);color:var(--text);
                     margin:0 0 var(--space-2)">Ingresa el código</h2>
          <p style="font-size:var(--fs-sm);color:var(--text-muted);margin:0 0 var(--space-6)">
            Enviamos un código de 6 dígitos a <strong>${forgotEmail}</strong>. Válido por 15 minutos.
          </p>
          <div id="auth-error" class="auth-error" style="display:none"></div>
          <form onsubmit="handleForgotCode(event)">
            <div class="auth-field">
              <label class="auth-label">Código de verificación</label>
              <input type="text" id="forgot-code-input" class="auth-input"
                     placeholder="000000" required maxlength="6"
                     style="letter-spacing:6px;font-size:22px;text-align:center"
                     autocomplete="one-time-code" inputmode="numeric" />
            </div>
            <button type="submit" class="auth-btn-primary" id="auth-submit">
              <span id="auth-submit-text">Verificar código</span>
              <i data-lucide="loader-2" class="icon spin" id="auth-spinner" style="display:none;width:16px;height:16px"></i>
            </button>
          </form>
          <div style="text-align:center;margin-top:var(--space-4)">
            <button type="button" onclick="handleForgotResend()"
              style="background:none;border:none;cursor:pointer;font-size:var(--fs-sm);
                     color:var(--text-muted);text-decoration:underline;padding:0">
              Reenviar código
            </button>
          </div>
        </div>
      </div>`;

  } else if (activeScreen === "forgot-reset") {
    root.innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card">
          ${logoHtml}
          ${backBtn}
          <h2 style="font-size:var(--fs-h2);font-family:var(--font-display);color:var(--text);
                     margin:0 0 var(--space-2)">Nueva contraseña</h2>
          <p style="font-size:var(--fs-sm);color:var(--text-muted);margin:0 0 var(--space-6)">
            Crea una nueva contraseña para tu cuenta.
          </p>
          <div id="auth-error" class="auth-error" style="display:none"></div>
          <form onsubmit="handleForgotReset(event)">
            <div class="auth-field">
              <label class="auth-label">Nueva contraseña</label>
              <div class="pw-input-wrap">
                <input type="password" id="reset-password" class="auth-input"
                       placeholder="Crea una contraseña segura" required
                       autocomplete="new-password" oninput="onResetPwInput()" />
                <button type="button" class="pw-eye-btn"
                        onclick="togglePwVisibility('reset-password', this)"
                        aria-label="Mostrar contraseña" tabindex="-1">
                  <i data-lucide="eye" style="width:18px;height:18px"></i>
                </button>
              </div>
            </div>

            <div id="pw-requirements" class="pw-requirements">
              <p class="pw-req-title">La contraseña debe tener:</p>
              <ul class="pw-req-list">
                <li class="pw-req" id="req-length"><span class="pw-req-icon">○</span> Mínimo 8 caracteres</li>
                <li class="pw-req" id="req-upper"><span class="pw-req-icon">○</span> Al menos una mayúscula</li>
                <li class="pw-req" id="req-lower"><span class="pw-req-icon">○</span> Al menos una minúscula</li>
                <li class="pw-req" id="req-number"><span class="pw-req-icon">○</span> Al menos un número</li>
              </ul>
            </div>

            <div class="auth-field">
              <label class="auth-label">Confirmar contraseña</label>
              <div class="pw-input-wrap">
                <input type="password" id="reset-confirm" class="auth-input"
                       placeholder="Repite tu contraseña" required
                       autocomplete="new-password" oninput="onResetConfirmInput()" />
                <button type="button" class="pw-eye-btn"
                        onclick="togglePwVisibility('reset-confirm', this)"
                        aria-label="Mostrar contraseña" tabindex="-1">
                  <i data-lucide="eye" style="width:18px;height:18px"></i>
                </button>
              </div>
              <p id="confirm-error" class="pw-confirm-error" style="display:none">Las contraseñas no coinciden</p>
            </div>

            <button type="submit" class="auth-btn-primary" id="auth-submit" disabled>
              <span id="auth-submit-text">Guardar contraseña</span>
              <i data-lucide="loader-2" class="icon spin" id="auth-spinner" style="display:none;width:16px;height:16px"></i>
            </button>
          </form>
        </div>
      </div>`;
  }

  if (window.lucide) lucide.createIcons();
  setTimeout(() => { const f = document.querySelector(".auth-input"); if (f) f.focus(); }, 50);
}

async function handleForgotEmail(e) {
  e.preventDefault();
  clearError();
  const email = document.getElementById("forgot-email-input")?.value.trim();
  if (!email) return;
  forgotEmail = email;
  setLoading(true);
  try {
    const res = await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "Error al enviar el código"); setLoading(false); return; }
    activeScreen = "forgot-code";
    render();
  } catch {
    showError("Error de conexión."); setLoading(false);
  }
}

async function handleForgotCode(e) {
  e.preventDefault();
  clearError();
  const code = document.getElementById("forgot-code-input")?.value.trim();
  if (!code) return;
  // Store code temporarily on state to pass to reset step
  window._resetCode = code;
  activeScreen = "forgot-reset";
  render();
}

async function handleForgotResend() {
  clearError();
  setLoading(true);
  try {
    const res  = await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: forgotEmail }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { showError(data.error || "Error al reenviar"); return; }
    showForgotSuccess("Código reenviado. Revisa tu bandeja de entrada.");
  } catch {
    showError("Error de conexión."); setLoading(false);
  }
}

function showForgotSuccess(msg) {
  const el = document.getElementById("auth-error");
  if (!el) return;
  el.textContent  = msg;
  el.style.display = "block";
  el.style.background = "var(--green-50, #f0fdf4)";
  el.style.borderColor = "var(--green, #27ae60)";
  el.style.color       = "var(--green, #27ae60)";
}

async function handleForgotReset(e) {
  e.preventDefault();
  clearError();
  const password = document.getElementById("reset-password")?.value ?? "";
  const confirm  = document.getElementById("reset-confirm")?.value ?? "";
  const rulesOk  = Object.values(PW_RULES).every((fn) => fn(password));
  const matchOk  = password === confirm && confirm.length > 0;
  if (!rulesOk || !matchOk) return;

  setLoading(true);
  try {
    const res = await apiFetch("/auth/reset-password", {
      method: "POST",
      body:   JSON.stringify({ email: forgotEmail, code: window._resetCode, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      // Code was wrong — send back to code step
      if (data.error?.includes("Código") || data.error?.includes("expiró") || data.error?.includes("intentos")) {
        activeScreen = "forgot-code";
        render();
        showError(data.error);
      } else {
        showError(data.error || "Error al cambiar la contraseña");
      }
      setLoading(false);
      return;
    }
    // Success — go to login with success message
    delete window._resetCode;
    activeScreen = "auth";
    activeTab    = "login";
    render();
    setTimeout(() => showForgotSuccess("Contraseña actualizada. Ya puedes iniciar sesión."), 50);
  } catch {
    showError("Error de conexión."); setLoading(false);
  }
}

function onResetPwInput() {
  const pw  = document.getElementById("reset-password")?.value ?? "";
  const btn = document.getElementById("auth-submit");
  checkPasswordRules(pw);
  const rulesOk = Object.values(PW_RULES).every((fn) => fn(pw));
  const conf    = document.getElementById("reset-confirm")?.value ?? "";
  const matchOk = pw === conf && conf.length > 0;
  if (btn) btn.disabled = !(rulesOk && matchOk);
  if (conf.length > 0) {
    const errEl = document.getElementById("confirm-error");
    if (errEl) errEl.style.display = pw !== conf ? "block" : "none";
  }
}

function onResetConfirmInput() {
  const pw   = document.getElementById("reset-password")?.value ?? "";
  const conf = document.getElementById("reset-confirm")?.value ?? "";
  const btn  = document.getElementById("auth-submit");
  const errEl = document.getElementById("confirm-error");
  const matchOk = pw === conf && conf.length > 0;
  if (errEl) errEl.style.display = (!matchOk && conf.length > 0) ? "block" : "none";
  const rulesOk = Object.values(PW_RULES).every((fn) => fn(pw));
  if (btn) btn.disabled = !(rulesOk && matchOk);
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
