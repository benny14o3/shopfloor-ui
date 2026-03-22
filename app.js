/* ═══════════════════════════════════════════
   SHOPFLOOR · APP.JS
   Navigation · Machines · SPC · Login
═══════════════════════════════════════════ */

const API = window.API_URL || "https://shopfloor-backend.onrender.com";

let currentUser = null;
let xChart = null;
let histChart = null;
let currentCharacteristic = null;
let machineRefreshTimer = null;

// ─── PAGE NAVIGATION ───────────────────────

const PAGE_TITLES = {
  dashboard: ["Maschinenstatus", "Produktion"],
  spc:       ["SPC · Regelkarten", "Produktion · Qualität"],
  fehler:    ["Fehlersammelkarte", "Qualität"],
  pruefplan: ["Prüfplan & Erinnerungen", "Qualität"],
  chargen:   ["Chargenprotokoll", "Produktion"],
  artikel:   ["Artikelstamm", "Verwaltung"],
  settings:  ["Einstellungen", "System"],
};

function navigate(page) {
  // Update nav links
  document.querySelectorAll(".nav-link").forEach(l => {
    l.classList.toggle("active", l.dataset.page === page);
  });

  // Update pages
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");

  // Update topbar
  const [title, crumb] = PAGE_TITLES[page] || [page, ""];
  document.getElementById("page-title").textContent = title;
  document.getElementById("breadcrumb").textContent = crumb;

  // Page-specific init
  if (page === "dashboard") {
    loadMachines();
    if (!machineRefreshTimer) machineRefreshTimer = setInterval(loadMachines, 3000);
  } else {
    clearInterval(machineRefreshTimer);
    machineRefreshTimer = null;
  }

  if (page === "spc") {
    loadSpcArticles();
  }

  if (page === "fehler") {
    initFehlersammelkarte();
  }

  if (page === "fehler") {
    initFskPage();
  }
}

// ─── CLOCK ─────────────────────────────────

function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent =
    now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
setInterval(updateClock, 1000);
updateClock();

// ─── LOGIN ─────────────────────────────────

function showLoginModal() {
  document.getElementById("login-pin").value = "";
  document.getElementById("login-error").classList.add("hidden");
  document.getElementById("login-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("login-pin").focus(), 100);
}

async function doLogin() {
  const pin = document.getElementById("login-pin").value;
  if (!pin) return;

  try {
    const res = await fetch(`${API}/login?pin=${encodeURIComponent(pin)}`, { method: "POST" });
    const data = await res.json();

    if (data.user) {
      currentUser = data;
      document.getElementById("current-user").textContent = data.user;
      document.getElementById("current-role").textContent = data.role || "—";
      document.querySelector(".user-avatar").textContent =
        data.user.substring(0, 2).toUpperCase();
      closeModal("login-modal");
    } else {
      document.getElementById("login-error").classList.remove("hidden");
    }
  } catch (err) {
    document.getElementById("login-error").textContent = "Verbindungsfehler";
    document.getElementById("login-error").classList.remove("hidden");
  }
}

document.addEventListener("keydown", e => {
  if (e.key === "Enter" && !document.getElementById("login-modal").classList.contains("hidden")) {
    doLogin();
  }
});

// ─── MODAL UTILS ───────────────────────────

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// ─── MACHINES ──────────────────────────────

async function loadMachines() {
  try {
    const res = await fetch(`${API}/machines`);
    const machines = await res.json();
    if (!Array.isArray(machines)) return;

    const container = document.getElementById("machines");
    container.innerHTML = "";

    machines.forEach(m => {
      const ppm = m.cycle_time ? (60 / m.cycle_time).toFixed(1) : "—";
      const progress = m.fa_target ? Math.min(100, Math.round((m.produced / m.fa_target) * 100)) : 0;
      const statusLabels = { running: "LÄUFT", stopped: "GESTOPPT", setup: "RÜSTEN" };

      const card = document.createElement("div");
      card.className = `machine-card ${m.status}`;
      card.innerHTML = `
        <div class="machine-header">
          <div class="machine-name">${m.machine_id}</div>
          <div class="machine-status-badge status-${m.status}">${statusLabels[m.status] || m.status}</div>
        </div>
        <div class="machine-meta">
          <div class="meta-item">
            <div class="meta-label">ARTIKEL</div>
            <div class="meta-value">${m.article || "—"}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">OUTPUT</div>
            <div class="meta-value">${ppm} pcs/min</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">FA</div>
            <div class="meta-value">${m.fa || "—"}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">FORTSCHRITT</div>
            <div class="meta-value">${m.produced || 0} / ${m.fa_target || "—"}</div>
          </div>
        </div>
        <div class="progress-container">
          <div class="progress-label">
            <span>FA Fortschritt</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
        </div>
        <div class="machine-controls">
          <button class="ctrl-btn green" onclick="updateStatus('${m.machine_id}','running')">▶ START</button>
          <button class="ctrl-btn red" onclick="updateStatus('${m.machine_id}','stopped')">■ STOP</button>
          <button class="ctrl-btn yellow" onclick="updateStatus('${m.machine_id}','setup')">◆ RÜSTEN</button>
        </div>
        <div class="job-controls">
          <button class="job-btn start" onclick="startProduction('${m.machine_id}')">▶ JOB START</button>
          <button class="job-btn" onclick="stopProduction('${m.machine_id}')">⏹ JOB STOP</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Fehler beim Laden der Maschinen:", err);
  }
}

async function updateStatus(machine_id, status) {
  await fetch(`${API}/machines/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ machine_id, status })
  });
  loadMachines();
}

