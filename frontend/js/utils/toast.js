/* BioBlood — Utilidad de toast compartida */

(function () {
  // Inyectar keyframes una sola vez
  if (!document.getElementById("bb-toast-styles")) {
    const s = document.createElement("style");
    s.id = "bb-toast-styles";
    s.textContent = `
      @keyframes bb-toast-in  { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
      @keyframes bb-toast-out { from { opacity:1; transform:translateY(0);     } to { opacity:0; transform:translateY(-10px); } }
      .bb-in  { animation: bb-toast-in  180ms ease forwards; }
      .bb-out { animation: bb-toast-out 180ms ease forwards; }
    `;
    document.head.appendChild(s);
  }

  function getHost() {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.style.cssText =
        "position:fixed;top:20px;right:20px;z-index:9999;" +
        "display:flex;flex-direction:column;gap:8px;pointer-events:none;";
      document.body.appendChild(host);
    }
    return host;
  }

  const ICON = { info: "info", success: "check-circle-2", error: "x-circle" };

  const COLORS = {
    info:    { bg: "var(--surface)",    color: "var(--text)",  border: "var(--border)" },
    success: { bg: "var(--green-100)", color: "var(--green)", border: "#A5D6A7" },
    error:   { bg: "var(--red-100)",   color: "var(--red)",   border: "var(--crimson-200)" },
  };

  window.showToast = function showToast(message, type, durationMs) {
    const t  = COLORS[type] ? type : "info";
    const c  = COLORS[t];
    durationMs = durationMs ?? 2500;

    const toast = document.createElement("div");
    toast.className = "bb-in";
    toast.style.cssText =
      `background:${c.bg};color:${c.color};border:1px solid ${c.border};` +
      "border-radius:var(--radius-lg);padding:12px 16px;box-shadow:var(--shadow-md);" +
      "display:flex;align-items:center;gap:10px;font-size:var(--fs-sm);" +
      "font-weight:500;max-width:320px;pointer-events:all;" +
      "font-family:var(--font-body,sans-serif);";

    const safe = String(message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    toast.innerHTML =
      `<i data-lucide="${ICON[t]}" style="width:16px;height:16px;stroke-width:2;flex-shrink:0" aria-hidden="true"></i>` +
      `<span>${safe}</span>`;

    getHost().appendChild(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });

    setTimeout(() => {
      toast.className = "bb-out";
      toast.addEventListener("animationend", () => toast.remove(), { once: true });
    }, durationMs);
  };
})();
