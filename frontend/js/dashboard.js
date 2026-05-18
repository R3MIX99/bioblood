/* BioBlood — Dashboard (Fase 10) */

let _activityChart = null;

async function initDashboard() {
  const doctor = await requireSession();
  if (!doctor) return;

  const root = document.getElementById("dashboard-root");
  if (!root) return;

  root.innerHTML = renderShell(doctor);
  if (window.lucide) lucide.createIcons();

  const settled = await Promise.allSettled([
    apiFetch("/dashboard/stats").then(r => r.ok ? r.json() : null).catch(() => null),
    apiFetch("/dashboard/activity?months=12").then(r => r.ok ? r.json() : null).catch(() => null),
    apiFetch("/dashboard/recent-patients?limit=6").then(r => r.ok ? r.json() : null).catch(() => null),
    apiFetch("/dashboard/recent-studies?limit=6").then(r => r.ok ? r.json() : null).catch(() => null),
    apiFetch("/dashboard/alerts?limit=8").then(r => r.ok ? r.json() : null).catch(() => null),
    apiFetch("/dashboard/top-components?days=30&limit=8").then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const [stats, activity, recentPatients, recentStudies, alerts, topComponents] =
    settled.map(r => r.status === "fulfilled" ? r.value : null);

  fillStats(stats);
  try { renderActivityChart(activity); } catch(e) { console.error("[dashboard] chart:", e); }
  renderAlerts(alerts);
  renderRecentPatients(recentPatients);
  renderRecentStudies(recentStudies);
  renderTopComponents(topComponents);

  if (window.lucide) lucide.createIcons();
}

function renderShell(doctor) {
  const nombre = (doctor.nombre || doctor.email || "").split(" ")[0];
  const skeletonRows = [0, 1, 2, 3]
    .map(() => `<div class="skeleton skeleton-row" style="margin-bottom:8px"></div>`)
    .join("");

  return `
    <div class="db-greeting">
      <h1>Hola, ${nombre}</h1>
      <p>Aqui tienes el resumen de tu actividad medica</p>
    </div>

    <div class="db-stats-grid" id="db-stats">
      ${[0, 1, 2, 3].map(() => `
        <div class="db-stat-card card-tint-rose">
          <div class="skeleton" style="width:44px;height:44px;border-radius:var(--radius-md)"></div>
          <div>
            <div class="skeleton skeleton-text" style="width:80px;margin-bottom:6px"></div>
            <div class="skeleton skeleton-title" style="width:48px"></div>
          </div>
        </div>
      `).join("")}
    </div>

    <div class="db-row-2col" style="margin-top:var(--space-6)">
      <div class="db-section">
        <div class="db-section-header">
          <h2 class="db-section-title">
            <i data-lucide="bar-chart-2" class="icon icon-md" aria-hidden="true"></i>
            Actividad mensual
          </h2>
        </div>
        <div class="db-chart-wrap">
          <canvas id="activity-chart"></canvas>
        </div>
      </div>
      <div class="db-section">
        <div class="db-section-header">
          <h2 class="db-section-title">
            <i data-lucide="alert-triangle" class="icon icon-md" aria-hidden="true" style="color:var(--amber)"></i>
            Alertas recientes
          </h2>
        </div>
        <div class="db-section-body" id="db-alerts">${skeletonRows}</div>
      </div>
    </div>

    <div class="db-row-2col-equal" style="margin-top:var(--space-6)">
      <div class="db-section">
        <div class="db-section-header">
          <h2 class="db-section-title">
            <i data-lucide="users" class="icon icon-md" aria-hidden="true"></i>
            Pacientes recientes
          </h2>
          <a href="/pacientes" class="btn-ghost" style="font-size:12px;padding:5px 12px">Ver todos</a>
        </div>
        <div class="db-section-body" id="db-patients-list">${skeletonRows}</div>
      </div>
      <div class="db-section">
        <div class="db-section-header">
          <h2 class="db-section-title">
            <i data-lucide="flask-conical" class="icon icon-md" aria-hidden="true"></i>
            Estudios recientes
          </h2>
        </div>
        <div class="db-section-body" id="db-studies-list">${skeletonRows}</div>
      </div>
    </div>

    <div class="db-section" style="margin-top:var(--space-6)">
      <div class="db-section-header">
        <h2 class="db-section-title">
          <i data-lucide="trending-up" class="icon icon-md" aria-hidden="true"></i>
          Componentes mas frecuentes (ultimos 30 dias)
        </h2>
      </div>
      <div class="db-section-body" id="db-top-components">
        <div class="skeleton skeleton-row" style="margin-bottom:8px"></div>
        <div class="skeleton skeleton-row" style="margin-bottom:8px"></div>
        <div class="skeleton skeleton-row"></div>
      </div>
    </div>

    <div style="height:var(--space-12)"></div>
  `;
}

function fillStats(data) {
  const el = document.getElementById("db-stats");
  if (!el) return;

  const cards = [
    { label: "Total pacientes",       value: data?.totalPatients    ?? "--", icon: "users",          tint: "rose",  iconClass: "service-icon-rose"  },
    { label: "Total estudios",        value: data?.totalStudies     ?? "--", icon: "flask-conical",  tint: "peach", iconClass: "service-icon-peach" },
    { label: "Estudios este mes",     value: data?.studiesThisMonth ?? "--", icon: "calendar",       tint: "mint",  iconClass: "service-icon-mint"  },
    { label: "Pacientes con alertas", value: data?.patientsWithAlerts ?? "--", icon: "alert-triangle", tint: "sand", iconClass: "service-icon-sand"  },
  ];

  el.innerHTML = cards.map(c => `
    <div class="db-stat-card card-tint-${c.tint}">
      <div class="db-stat-icon ${c.iconClass}">
        <i data-lucide="${c.icon}" class="icon icon-md" aria-hidden="true"></i>
      </div>
      <div>
        <div class="db-stat-label">${c.label}</div>
        <div class="db-stat-value">${c.value}</div>
      </div>
    </div>
  `).join("");

  if (window.lucide) lucide.createIcons();
}

function renderActivityChart(data) {
  const canvas = document.getElementById("activity-chart");
  if (!canvas || !Array.isArray(data)) return;

  if (_activityChart) { _activityChart.destroy(); _activityChart = null; }

  const labels = data.map(d => {
    const iso = d.monthISO ?? d.month ?? "";
    const [year, month] = iso.split("-");
    return new Date(+year, +month - 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
  });

  _activityChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: data.map(d => d.studies ?? d.count ?? 0),
        backgroundColor: "rgba(192,57,43,0.15)",
        borderColor: "rgba(192,57,43,0.75)",
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} estudio${ctx.parsed.y !== 1 ? "s" : ""}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#8891A0" } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 }, color: "#8891A0" }, grid: { color: "#E4E6EA" } },
      },
    },
  });
}