async function startProduction(machine_id) {
  const article = prompt("Artikelnummer:");
  if (!article) return;
  const fa = prompt("Fertigungsauftrag (FA):");
  const fa_target = prompt("Soll-Menge:");

  await fetch(`${API}/production/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ machine_id, article, fa, fa_target: parseInt(fa_target || 0) })
  });
  loadMachines();
}

async function stopProduction(machine_id) {
  const quantity = prompt("Ist-Menge eingeben:");
  if (!quantity) return;

  await fetch(`${API}/production/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ machine_id, quantity: parseInt(quantity) })
  });
  loadMachines();
}

// ─── SPC ───────────────────────────────────

async function loadSpcArticles() {
  try {
    const res = await fetch(`${API}/articles`);
    const articles = await res.json();
    const sel = document.getElementById("spc-article-select");
    sel.innerHTML = '<option value="">— Artikel wählen —</option>';
    articles.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = `${a.artikelnummer} · ${a.bezeichnung || ""}`;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("Artikel laden fehlgeschlagen:", err);
  }
}

async function loadSpcProcesses() {
  const articleId = document.getElementById("spc-article-select").value;
  const procSel = document.getElementById("spc-process-select");
  const charSel = document.getElementById("spc-char-select");

  procSel.innerHTML = '<option value="">— Prozess wählen —</option>';
  charSel.innerHTML = '<option value="">— Merkmal wählen —</option>';
  procSel.disabled = !articleId;
  charSel.disabled = true;

  if (!articleId) return;

  const res = await fetch(`${API}/processes/${articleId}`);
  const processes = await res.json();
  processes.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.nummer || ""} · ${p.name}`;
    procSel.appendChild(opt);
  });
  procSel.disabled = false;
}

async function loadSpcCharacteristics() {
  const procId = document.getElementById("spc-process-select").value;
  const charSel = document.getElementById("spc-char-select");

  charSel.innerHTML = '<option value="">— Merkmal wählen —</option>';
  charSel.disabled = !procId;

  if (!procId) return;

  const res = await fetch(`${API}/characteristics/${procId}`);
  const chars = await res.json();
  chars.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.dataset.sollwert = c.sollwert;
    opt.dataset.tolPlus = c.tol_plus;
    opt.dataset.tolMinus = c.tol_minus;
    opt.dataset.messmittel = c.messmittel;
    opt.textContent = c.name;
    charSel.appendChild(opt);
  });
  charSel.disabled = false;
}

async function loadSpcData() {
  const charSel = document.getElementById("spc-char-select");
  const charId = charSel.value;
  if (!charId) return;

  const selected = charSel.options[charSel.selectedIndex];
  currentCharacteristic = {
    id: charId,
    name: selected.textContent,
    sollwert: parseFloat(selected.dataset.sollwert),
    tolPlus: parseFloat(selected.dataset.tolPlus),
    tolMinus: parseFloat(selected.dataset.tolMinus),
    messmittel: selected.dataset.messmittel,
  };

  // Update info panel
  document.getElementById("spc-sollwert").textContent = currentCharacteristic.sollwert;
  document.getElementById("spc-tol-plus").textContent = `+${currentCharacteristic.tolPlus}`;
  document.getElementById("spc-tol-minus").textContent = `-${currentCharacteristic.tolMinus}`;
  document.getElementById("spc-messmittel").textContent = currentCharacteristic.messmittel || "—";
  document.getElementById("spc-info-panel").classList.remove("hidden");

  // Load measurements + SPC
  try {
    const [measRes, spcRes] = await Promise.all([
      fetch(`${API}/measurements/${charId}`),
      fetch(`${API}/spc/${charId}`)
    ]);
    const measurements = await measRes.json();
    const spc = await spcRes.json();

    renderSpcDashboard(measurements, spc, currentCharacteristic);
  } catch (err) {
    console.error("SPC Daten laden fehlgeschlagen:", err);
  }
}

function renderSpcDashboard(measurements, spc, char) {
  document.getElementById("spc-empty").classList.add("hidden");
  document.getElementById("spc-content").classList.remove("hidden");

  // KPIs
  const cpk = spc.cpk;
  const statusClass = cpk >= 1.33 ? "kpi-green" : cpk >= 1.0 ? "kpi-yellow" : "kpi-red";

  setKpi("kpi-cpk", spc.cpk?.toFixed(3) ?? "—", cpk >= 1.33 ? "kpi-green" : cpk >= 1.0 ? "kpi-yellow" : "kpi-red");
  setKpi("kpi-cp", spc.cp?.toFixed(3) ?? "—", "");
  setKpi("kpi-mean", spc.mean?.toFixed(4) ?? "—", "");
  setKpi("kpi-std", spc.std_dev?.toFixed(4) ?? "—", "");

  const statusEl = document.getElementById("kpi-status");
  statusEl.className = `kpi-card kpi-status ${statusClass}`;
  statusEl.querySelector(".kpi-value").textContent = spc.status || "—";

  const values = measurements.map(m => parseFloat(m.value));
  document.getElementById("chart-n-values").textContent = `${values.length} Messwerte`;

  const usl = char.sollwert + char.tolPlus;
  const lsl = char.sollwert - char.tolMinus;

  // ── X-Chart
  renderXChart(values, usl, lsl, char.sollwert);

  // ── Histogram
  renderHistogram(values, usl, lsl);

  // ── Table
  renderMeasurementsTable(measurements, usl, lsl);
}

function setKpi(id, value, colorClass) {
  const el = document.getElementById(id);
  el.className = `kpi-card ${colorClass}`;
  el.querySelector(".kpi-value").textContent = value;
}

function renderXChart(values, usl, lsl, target) {
  const ctx = document.getElementById("xchart").getContext("2d");
  if (xChart) xChart.destroy();

  const labels = values.map((_, i) => `#${i + 1}`);

  xChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Messwert",
          data: values,
          borderColor: "#4f7cff",
          backgroundColor: "rgba(79,124,255,0.08)",
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: values.map(v => v > usl || v < lsl ? "#f04545" : "#4f7cff"),
          tension: 0.3,
          fill: true,
        },
        {
          label: "OSG (USL)",
          data: Array(values.length).fill(usl),
          borderColor: "#f04545",
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
        {
          label: "USG (LSL)",
          data: Array(values.length).fill(lsl),
          borderColor: "#f04545",
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
        {
          label: "Sollwert",
          data: Array(values.length).fill(target),
          borderColor: "#22c97a",
          borderWidth: 1,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      animation: { duration: 400 },
      plugins: {
        legend: {
          labels: { color: "#7a8499", font: { family: "IBM Plex Mono", size: 11 }, boxWidth: 20 }
        },
        tooltip: {
          backgroundColor: "#111318",
          borderColor: "#1f2535",
          borderWidth: 1,
          titleColor: "#e8ecf4",
          bodyColor: "#7a8499",
          titleFont: { family: "IBM Plex Mono" },
          bodyFont: { family: "IBM Plex Mono", size: 11 }
        }
      },
      scales: {
        x: {
          grid: { color: "#1f2535" },
          ticks: { color: "#3d4558", font: { family: "IBM Plex Mono", size: 10 } }
        },
        y: {
          grid: { color: "#1f2535" },
          ticks: { color: "#7a8499", font: { family: "IBM Plex Mono", size: 11 } }
        }
      }
    }
  });
}

