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
          Stück: ${machine.produced || 0} / ${machine.target || "-"}
        </div>

        <div class="machine-info">
          Cycle: ${machine.cycle_time || "-"} s
        </div>

        <div class="machine-info">
          Output: ${piecesPerMin} pcs/min
        </div>

        <div class="progress-bar">
          <div class="progress" style="width:${progress}%"></div>
        </div>

        <div class="controls">
          <button onclick="updateStatus('${machine.machine_id}','running')">START</button>
          <button onclick="updateStatus('${machine.machine_id}','stopped')">STOP</button>
          <button onclick="updateStatus('${machine.machine_id}','setup')">SETUP</button>
        </div>
      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error("Fehler beim Laden:", err);
  }
}

async function updateStatus(machine_id, status) {
  try {
    await fetch(`${API}/machines/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        machine_id,
        status
      })
    });

    // direkt neu laden
    loadMachines();

  } catch (err) {
    console.error("Fehler beim Status-Update:", err);
  }
}

// initial laden
loadMachines();

// alle 3 Sekunden aktualisieren
setInterval(loadMachines, 3000);