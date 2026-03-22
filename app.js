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

// ─── FEHLERSAMMELKARTE ─────────────────────

const FEHLERARTEN = [
  { key: "luft_fliess",          label: "Luft-/Fließfehler",       code: "a" },
  { key: "wkzg_verschmutzung",   label: "Wkzg.-Verschmutzung",     code: "b" },
  { key: "blasen",               label: "Blasen",                  code: "c" },
  { key: "material_fehlt",       label: "Material fehlt",          code: "d" },
  { key: "zusatzteil_feder",     label: "Zusatzteil/Feder",        code: "e" },
  { key: "dichtkantenfehler",    label: "Dichtkantenfehler",       code: "f" },
  { key: "stechfehler",          label: "Stechfehler",             code: "g" },
  { key: "doppelschnitt",        label: "Doppelschnitt",           code: "h" },
  { key: "fremdkoerper_stippen", label: "Fremdkörper/Stippen",     code: "i" },
  { key: "werkzeugfehler",       label: "Werkzeugfehler",          code: "j" },
  { key: "abfall",               label: "Abfall",                  code: "k" },
  { key: "platzer",              label: "Platzer",                 code: "l" },
  { key: "blech_nio",            label: "Blech n.i.O.",            code: "m" },
  { key: "rohling",              label: "Rohling",                 code: "n" },
  { key: "sonstige",             label: "Sonstige",                code: "—" },
];

let fskCounts = {};

function initFskPage() {
  // Set today's date
  document.getElementById("fsk-datum").value = new Date().toISOString().split("T")[0];

  // Reset counts
  fskCounts = {};
  FEHLERARTEN.forEach(f => fskCounts[f.key] = 0);

  // Build fehler rows
  const list = document.getElementById("fsk-fehler-list");
  list.innerHTML = FEHLERARTEN.map(f => `
    <div class="fsk-fehler-row" id="fsk-row-${f.key}">
      <div class="fsk-fehler-name">
        <span style="color:var(--text-muted);margin-right:6px">${f.code}</span>${f.label}
      </div>
      <div class="fsk-counter">
        <button class="fsk-count-btn minus" onclick="fskChange('${f.key}', -1)">−</button>
        <span class="fsk-count-val" id="fsk-val-${f.key}">0</span>
        <button class="fsk-count-btn plus" onclick="fskChange('${f.key}', +1)">+</button>
      </div>
      <div class="fsk-tally" id="fsk-tally-${f.key}"></div>
    </div>
  `).join("");

  // Load articles for selector
  loadFskArticles();
  loadFskHistory();
}

function fskChange(key, delta) {
  fskCounts[key] = Math.max(0, (fskCounts[key] || 0) + delta);
  const val = fskCounts[key];

  const valEl = document.getElementById(`fsk-val-${key}`);
  valEl.textContent = val;
  valEl.className = `fsk-count-val${val > 0 ? " nonzero" : ""}`;

  const row = document.getElementById(`fsk-row-${key}`);
  row.className = `fsk-fehler-row${val > 0 ? " has-value" : ""}`;

  // Tally marks (strichliste style)
  const tally = document.getElementById(`fsk-tally-${key}`);
  tally.textContent = val > 0 ? makeTally(val) : "";

  updateFskSummary();
}

function makeTally(n) {
  let s = "";
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 5 === 0) s += " ";
    s += i % 5 === 4 ? "卌" : "丨";
  }
  return s.length > 20 ? `(${n})` : s;
}

function updateFskSummary() {
  const nio = FEHLERARTEN.reduce((sum, f) => sum + (fskCounts[f.key] || 0), 0);
  const geprueft = parseInt(document.getElementById("fsk-geprueft").value) || 0;
  const pct = geprueft > 0 ? (nio / geprueft * 100).toFixed(2) : "0.00";

  document.getElementById("sum-nio").textContent = nio;
  document.getElementById("sum-geprueft").textContent = geprueft;
  document.getElementById("sum-pct").textContent = `${pct} %`;
}

async function loadFskArticles() {
  try {
    const res = await fetch(`${API}/articles`);
    const articles = await res.json();

    const sel = document.getElementById("fsk-article");
    const filterSel = document.getElementById("fsk-filter-artikel");

    [sel, filterSel].forEach(s => {
      const first = s.options[0];
      s.innerHTML = "";
      s.appendChild(first);
    });

    articles.forEach(a => {
      const label = `${a.artikelnummer} · ${a.bezeichnung || ""}`;
      [sel, filterSel].forEach(s => {
        const opt = document.createElement("option");
        opt.value = a.artikelnummer;
        opt.textContent = label;
        s.appendChild(opt);
      });
    });
  } catch(e) { console.error(e); }
}

function onFskArticleChange() {
  // Could pre-fill auftrag info later
}