function renderHistogram(values, usl, lsl) {
  const ctx = document.getElementById("histogram").getContext("2d");
  if (histChart) histChart.destroy();

  if (values.length < 2) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.min(12, Math.ceil(Math.sqrt(values.length)));
  const binSize = (max - min) / binCount || 1;

  const bins = Array(binCount).fill(0);
  const binLabels = [];

  for (let i = 0; i < binCount; i++) {
    binLabels.push((min + i * binSize).toFixed(3));
  }

  values.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binSize), binCount - 1);
    bins[idx]++;
  });

  const barColors = binLabels.map((l, i) => {
    const center = min + (i + 0.5) * binSize;
    return center > usl || center < lsl ? "rgba(240,69,69,0.6)" : "rgba(79,124,255,0.6)";
  });

  histChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: binLabels,
      datasets: [{
        label: "Häufigkeit",
        data: bins,
        backgroundColor: barColors,
        borderColor: barColors.map(c => c.replace("0.6", "1")),
        borderWidth: 1,
        borderRadius: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: "#1f2535" },
          ticks: { color: "#3d4558", font: { family: "IBM Plex Mono", size: 9 }, maxRotation: 45 }
        },
        y: {
          grid: { color: "#1f2535" },
          ticks: { color: "#7a8499", font: { family: "IBM Plex Mono", size: 10 }, stepSize: 1 }
        }
      }
    }
  });
}

