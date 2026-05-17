/* BioBlood — API client */
const API_URL = window.BIOBLOOD_API || "http://localhost:3000";

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  return res;
}

async function requireSession() {
  try {
    const res = await apiFetch("/auth/me");
    if (!res.ok) throw new Error("No session");
    const doctor = await res.json();
    window.__doctor = doctor;
    if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
      window.location.replace("pacientes.html");
    }
    return doctor;
  } catch {
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
  }
}
