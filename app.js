const API = "https://shopfloor-backend.onrender.com"

async function loadArticles(){

try{

const res = await fetch(API + "/articles")
const articles = await res.json()

const container = document.getElementById("articles")

if(!container) return

container.innerHTML=""

articles.forEach(a => {

const div = document.createElement("div")

div.innerHTML = `
<h3>${a.artikelnummer}</h3>
<p>${a.bezeichnung}</p>
<p>Material: ${a.material}</p>
<p>Werkzeug: ${a.werkzeug}</p>
<p>Kavitäten: ${a.kavitaeten}</p>
`

container.appendChild(div)

})

}catch(err){

console.log("API Fehler:", err)

}

}

loadArticles()

function loadMachines(){

const machines = [
{name:"Presse 1",status:"🟢 Produktion"},
{name:"Presse 2",status:"🟡 Rüsten"},
{name:"Presse 3",status:"🔴 Störung"}
]

const container = document.getElementById("machines")

machines.forEach(m => {

const div = document.createElement("div")

div.innerHTML = `
<b>${m.name}</b> – ${m.status}
`

container.appendChild(div)

})

}

loadMachines()