function renderMeasurementsTable(measurements, usl, lsl) {
  const container = document.getElementById("measurements-table");
  const sorted = [...measurements].reverse().slice(0, 20);

  container.innerHTML = sorted.map(m => {
    const val = parseFloat(m.value);
    const ok = val >= lsl && val <= usl;
    const ts = m.timestamp ? m.timestamp.substring(0, 16).replace("T", " ") : "—";
    return `
      <div class="meas-row">
        <span class="meas-ts">${ts}</span>
        <span class="meas-val">${val.toFixed(4)}</span>
        <span class="${ok ? 'meas-ok' : 'meas-nok'}">${ok ? "✓ IO" : "✗ NIO"}</span>
      </div>`;
  }).join("") || '<div style="color:var(--text-muted);padding:10px;font-family:var(--mono);font-size:12px">Keine Messwerte</div>';
}

// ─── MESSWERT ERFASSEN ──────────────────────

function openMeasurementModal() {
  if (!currentCharacteristic) {
    alert("Bitte zuerst ein Prüfmerkmal auswählen.");
    return;
  }
  document.getElementById("meas-value").value = "";
  document.getElementById("meas-char-info").textContent =
    `${currentCharacteristic.name} · Soll: ${currentCharacteristic.sollwert} ` +
    `[+${currentCharacteristic.tolPlus} / -${currentCharacteristic.tolMinus}]`;
  document.getElementById("measurement-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("meas-value").focus(), 100);
}

async function saveMeasurement() {
  const value = document.getElementById("meas-value").value;
  if (!value || !currentCharacteristic) return;

  try {
    await fetch(`${API}/measurements?characteristic_id=${currentCharacteristic.id}&value=${encodeURIComponent(value)}`, {
      method: "POST"
    });
    closeModal("measurement-modal");
    loadSpcData(); // Reload charts
  } catch (err) {
    console.error("Messwert speichern fehlgeschlagen:", err);
  }
}

// Enter-Taste im Measurement-Modal
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && !document.getElementById("measurement-modal").classList.contains("hidden")) {
    saveMeasurement();
  }
});


navigate("dashboard");

// ═══════════════════════════════════════════
// FEHLERSAMMELKARTE
// ═══════════════════════════════════════════

