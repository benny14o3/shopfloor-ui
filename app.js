alert("JS läuft")

console.log("APP STARTED")

const API = "https://shopfloor-backend.onrender.com"

// Artikel laden
async function loadArticles(){

const res = await fetch(API + "/articles")
const articles = await res.json()

const container = document.getElementById("articles")

container.innerHTML=""

articles.forEach(a => {

const div = document.createElement("div")

div.innerHTML = `
<h3>${a.artikelnummer}</h3>
<p>${a.bezeichnung}</p>
<p>Material: ${a.material}</p>
<p>Werkzeug: ${a.werkzeug}</p>
`

container.appendChild(div)

})

}

// Maschinenstatus anzeigen
function loadMachines(){

const machines = [
{ name:"Presse 1", status:"🟢" },
{ name:"Presse 2", status:"🟡" },
{ name:"Presse 3", status:"🔴" }
]

const container = document.getElementById("machines")

machines.forEach(m => {

const div = document.createElement("div")

div.innerHTML = `${m.name} ${m.status}`

container.appendChild(div)

})

}

// Dummy SPC Chart
function loadSPC(){

const ctx = document.getElementById("spcChart")

new Chart(ctx, {
type: "line",
data: {
labels: [1,2,3,4,5,6],
datasets: [{
label: "Messwerte",
data: [24.98,25.02,24.99,25.01,24.97,25.03],
borderColor: "blue",
tension: 0.3
}]
}
})

}

loadMachines()
loadArticles()
loadSPC()