async function saveFsk() {
  const geprueft = parseInt(document.getElementById("fsk-geprueft").value) || 0;
  const artikelnummer = document.getElementById("fsk-article").value;

  if (!artikelnummer) { alert("Bitte Artikel wählen."); return; }
  if (!geprueft) { alert("Bitte Prüflosgröße eingeben."); return; }

  const payload = {
    artikelnummer,
    auftrag_nr: document.getElementById("fsk-auftrag").value,
    chargen_nr: document.getElementById("fsk-charge").value,
    maschine: document.getElementById("fsk-maschine").value,
    operator: document.getElementById("fsk-operator").value,
    schicht: document.getElementById("fsk-schicht").value,
    datum: document.getElementById("fsk-datum").value,
    geprueft,
    nacharbeit: parseInt(document.getElementById("fsk-nacharbeit").value) || 0,
    anfahrausschuss: parseInt(document.getElementById("fsk-anfahrausschuss").value) || 0,
    notiz: document.getElementById("fsk-notiz").value,
    ...fskCounts,
  };

  try {
    const res = await fetch(`${API}/defects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.id) {
      // Reset counts
      FEHLERARTEN.forEach(f => {
        fskCounts[f.key] = 0;
        document.getElementById(`fsk-val-${f.key}`).textContent = "0";
        document.getElementById(`fsk-val-${f.key}`).className = "fsk-count-val";
        document.getElementById(`fsk-row-${f.key}`).className = "fsk-fehler-row";
        document.getElementById(`fsk-tally-${f.key}`).textContent = "";
      });
      document.getElementById("fsk-geprueft").value = "";
      document.getElementById("fsk-notiz").value = "";
      updateFskSummary();
      loadFskHistory();
      loadFskPareto();
    }
  } catch(e) { console.error("Speichern fehlgeschlagen:", e); }
}

async function loadFskHistory() {
  const filter = document.getElementById("fsk-filter-artikel")?.value || "";
  try {
    const url = filter ? `${API}/defects?artikelnummer=${encodeURIComponent(filter)}` : `${API}/defects`;
    const res = await fetch(url);
    const entries = await res.json();

    const container = document.getElementById("fsk-history");
    if (!entries.length) {
      container.innerHTML = '<div style="color:var(--text-muted);font-family:var(--mono);font-size:12px;padding:10px">Noch keine Einträge</div>';
      return;
    }

    container.innerHTML = entries.slice(0, 20).map(e => {
      const pct = e.anteil_nio;
      const badgeClass = pct === 0 ? "fsk-nio-ok" : pct < 1 ? "fsk-nio-warn" : "fsk-nio-bad";
      const pills = Object.entries(e.fehler)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `<span class="fsk-pill">${k}: ${v}</span>`)
        .join("");

      return `
        <div class="fsk-history-row">
          <div class="fsk-history-top">
            <span class="fsk-history-title">${e.artikelnummer || "—"} · ${e.datum || "—"} · ${e.schicht || "—"}</span>
            <span class="fsk-nio-badge ${badgeClass}">${e.nio_gesamt} NiO · ${pct}%</span>
          </div>
          <div class="fsk-history-meta" style="margin-bottom:6px">
            ${e.maschine || "—"} · ${e.operator || "—"} · ${e.geprueft} geprüft
          </div>
          <div class="fsk-history-pills">${pills || '<span style="color:var(--text-muted);font-size:10px;font-family:var(--mono)">Keine Fehler erfasst</span>'}</div>
        </div>`;
    }).join("");

    loadFskPareto(entries);
  } catch(e) { console.error(e); }
}

let paretoChart = null;
function loadFskPareto(entries) {
  if (!entries) return;

  // Aggregate all fehler counts
  const totals = {};
  FEHLERARTEN.forEach(f => totals[f.label] = 0);
  entries.forEach(e => {
    FEHLERARTEN.forEach(f => {
      totals[f.label] += (e.fehler[f.label] || 0);
    });
  });

  // Sort descending
  const sorted = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!sorted.length) return;

  const labels = sorted.map(([k]) => k);
  const values = sorted.map(([, v]) => v);
  const total = values.reduce((a, b) => a + b, 0);

  // Cumulative %
  let cum = 0;
  const cumPct = values.map(v => {
    cum += v;
    return parseFloat((cum / total * 100).toFixed(1));
  });

  const ctx = document.getElementById("fsk-pareto").getContext("2d");
  if (paretoChart) paretoChart.destroy();

  paretoChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Anzahl",
          data: values,
          backgroundColor: "rgba(79,124,255,0.6)",
          borderColor: "#4f7cff",
          borderWidth: 1,
          borderRadius: 3,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Kumuliert %",
          data: cumPct,
          borderColor: "#f5c842",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#f5c842",
          tension: 0.1,
          yAxisID: "y2",
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: "#7a8499", font: { family: "IBM Plex Mono", size: 10 }, boxWidth: 16 } }
      },
      scales: {
        x: {
          grid: { color: "#1f2535" },
          ticks: { color: "#3d4558", font: { family: "IBM Plex Mono", size: 9 }, maxRotation: 35 }
        },
        y: {
          grid: { color: "#1f2535" },
          ticks: { color: "#7a8499", font: { family: "IBM Plex Mono", size: 10 } },
          beginAtZero: true,
        },
        y2: {
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#f5c842", font: { family: "IBM Plex Mono", size: 10 }, callback: v => `${v}%` },
          min: 0, max: 100,
        }
      }
    }
  });
}

// ─── INIT ──────────────────────────────────

navigate("dashboard");
