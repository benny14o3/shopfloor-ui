const API = window.API_URL;

async function loadMachines(){

const res = await fetch(`${API}/machines`);

const machines = await res.json();

const container = document.getElementById("machines");

container.innerHTML="";

machines.forEach(machine=>{

const card = document.createElement("div");

card.className = `machine-card ${machine.status}`;

card.innerHTML = `

<div class="machine-name">${machine.machine_id}</div>

<div class="machine-info">Status: ${machine.status}</div>

<div class="machine-info">Artikel: ${machine.article || "-"}</div>

<div class="machine-info">Stück: ${machine.produced || 0}</div>

`;

container.appendChild(card);

});

}

loadMachines();

setInterval(loadMachines,3000);