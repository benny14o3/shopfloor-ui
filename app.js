const API = window.API_URL;

async function loadMachines(){

const res = await fetch(`${API}/machines`);
const machines = await res.json();

const container = document.getElementById("machines");
container.innerHTML="";

machines.forEach(machine=>{

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

<div class="machine-info">Artikel: ${machine.article || "-"}</div>

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

`;

container.appendChild(card);

});

}

loadMachines();

setInterval(loadMachines,3000);