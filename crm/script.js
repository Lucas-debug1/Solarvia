const API_URL  = "http://localhost:3000";
const DATE_COL = "criado_em";
const token = localStorage.getItem("crm_token");
if (!token) window.location.href = "login.html";
function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
function sair() {
  localStorage.removeItem("crm_token");
  window.location.href = "login.html";
}
let allLeads   = [];
let filtered   = [];
let page       = 0;
const PER_PAGE = 10;
let chartDaily  = null;
let chartStatus = null;
let deleteId    = null;
const STATUS_CONFIG = {
  novo:       { label: "Novo",         cls: "status-novo",       color: "#4f8ef7" },
  andamento:  { label: "Em andamento", cls: "status-andamento",  color: "#f7c94f" },
  convertido: { label: "Convertido",   cls: "status-convertido", color: "#4ff78c" },
  perdido:    { label: "Perdido",      cls: "status-perdido",    color: "#e24b4a" },
};
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}
function showError(msg) {
  const el = document.getElementById("error-bar");
  el.textContent  = msg;
  el.style.display = "block";
}
function hideError() {
  document.getElementById("error-bar").style.display = "none";
}
function setLiveBadge(state) {
  const el = document.getElementById("live-badge");
  const styles = {
    ok:         "background:rgba(79,247,140,0.12);color:#4ff78c;border:1px solid rgba(79,247,140,0.25);",
    err:        "background:rgba(226,75,74,0.1);color:#e24b4a;border:1px solid rgba(226,75,74,0.2);",
    connecting: "background:rgba(247,201,79,0.12);color:#f7c94f;border:1px solid rgba(247,201,79,0.25);",
  };
  const labels = { ok: "● CONECTADO", err: "● ERRO", connecting: "● CONECTANDO" };
  el.textContent = labels[state];
  el.style.cssText = (styles[state] || styles.connecting) +
    "border-radius:20px;padding:3px 10px;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.5px;";
}
async function loadLeads() {
  hideError();
  setLiveBadge("connecting");
  document.getElementById("leads-tbody").innerHTML =
    '<tr class="loading-row"><td colspan="6">Carregando leads...</td></tr>';
  try {
    const res = await fetch(`${API_URL}/leads`, { headers: authHeaders() });
    if (res.status === 401) { sair(); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allLeads = await res.json();
    setLiveBadge("ok");
    updateMetrics();
    renderDailyChart();
    renderStatusChart();
    filterLeads();
  } catch (e) {
    setLiveBadge("err");
    showError("Erro ao carregar leads: " + e.message);
    document.getElementById("leads-tbody").innerHTML =
      '<tr class="loading-row"><td colspan="6">Falha ao carregar. Verifique se o servidor está rodando.</td></tr>';
  }
}
function updateMetrics() {
  const counts = { novo: 0, andamento: 0, convertido: 0, perdido: 0 };
  allLeads.forEach(l => { counts[l.status || "novo"]++; });

  document.getElementById("m-total").textContent      = allLeads.length;
  document.getElementById("m-novo").textContent       = counts.novo;
  document.getElementById("m-andamento").textContent  = counts.andamento;
  document.getElementById("m-convertido").textContent = counts.convertido;
  document.getElementById("m-perdido").textContent    = counts.perdido;

  const taxa = allLeads.length > 0
    ? Math.round((counts.convertido / allLeads.length) * 100)
    : 0;
  document.getElementById("m-taxa").textContent = taxa + "%";
}
function renderDailyChart() {
  const now = new Date();
  const days = [], counts = [];

  for (let i = 6; i >= 0; i--) {
    const d  = new Date(now - i * 864e5);
    const ds = d.toISOString().slice(0, 10);
    days.push(d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }));
    counts.push(allLeads.filter(l => l[DATE_COL] && l[DATE_COL].startsWith(ds)).length);
  }
  if (chartDaily) chartDaily.destroy();
  chartDaily = new Chart(document.getElementById("chart-daily"), {
    type: "bar",
    data: {
      labels: days,
      datasets: [{
        data: counts,
        backgroundColor: "rgba(79,142,247,0.25)",
        borderColor: "#4f8ef7",
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#4a5568", font: { size: 10 } } },
        y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#4a5568", font: { size: 10 }, stepSize: 1 }, beginAtZero: true },
      },
    },
  });
}
function renderStatusChart() {
  const counts = { novo: 0, andamento: 0, convertido: 0, perdido: 0 };
  allLeads.forEach(l => { counts[l.status || "novo"]++; });
  const keys   = Object.keys(STATUS_CONFIG);
  const data   = keys.map(k => counts[k]);
  const colors = keys.map(k => STATUS_CONFIG[k].color);
  const labels = keys.map(k => STATUS_CONFIG[k].label);
  if (chartStatus) chartStatus.destroy();
  chartStatus = new Chart(document.getElementById("chart-status"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.map(c => c + "33"), borderColor: colors, borderWidth: 2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } },
      },
    },
  });
  document.getElementById("status-legend").innerHTML = keys
    .map(k => `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:10px;height:10px;border-radius:2px;background:${STATUS_CONFIG[k].color};flex-shrink:0;"></span>
        <span>${STATUS_CONFIG[k].label} <strong style="color:#c8d0de;">${counts[k]}</strong></span>
      </div>
    `)
    .join("");
}
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}
function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return d; }
}
function filterLeads() {
  const q  = document.getElementById("search-input").value.toLowerCase();
  const sf = document.getElementById("filter-status").value;
  filtered = allLeads.filter(l => {
    const matchQ = (l.nome || "").toLowerCase().includes(q)
      || (l.email || "").toLowerCase().includes(q)
      || (l.telefone || "").toLowerCase().includes(q);
    const matchS = !sf || (l.status || "novo") === sf;
    return matchQ && matchS;
  });
  page = 0;
  renderTable();
}
function changePage(dir) {
  const maxPage = Math.ceil(filtered.length / PER_PAGE) - 1;
  page = Math.max(0, Math.min(maxPage, page + dir));
  renderTable();
}
async function changeStatus(leadId, value) {
  try {
    const res = await fetch(`${API_URL}/leads/${leadId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status: value }),
    });
    if (res.status === 401) { sair(); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const lead = allLeads.find(x => x.id === leadId);
    if (lead) lead.status = value;
    updateMetrics();
    renderStatusChart();
    filterLeads();
    showToast("✅ Status atualizado: " + STATUS_CONFIG[value].label);
  } catch (err) {
    showError("Erro ao atualizar status: " + err.message);
  }
}
function confirmarDelete(leadId) {
  deleteId = leadId;
  document.getElementById("modal-delete").style.display = "flex";
  document.getElementById("btn-confirmar-delete").onclick = executarDelete;
}
function fecharModal() {
  deleteId = null;
  document.getElementById("modal-delete").style.display = "none";
}
async function executarDelete() {
  fecharModal();
  try {
    const res = await fetch(`${API_URL}/leads/${deleteId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.status === 401) { sair(); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allLeads = allLeads.filter(l => l.id !== deleteId);
    updateMetrics();
    renderStatusChart();
    filterLeads();
    showToast("🗑️ Lead removido.");
  } catch (err) {
    showError("Erro ao remover lead: " + err.message);
  }
}
function renderTable() {
  const tbody   = document.getElementById("leads-tbody");
  const start   = page * PER_PAGE;
  const slice   = filtered.slice(start, start + PER_PAGE);
  const total   = filtered.length;
  const maxPage = Math.ceil(total / PER_PAGE);
  if (slice.length === 0) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="6">Nenhum lead encontrado.</td></tr>';
    document.getElementById("pagination").style.display = "none";
    return;
  }
  tbody.innerHTML = slice.map(l => {
    const st  = l.status || "novo";
    const cfg = STATUS_CONFIG[st];
    const opts = Object.keys(STATUS_CONFIG)
      .map(k => `<option value="${k}" ${k === st ? "selected" : ""}>${STATUS_CONFIG[k].label}</option>`)
      .join("");
    return `
      <tr>
        <td>
          <div class="name-cell">
            <div class="avatar">${getInitials(l.nome)}</div>
            <span class="lead-name">${l.nome || "—"}</span>
          </div>
        </td>
        <td><a class="email-link" href="mailto:${l.email || ""}">${l.email || "—"}</a></td>
        <td><span class="phone-text">${l.telefone || "—"}</span></td>
        <td><span class="date-text">${formatDate(l[DATE_COL])}</span></td>
        <td>
          <select
            class="status-select ${cfg.cls}"
            onchange="changeStatus(${l.id}, this.value); this.className='status-select status-'+this.value;"
          >${opts}</select>
        </td>
        <td>
          <button class="btn-delete" onclick="confirmarDelete(${l.id})" title="Remover lead">🗑</button>
        </td>
      </tr>
    `;
  }).join("");
  document.getElementById("pagination").style.display = "flex";
  document.getElementById("page-info").textContent =
    `${start + 1}–${Math.min(start + PER_PAGE, total)} de ${total}`;
  document.getElementById("btn-prev").disabled = page === 0;
  document.getElementById("btn-next").disabled = page >= maxPage - 1;
}
loadLeads();