function renderAlerts(data) {
  const el = document.getElementById("db-alerts");
  if (!el) return;

  if (!data || !data.length) {
    el.innerHTML = `<div class="db-empty">Sin alertas recientes</div>`;
    return;
  }

  el.innerHTML = data.map(a => `
    <a href="/paciente?id=${a.patientId}" class="db-alert-row" style="text-decoration:none;color:inherit">
      <div class="db-alert-dot db-alert-dot-${a.status === "alto" ? "alto" : "bajo"}"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.component}</div>
        <div style="font-size:11px;color:var(--text-light)">${a.patientName} · ${fmtDate(a.studyDate)}</div>
      </div>
      <span class="badge-status ${a.status}">${a.status.toUpperCase()}</span>
    </a>
  `).join("");
}

function renderRecentPatients(data) {
  const el = document.getElementById("db-patients-list");
  if (!el) return;

  if (!data || !data.length) {
    el.innerHTML = `<div class="db-empty">Sin pacientes registrados</div>`;
    return;
  }

  el.innerHTML = data.map(p => {
    const initial = (p.nombre || "?")[0].toUpperCase();
    const sexoLabel = p.sexo === "M" || p.sexo === "Masculino" ? "Masculino" : p.sexo === "F" || p.sexo === "Femenino" ? "Femenino" : "";
    const meta = [p.edad ? `${p.edad} anos` : "", sexoLabel].filter(Boolean).join(" · ");
    return `
      <a href="/paciente?id=${p.id}" class="db-list-item" style="text-decoration:none">
        <div class="db-list-avatar">${initial}</div>
        <div style="flex:1;min-width:0">
          <div class="db-list-name">${p.nombre}</div>
          ${meta ? `<div class="db-list-sub">${meta}</div>` : ""}
        </div>
        <div class="db-list-date">${fmtDate(p.createdAt)}</div>
      </a>
    `;
  }).join("");
}

function renderRecentStudies(data) {
  const el = document.getElementById("db-studies-list");
  if (!el) return;

  if (!data || !data.length) {
    el.innerHTML = `<div class="db-empty">Sin estudios registrados</div>`;
    return;
  }

  el.innerHTML = data.map(s => {
    const initial = (s.patientName || "?")[0].toUpperCase();
    return `
      <a href="/paciente?id=${s.patientId}" class="db-list-item" style="text-decoration:none">
        <div class="db-list-avatar" style="background:var(--blue-100);color:var(--blue)">${initial}</div>
        <div style="flex:1;min-width:0">
          <div class="db-list-name">${s.patientName}</div>
          <div class="db-list-sub">${s.components?.length ?? s.componentCount ?? 0} componente${(s.components?.length ?? s.componentCount ?? 0) !== 1 ? "s" : ""}</div>
        </div>
        <div class="db-list-date">${fmtDate(s.fecha ?? s.date)}</div>
      </a>
    `;
  }).join("");
}

function renderTopComponents(data) {
  const el = document.getElementById("db-top-components");
  if (!el) return;

  if (!data || !data.length) {
    el.innerHTML = `<div class="db-empty">Sin datos de componentes</div>`;
    return;
  }

  const max = data[0]?.count || 1;
  const grid = document.createElement("div");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px";

  grid.innerHTML = data.map(c => {
    const pct = Math.round((c.count / max) * 100);
    const href = c.latestPatientId ? `/paciente?id=${c.latestPatientId}` : "#";
    return `
      <a href="${href}" class="db-top-bar-row" style="text-decoration:none">
        <div class="db-top-bar-name" title="${c.name}">${c.name}</div>
        <div class="db-top-bar-track">
          <div class="db-top-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="db-top-bar-count">${c.count}</div>
      </a>
    `;
  }).join("");

  el.innerHTML = "";
  el.appendChild(grid);
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

document.addEventListener("DOMContentLoaded", initDashboard);
