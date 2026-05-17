/* BioBlood — API client */
const API_URL = window.BIOBLOOD_API || "http://localhost:3000";

/**
 * Wrapper sobre fetch que:
 * - Prepende API_URL al path
 * - Incluye credentials (cookies) en todas las peticiones
 * - Establece Content-Type: application/json por defecto
 */
async function apiFetch(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };

  // Si el body es FormData no ponemos Content-Type (el browser lo pone con boundary)
  if (opts.body instanceof FormData) delete headers["Content-Type"];

  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...opts,
    headers,
  });
  return res;
}

/**
 * Verifica que haya sesión activa llamando a GET /auth/me.
 * - Si hay sesión: guarda el doctor en window.__doctor y resuelve.
 * - Si no hay sesión: redirige a /login.html (excepto si ya estamos ahí).
 */
async function requireSession() {
  try {
    const res = await apiFetch("/auth/me");
    if (!res.ok) throw new Error("no session");
    const doctor = await res.json();
    window.__doctor = doctor;

    // Redirigir desde index.html o raíz hacia pacientes
    const path = window.location.pathname;
    if (path.endsWith("index.html") || path === "/" || path.endsWith("/app/")) {
      window.location.replace("pacientes.html");
    }
    return doctor;
  } catch {
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
  }
}

/**
 * Verifica sesión sin redirigir. Devuelve el doctor o null.
 */
async function getSession() {
  try {
    const res = await apiFetch("/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