const FEHLERARTEN = [
  { id: "luft",        name: "Luft- / Fließfehler",     code: "a" },
  { id: "wkzg",        name: "Wkzg.-Verschmutzung",      code: "b" },
  { id: "blasen",      name: "Blasen",                   code: "c" },
  { id: "material",    name: "Material fehlt",           code: "d" },
  { id: "feder",       name: "Zusatzteil / Feder",       code: "e" },
  { id: "dichtkante",  name: "Dichtkantenfehler",        code: "f" },
  { id: "stech",       name: "Stechfehler",              code: "g" },
  { id: "doppel",      name: "Doppelschnitt",            code: "h" },
  { id: "fremd",       name: "Fremdkörper / Stippen",    code: "i" },
  { id: "wkzgfehler",  name: "Werkzeugfehler",           code: "j" },
  { id: "abfall",      name: "Abfall",                   code: "k" },
  { id: "platzer",     name: "Platzer",                  code: "l" },
  { id: "blech",       name: "Blech n.i.O.",             code: "m" },
  { id: "rohling",     name: "Rohling",                  code: "n" },
  { id: "sonstige",    name: "Sonstige",                 code: "o" },
];

const FEHLERORTE = [
  "1 - Dichtkante", "2 - Kontaktfläche", "3 - Lauffläche",
  "4 - Staublippe", "5 - Boden", "6 - Außenmantel",
  "7 - Membranfläche", "8 - Federhaltebund", "9 - Drall", "10 - Federrille"
];

let fskChecks = { feder: null, bindung: null };
let fskKarten = [];
let paretoChart = null, fehlerortChart = null, nioTrendChart = null;

function initFehlersammelkarte() {
  renderFehlerRows();
  setTodayDate();
  fskUpdateSumme();
  // Init auswertung if needed
}

function setTodayDate() {
  const el = document.getElementById("fsk-datum");
  if (el && !el.value) {
    el.value = new Date().toISOString().split("T")[0];
  }
}

function renderFehlerRows() {
  const container = document.getElementById("fsk-fehler-rows");
  if (!container) return;

  container.innerHTML = FEHLERARTEN.map(f => `
    <div class="fsk-fehler-row" id="row-${f.id}">
      <div class="fsk-fehler-name">
        <span class="fsk-code-small">${f.code}</span>
        ${f.name}
      </div>
      <div class="fsk-fehlerort-cell">
        <select class="form-select fsk-ort-select" id="ort-${f.id}">
          <option value="">—</option>
          ${FEHLERORTE.map(o => `<option value="${o}">${o}</option>`).join("")}
        </select>
      </div>
      <div class="fsk-counter-cell">
        <button class="fsk-counter-btn minus" onclick="fskCount('${f.id}', -1)">−</button>
        <button class="fsk-counter-btn plus" onclick="fskCount('${f.id}', +1)">+</button>
      </div>
      <div class="fsk-anzahl-cell">
        <span class="fsk-anzahl" id="cnt-${f.id}">0</span>
      </div>
    </div>
  `).join("");
}

function fskCount(id, delta) {
  const el = document.getElementById(`cnt-${id}`);
  const current = parseInt(el.textContent) || 0;
  const next = Math.max(0, current + delta);
  el.textContent = next;
  const row = document.getElementById(`row-${id}`);
  row.classList.toggle("fsk-row-active", next > 0);
  fskUpdateSumme();
}

function fskUpdateSumme() {
  let total = 0;
  FEHLERARTEN.forEach(f => {
    const el = document.getElementById(`cnt-${f.id}`);
    if (el) total += parseInt(el.textContent) || 0;
  });

  const geprueft = parseInt(document.getElementById("fsk-geprueft")?.value) || 0;
  const pct = geprueft > 0 ? ((total / geprueft) * 100).toFixed(2) + " %" : "—";

  const nioEl = document.getElementById("fsk-summe-nio");
  const pctEl = document.getElementById("fsk-summe-pct");
  if (nioEl) nioEl.textContent = total;
  if (pctEl) {
    pctEl.textContent = pct;
    pctEl.style.color = total > 0 ? "var(--red)" : "var(--green)";
  }
}

