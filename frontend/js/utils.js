/* BioBlood — Utilidades compartidas */

/** Normaliza un nombre para comparación (sin acentos, minúsculas, trim) */
function localNormalize(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Formatea una fecha ISO (YYYY-MM-DD) en formato legible en español */
function formatDate(iso) {
  if (!iso) return "—";
  try {
    // Forzar mediodía para evitar desfases de zona horaria
    return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch (_) { return iso; }
}

/** Escapa caracteres HTML para inserción segura en innerHTML */
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

/** Muestra un toast temporal en #toast-container */
function showToast(msg, type = "") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const t = document.createElement("div");
  t.className   = `toast${type ? " " + type : ""}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/** Lee un File y devuelve su contenido en base64 (sin el prefijo data:…;base64,) */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Devuelve el HTML de un badge de estado de componente.
 * @param {string} status - "normal" | "alto" | "bajo" | "desconocido" | "nd"
 */
function getStatusBadge(status) {
  const map = {
    normal:      { cls: "normal", label: "Normal" },
    bajo:        { cls: "bajo",   label: "Bajo" },
    alto:        { cls: "alto",   label: "Alto" },
    desconocido: { cls: "nd",     label: "Desc." },
    nd:          { cls: "nd",     label: "N/D" },
  };
  const s = map[(status || "").toLowerCase()] || map.nd;
  return `<span class="badge-status ${s.cls}">${s.label}</span>`;
}
