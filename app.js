const API = window.API_URL || "https://shopfloor-backend.onrender.com";

async function loadMachines() {
  try {
    const res = await fetch(`${API}/machines`);
    const machines = await res.json();

    console.log("Machines:", machines);

    if (!Array.isArray(machines)) {
      console.error("API liefert kein Array", machines);
      return;
    }

    const container = document.getElementById("machines");
    container.innerHTML = "";

    machines.forEach(machine => {

      const piecesPerMin = machine.cycle_time
        ? (60 / machine.cycle_time).toFixed(1)
        : "-";

      const progress = machine.target
        ? Math.round((machine.produced / machine.target) * 100)
        : 0;

      const card = document.createElement("div");
      card.className = `machine-card ${machine.status}`;

      card.innerHTML = `

        <div class="machine-name">${machine.machine_id}</div>

        <div class="machine-info">Status: ${machine.status}</div>

        <div class="machine-info">
          Artikel: ${machine.article || "-"}
        </div>

        <div class="machine-info">
          Output: ${piecesPerMin} pcs/min
        </div>
	<div class="machine-info">
	FA: ${machine.fa || "-"}
	</div>

	<div class="machine-info">
	FA Menge: ${machine.fa_target || "-"}
	</div>

        <div class="progress-bar">
          <div class="progress" style="width:${progress}%"></div>
        </div>

        <div class="controls">
          <button onclick="updateStatus('${machine.machine_id}','running')">🟢 START</button>
          <button onclick="updateStatus('${machine.machine_id}','stopped')">🔴 STOP</button>
          <button onclick="updateStatus('${machine.machine_id}','setup')">🟡 SETUP</button>
        </div>

        <div class="controls">
          <button onclick="startProduction('${machine.machine_id}')">▶️ JOB START</button>
          <button onclick="stopProduction('${machine.machine_id}')">⏹ JOB STOP</button>
        </div>

      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error("Fehler beim Laden:", err);
  }
}


// STATUS UPDATE
async function updateStatus(machine_id, status) {
  try {
    await fetch(`${API}/machines/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ machine_id, status })
    });

    loadMachines();

  } catch (err) {
    console.error("Fehler beim Status-Update:", err);
  }
}


// PRODUKTION START
async function startProduction(machine_id){

  const article = prompt("Artikelnummer:");
  if (!article) return;

  const fa = prompt("Fertigungsauftrag (FA):");
  const fa_target = prompt("FA Menge:");

  await fetch(`${API}/production/start`, {
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      machine_id,
      article,
      fa,
      fa_target: parseInt(fa_target || 0)
    })
  });

  loadMachines();
}

// PRODUKTION STOP
async function stopProduction(machine_id) {

  const quantity = prompt("Stückzahl eingeben:");

  if (!quantity) return;

  try {
    await fetch(`${API}/production/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        machine_id,
        quantity: parseInt(quantity)
      })
    });

    loadMachines();

  } catch (err) {
    console.error("Fehler beim Stop:", err);
  }
}


// INITIAL LOAD
loadMachines();

// AUTO REFRESH
setInterval(loadMachines, 3000);