function setCheck(type, value) {
  fskChecks[type] = value;
  ["io", "nio"].forEach(v => {
    const btn = document.getElementById(`${type}-${v}`);
    if (btn) btn.classList.toggle("active", v === value);
  });
}

function fskTab(tab) {
  document.querySelectorAll(".fsk-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.fsk === tab)
  );
  document.querySelectorAll(".fsk-pane").forEach(p =>
    p.classList.toggle("active", p.id === `fsk-${tab}`)
  );
  if (tab === "auswertung") renderFskAuswertung();
  if (tab === "historie") renderFskHistorie();
}

function fskReset() {
  FEHLERARTEN.forEach(f => {
    const el = document.getElementById(`cnt-${f.id}`);
    if (el) el.textContent = "0";
    const row = document.getElementById(`row-${f.id}`);
    if (row) row.classList.remove("fsk-row-active");
    const ort = document.getElementById(`ort-${f.id}`);
    if (ort) ort.value = "";
  });
  fskChecks = { feder: null, bindung: null };
  ["feder-io","feder-nio","bindung-io","bindung-nio"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  });
  document.getElementById("fsk-geprueft").value = "";
  document.getElementById("fsk-notiz").value = "";
  document.getElementById("fsk-nacharbeit").value = "";
  document.getElementById("fsk-anfahrausschuss").value = "";
  fskUpdateSumme();
}

