const API = "https://shopfloor-backend.onrender.com"

async function loadArticles(){

const res = await fetch(API + "/articles")
const articles = await res.json()

const container = document.getElementById("articles")

container.innerHTML=""

articles.forEach(a => {

const card = document.createElement("div")

card.innerHTML = `
<h3>${a.artikelnummer}</h3>
<p>${a.bezeichnung}</p>
<p>Material: ${a.material}</p>
<p>Werkzeug: ${a.werkzeug}</p>
<p>Kavitäten: ${a.kavitaeten}</p>
`

container.appendChild(card)

})

}

loadArticles()