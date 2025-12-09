import { uid, onBudgets, onTransactions, formatMoney, getCategoryList, hydrateDynamicSelects, onSettings } from "./common.js"
import { db } from "./firebase.js"
import { ref, push, remove, onValue } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js"

const form = document.getElementById("budgetForm")
const listEl = document.getElementById("budgetList")
const bCategory = document.getElementById("bCategory")
const bLimit = document.getElementById("bLimit")
const bNotes = document.getElementById("bNotes")

// goals (savings/debt)
const goalForm = document.getElementById("goalForm")
const goalTypeEl = document.getElementById("goalType")
const goalNameEl = document.getElementById("goalName")
const goalTargetEl = document.getElementById("goalTarget")
const goalCurrentEl = document.getElementById("goalCurrent")
const goalsList = document.getElementById("goalsList")

let budgets = []
let transactions = []
let goals = []

function populateBudgetCategories(){
  if (!bCategory) return
  bCategory.innerHTML = ""
  getCategoryList().forEach(c=>{
    const o = document.createElement("option")
    o.value = c.name
    o.textContent = c.name
    bCategory.appendChild(o)
  })
}

onBudgets(arr=>{ budgets = arr; renderBudgets() })
onTransactions(arr=>{ transactions = arr; renderBudgets() })
onSettings(()=> { populateBudgetCategories(); hydrateDynamicSelects(); })

setTimeout(()=>{
  populateBudgetCategories()
  hydrateDynamicSelects()
}, 400)

// budget limits
form?.addEventListener("submit", async e=>{
  e.preventDefault()
  if (!uid) return alert("Nav lietotāja.")
  const payload = {
    category: bCategory.value,
    limit: Number(bLimit.value||0),
    notes: bNotes.value.trim(),
    createdAt: Date.now()
  }
  if (!payload.limit || payload.limit <=0) return alert("Nederīgs limits.")
  await push(ref(db, `users/${uid}/budgets`), payload)
  form.reset()
})

function renderBudgets(){
  if (!listEl) return
  listEl.innerHTML=""
  for (const b of budgets){
    const spent = transactions.filter(t=> t.type==="expense" && t.category===b.category).reduce((s,t)=>s+t.amount,0)
    const pct = Math.min(100, (spent / b.limit)*100)
    const div = document.createElement("div")
    div.className="goal"
    div.innerHTML = `
      <h4>${b.category}</h4>
      <div class="muted small">${b.notes||""}</div>
      <div class="muted small">Limits: ${formatMoney(b.limit)} • Izlietots: ${formatMoney(spent)}</div>
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
      <div class="muted small">${pct.toFixed(1)}%</div>
      <button class="btn danger small" data-del="${b.id}" style="margin-top:10px">Dzēst</button>
    `
    listEl.appendChild(div)
  }
  listEl.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-del")
      if (confirm("Dzēst mērķi?")){
        await remove(ref(db, `users/${uid}/budgets/${id}`))
      }
    })
  })
}

// savings/debt goals
function watchGoals() {
  if (!uid) return;
  onValue(ref(db, `users/${uid}/goals`), snap => {
    const data = snap.val() || {};
    goals = Object.entries(data).map(([id,v])=>({id,...v}));
    renderGoals();
  });
}
goalForm?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!uid) return alert("Nav lietotāja.");
  const payload = {
    type: goalTypeEl.value,
    name: goalNameEl.value.trim(),
    target: Number(goalTargetEl.value || 0),
    current: Number(goalCurrentEl.value || 0),
    createdAt: Date.now()
  };
  if (!payload.name || !payload.target) return alert("Nederīgs mērķis.");
  await push(ref(db, `users/${uid}/goals`), payload);
  goalForm.reset();
});
function renderGoals(){
  if (!goalsList) return;
  goalsList.innerHTML = "";
  if (!goals.length){
    goalsList.innerHTML = '<div class="muted small">Nav mērķu.</div>';
    return;
  }
  goals.forEach(g=>{
    const pct = Math.min(100, Math.round((g.current||0)/(g.target||1)*100));
    const div = document.createElement("div");
    div.className = "goal";
    div.innerHTML = `
      <div class="goal-head">
        <strong>${g.name}</strong>
        <span class="pill">${g.type==="debt"?"Parāds":"Ietaupījums"}</span>
      </div>
      <div class="muted small">Progress: ${formatMoney(g.current||0)} / ${formatMoney(g.target||0)}</div>
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
      <div class="row" style="margin-top:8px; gap:8px; flex-wrap:wrap;">
        <span class="badge ${pct>=100?"success":""}">${pct}%</span>
        <button class="btn danger small" data-del="${g.id}">Dzēst</button>
      </div>
     
    `;
    goalsList.appendChild(div);
  });
  goalsList.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-del");
      await remove(ref(db, `users/${uid}/goals/${id}`));
    });
  });
}

// init goals watcher when auth ready (uid available)
if (uid) {
  watchGoals();
} else {
  // small defer to wait for auth initialization in common.js
  setTimeout(()=> watchGoals(), 600);
}