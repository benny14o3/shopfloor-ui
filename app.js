const API = "https://shopfloor-backend.onrender.com";

let spcChart;

async function loadMachines() {

const res = await fetch(`${API}/machines`);
const machines = await res.json();

const container = document.getElementById("machines");
container.innerHTML = "";

machines.forEach(m => {

const card = document.createElement("div");
card.className = `machine-card ${m.status}`;

card.innerHTML = `
<div>${m.machine_id}</div>
<div>Status: ${m.status}</div>
<div>Artikel: ${m.article || "-"}</div>
<div>Stück: ${m.produced || 0}</div>
`;

container.appendChild(card);

});

}

async function loadProduction() {

const res = await fetch(`${API}/production/active`);
const data = await res.json();

const tbody = document.querySelector("#production-table tbody");
tbody.innerHTML = "";

data.forEach(row => {

const tr = document.createElement("tr");

tr.innerHTML = `
<td>${row.machine}</td>
<td>${row.article}</td>
<td>${row.start}</td>
<td>${row.quantity}</td>
`;

tbody.appendChild(tr);

});

}

async function loadArticle(){

const article = document.getElementById("articleSearch").value;

const res = await fetch(`${API}/articles/${article}`);
const data = await res.json();

document.getElementById("articleInfo").innerHTML = `
<p><b>Artikel:</b> ${data.article_number}</p>
<p><b>Beschreibung:</b> ${data.description}</p>
<p><b>Werkzeug:</b> ${data.tool}</p>
<p><b>Zykluszeit:</b> ${data.cycle_time}s</p>
`;

loadSPC(article);

}

async function loadSPC(article){

const res = await fetch(`${API}/spc/${article}`);
const data = await res.json();

const values = data.map(x => x.value);
const labels = data.map(x => x.timestamp);

const ctx = document.getElementById("spcChart");

if(spcChart) spcChart.destroy();

spcChart = new Chart(ctx,{
type:"line",
data:{
labels:labels,
datasets:[{
label:"SPC Messwert",
data:values,
tension:0.2
}]
}
});

}

async function init(){

await loadMachines();
await loadProduction();

}

init();

setInterval(loadMachines,5000);
setInterval(loadProduction,5000);