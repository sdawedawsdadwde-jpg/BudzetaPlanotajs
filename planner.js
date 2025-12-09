import { db, auth } from "./firebase.js"
import { uid, getPlannerCatList, onSettings, formatMoney } from "./common.js"
import { ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"

const planForm = document.getElementById("planForm")
const planNameEl = document.getElementById("planName")
const plansList = document.getElementById("plansList")
const planItemForm = document.getElementById("planItemForm")
const planSelect = document.getElementById("planSelect")
const itemTitleEl = document.getElementById("itemTitle")
const planCatSelect = document.getElementById("planCatSelect")
const itemCostEl = document.getElementById("itemCost")
const planItemsList = document.getElementById("planItemsList")

let plans = {}

onSettings(()=> hydratePlannerCats())

function hydratePlannerCats(){
  const cats = getPlannerCatList()
  planCatSelect.innerHTML=""
  cats.forEach(c=>{
    const o = document.createElement("option")
    o.value=c.name
    o.textContent=c.name
    planCatSelect.appendChild(o)
  })
}

function startLoading(){
  if (!uid) return
  const pRef = ref(db, `users/${uid}/plans`)
  onValue(pRef, snap=>{
    plans = snap.val() || {}
    renderPlans()
    renderPlanSelect()
    renderPlanItems()
  })
}

onAuthStateChanged(auth, user=>{
  if (user) startLoading()
})

planForm?.addEventListener("submit", async e=>{
  e.preventDefault()
  if (!uid) return alert("Nav lietotāja.")
  const name = planNameEl.value.trim()
  if (!name) return
  await push(ref(db, `users/${uid}/plans`), { name, createdAt: Date.now(), items: {} })
  planForm.reset()
})

planItemForm?.addEventListener("submit", async e=>{
  e.preventDefault()
  if (!uid) return
  const pid = planSelect.value
  if (!pid) return alert("Nav izvēlēts plāns.")
  const title = itemTitleEl.value.trim()
  const cat = planCatSelect.value
  const cost = Number(itemCostEl.value||0)
  if (!title || isNaN(cost)) return
  await push(ref(db, `users/${uid}/plans/${pid}/items`), { title, category: cat, cost, createdAt: Date.now() })
  planItemForm.reset()
})

function renderPlans(){
  plansList.innerHTML=""
  Object.entries(plans).forEach(([id,plan])=>{
    const total = Object.values(plan.items||{}).reduce((s,i)=> s+ (Number(i.cost)||0),0)
    const div=document.createElement("div")
    div.className="goal"
    div.innerHTML=`<h4>${plan.name}</h4>
      <div class="muted small">Posteņi: ${Object.keys(plan.items||{}).length} • Kopā: ${formatMoney(total)}</div>
      <button class="btn danger small" data-del-plan="${id}" style="margin-top:8px">Dzēst</button>`
    plansList.appendChild(div)
  })
  plansList.querySelectorAll("[data-del-plan]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-del-plan")
      if (confirm("Dzēst plānu?")) await remove(ref(db, `users/${uid}/plans/${id}`))
    })
  })
}

function renderPlanSelect(){
  const current = planSelect.value
  planSelect.innerHTML=""
  Object.entries(plans).forEach(([id,plan])=>{
    const o = document.createElement("option")
    o.value=id
    o.textContent=plan.name
    planSelect.appendChild(o)
  })
  if (current) planSelect.value=current
}

function renderPlanItems(){
  planItemsList.innerHTML=""
  const pid = planSelect.value
  if (!pid || !plans[pid]) return
  const items = plans[pid].items || {}
  Object.entries(items).forEach(([iid,item])=>{
    const div=document.createElement("div")
    div.className="goal"
    div.innerHTML=`<h4>${item.title}</h4>
      <div class="muted small">${item.category || ""} • ${formatMoney(item.cost)}</div>
      <button class="btn danger small" data-del-item="${iid}" style="margin-top:8px">Dzēst</button>`
    planItemsList.appendChild(div)
  })
  planItemsList.querySelectorAll("[data-del-item]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const iid = btn.getAttribute("data-del-item")
      if (confirm("Dzēst posteni?")) await remove(ref(db, `users/${uid}/plans/${pid}/items/${iid}`))
    })
  })
}

planSelect?.addEventListener("change", renderPlanItems)