async function fskSpeichern() {
  const artikel = document.getElementById("fsk-artikel").value;
  const geprueft = parseInt(document.getElementById("fsk-geprueft").value) || 0;

  if (!artikel) { alert("Bitte Artikel-Nr. eingeben."); return; }
  if (geprueft === 0) { alert("Bitte Geprüfte Teile eingeben."); return; }

  // Collect fehler counts mapped to API field names
  const FEHLER_MAP = {
    luft:       "luft_fliess",
    wkzg:       "wkzg_verschmutzung",
    blasen:     "blasen",
    material:   "material_fehlt",
    feder:      "zusatzteil_feder",
    dichtkante: "dichtkantenfehler",
    stech:      "stechfehler",
    doppel:     "doppelschnitt",
    fremd:      "fremdkoerper_stippen",
    wkzgfehler: "werkzeugfehler",
    abfall:     "abfall",
    platzer:    "platzer",
    blech:      "blech_nio",
    rohling:    "rohling",
    sonstige:   "sonstige",
  };

  const payload = {
    artikelnummer: artikel,
    typ: document.getElementById("fsk-typ").value,
    material: document.getElementById("fsk-material").value,
    auftrag_nr: document.getElementById("fsk-auftrag").value,
    chargen_nr: document.getElementById("fsk-charge").value,
    maschine: document.getElementById("fsk-maschine").value,
    operator: document.getElementById("fsk-operator").value,
    schicht: document.getElementById("fsk-schicht").value,
    datum: document.getElementById("fsk-datum").value,
    geprueft,
    nacharbeit: parseInt(document.getElementById("fsk-nacharbeit").value) || 0,
    anfahrausschuss: parseInt(document.getElementById("fsk-anfahrausschuss").value) || 0,
    bindung: document.getElementById("fsk-bindung").value,
    freigabe: document.getElementById("fsk-freigabe").value,
    notiz: document.getElementById("fsk-notiz").value,
    federkontrolle: fskChecks.feder,
    bindungspruefung: fskChecks.bindung,
  };

  // Add fehler counts + collect fehlerorte
  const fehlerorteMap = {};
  let nioGesamt = 0;
  FEHLERARTEN.forEach(f => {
    const cnt = parseInt(document.getElementById(`cnt-${f.id}`)?.textContent) || 0;
    payload[FEHLER_MAP[f.id]] = cnt;
    nioGesamt += cnt;
    const ort = document.getElementById(`ort-${f.id}`)?.value;
    if (cnt > 0 && ort) fehlerorteMap[f.name] = ort;
  });

  payload.fehlerorte = JSON.stringify(fehlerorteMap);

  try {
    const btn = document.querySelector(".fsk-actions .btn-primary");
    btn.textContent = "Speichern...";
    btn.disabled = true;

    const res = await fetch(`${API}/defects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    btn.textContent = "💾 Karte speichern";
    btn.disabled = false;

    const pct = geprueft > 0 ? ((nioGesamt / geprueft) * 100).toFixed(2) : 0;
    fskReset();
    alert(`✓ Karte gespeichert! (ID: ${data.id})\n${nioGesamt} NiO von ${geprueft} Teilen (${pct} %)`);

  } catch (err) {
    console.error("FSK speichern fehlgeschlagen:", err);
    alert("Fehler beim Speichern. Verbindung prüfen.");
    document.querySelector(".fsk-actions .btn-primary").textContent = "💾 Karte speichern";
    document.querySelector(".fsk-actions .btn-primary").disabled = false;
  }
}

// ─── AUSWERTUNG ───────────────────────────

async function renderFskAuswertung() {
  // Load from API
  try {
    const res = await fetch(`${API}/defects`);
    fskKarten = await res.json();
  } catch(e) { console.error(e); }
  if (fskKarten.length === 0) return;

  // Aggregate fehler counts
  const fehlersumme = {};
  const ortsumme = {};
  const trendLabels = [];
  const trendData = [];

  fskKarten.slice().reverse().forEach(k => {
    const pct = k.anteil_nio ?? k.nioPct ?? 0;
    trendLabels.push(`${k.datum || ""} ${k.schicht || ""}`);
    trendData.push(parseFloat(pct));
    // API returns fehler as {name: count} with only non-zero
    Object.entries(k.fehler || {}).forEach(([name, cnt]) => {
      if (cnt > 0) fehlersumme[name] = (fehlersumme[name] || 0) + cnt;
    });
    // Parse fehlerorte JSON string from API
    let orteObj = {};
    try { orteObj = JSON.parse(k.fehlerorte || "{}"); } catch(e) {}
    Object.entries(orteObj).forEach(([name, ort]) => {
      if (ort) ortsumme[ort] = (ortsumme[ort] || 0) + (k.fehler?.[name] || 0);
    });
  });

  // Pareto — sort descending
  const sorted = Object.entries(fehlersumme).sort((a, b) => b[1] - a[1]);
  const paretoLabels = sorted.map(([k]) => k);
  const paretoData = sorted.map(([, v]) => v);
  const total = paretoData.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  const cumPct = paretoData.map(v => {
    cumulative += v;
    return Math.round((cumulative / total) * 100);
  });

  document.getElementById("pareto-subtitle").textContent =
    `${fskKarten.length} Karte(n) · ${total} NiO gesamt`;

  // Pareto Chart
  if (paretoChart) paretoChart.destroy();
  const ctx1 = document.getElementById("pareto-chart").getContext("2d");
  paretoChart = new Chart(ctx1, {
    data: {
      labels: paretoLabels,
      datasets: [
        {
          type: "bar",
          label: "Anzahl",
          data: paretoData,
          backgroundColor: paretoData.map((_, i) =>
            i === 0 ? "rgba(240,69,69,0.7)" : i < 3 ? "rgba(245,200,66,0.6)" : "rgba(79,124,255,0.5)"
          ),
          borderColor: "transparent",
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Kumuliert %",
          data: cumPct,
          borderColor: "#22c97a",
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
          yAxisID: "y2",
          tension: 0.3,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#7a8499", font: { family: "IBM Plex Mono", size: 11 }, boxWidth: 16 } },
        tooltip: { backgroundColor: "#111318", borderColor: "#1f2535", borderWidth: 1, titleColor: "#e8ecf4", bodyColor: "#7a8499" }
      },
      scales: {
        x: { grid: { color: "#1f2535" }, ticks: { color: "#7a8499", font: { family: "IBM Plex Mono", size: 10 }, maxRotation: 35 } },
        y: { grid: { color: "#1f2535" }, ticks: { color: "#7a8499", font: { family: "IBM Plex Mono", size: 10 } }, position: "left" },
        y2: { min: 0, max: 100, position: "right", grid: { drawOnChartArea: false }, ticks: { color: "#22c97a", font: { family: "IBM Plex Mono", size: 10 }, callback: v => v + "%" } }
      }
    }
  });

  // Fehlerort Chart
  const ortEntries = Object.entries(ortsumme).sort((a, b) => b[1] - a[1]);
  if (fehlerortChart) fehlerortChart.destroy();
  const ctx2 = document.getElementById("fehlerort-chart").getContext("2d");
  fehlerortChart = new Chart(ctx2, {
    type: "doughnut",
    data: {
      labels: ortEntries.map(([k]) => k),
      datasets: [{
        data: ortEntries.map(([, v]) => v),
        backgroundColor: ["#f04545","#f5c842","#4f7cff","#22c97a","#a855f7","#f97316","#06b6d4","#ec4899","#84cc16","#8b5cf6"],
        borderColor: "#111318",
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: "right", labels: { color: "#7a8499", font: { family: "IBM Plex Mono", size: 10 }, boxWidth: 12 } }
      }
    }
  });

  // NIO Trend
  if (nioTrendChart) nioTrendChart.destroy();
  const ctx3 = document.getElementById("nio-trend-chart").getContext("2d");
  nioTrendChart = new Chart(ctx3, {
    type: "line",
    data: {
      labels: trendLabels,
      datasets: [{
        label: "NiO %",
        data: trendData,
        borderColor: "#f5c842",
        backgroundColor: "rgba(245,200,66,0.08)",
        borderWidth: 2,
        pointRadius: 4,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: trendData.map(v => v > 5 ? "#f04545" : "#22c97a"),
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "#1f2535" }, ticks: { color: "#3d4558", font: { family: "IBM Plex Mono", size: 9 }, maxRotation: 35 } },
        y: { grid: { color: "#1f2535" }, ticks: { color: "#7a8499", font: { family: "IBM Plex Mono", size: 10 }, callback: v => v + "%" } }
      }
    }
  });
}

// ─── HISTORIE ────────────────────────────

async function renderFskHistorie() {
  const container = document.getElementById("fsk-historie-list");
  try {
    const res = await fetch(`${API}/defects`);
    fskKarten = await res.json();
  } catch(e) { console.error(e); }
  if (!fskKarten.length) return;

  container.innerHTML = fskKarten.map(k => {
    const nio = k.nio_gesamt ?? k.nioGesamt ?? 0;
    const pct = k.anteil_nio ?? k.nioPct ?? 0;
    const artikel = k.artikelnummer ?? k.artikel ?? "—";
    const aktiveFehler = Object.entries(k.fehler || {}).filter(([,v]) => v > 0);
    return `
    <div class="fsk-hist-card">
      <div class="fsk-hist-header">
        <div>
          <span class="fsk-hist-artikel">${artikel}</span>
          <span class="fsk-hist-typ">${k.typ || ""}</span>
        </div>
        <div class="fsk-hist-meta">
          <span>${k.datum || "—"}</span>
          <span class="fsk-badge-schicht">${k.schicht || "—"}</span>
          <span>${k.maschine || "—"}</span>
          <span>${k.operator || "—"}</span>
        </div>
      </div>
      <div class="fsk-hist-kpis">
        <div class="fsk-hist-kpi">
          <span class="fsk-hist-kpi-val">${k.geprueft}</span>
          <span class="fsk-hist-kpi-label">Geprüft</span>
        </div>
        <div class="fsk-hist-kpi">
          <span class="fsk-hist-kpi-val" style="color:${nio > 0 ? "var(--red)" : "var(--green)"}">${nio}</span>
          <span class="fsk-hist-kpi-label">n.i.O.</span>
        </div>
        <div class="fsk-hist-kpi">
          <span class="fsk-hist-kpi-val" style="color:${parseFloat(pct) > 5 ? "var(--red)" : "var(--green)"}">${pct} %</span>
          <span class="fsk-hist-kpi-label">Anteil</span>
        </div>
        <div class="fsk-hist-fehler">
          ${aktiveFehler.map(([name, cnt]) =>
            `<span class="fsk-fehler-badge">${name}: ${cnt}</span>`
          ).join("")}
        </div>
      </div>
      ${k.notiz ? `<div class="fsk-hist-notiz">${k.notiz}</div>` : ""}
    </div>`;
  }).join("");
}
