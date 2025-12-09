import { db, auth } from "./firebase.js"
import { uid, formatMoney } from "./common.js"
import { ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"

const form = document.getElementById("noteForm")
const titleEl = document.getElementById("noteTitle")
const bodyEl = document.getElementById("noteBody")
const listEl = document.getElementById("notesList")

// Bills
const billForm = document.getElementById("billForm")
const billNameEl = document.getElementById("billName")
const billAmountEl = document.getElementById("billAmount")
const billDueEl = document.getElementById("billDue")
const billsList = document.getElementById("billsList")

let notes = {}

function startNotes(){
  if (!uid) return
  onValue(ref(db, `users/${uid}/notes`), snap=>{
    notes = snap.val() || {}
    renderNotes()
  })
  watchBills()
}

onAuthStateChanged(auth, user=>{
  if (user) startNotes()
})

form?.addEventListener("submit", async e=>{
  e.preventDefault()
  if (!uid) return alert("Nav lietotāja.")
  const title = titleEl.value.trim()
  const body = bodyEl.value.trim()
  if (!title || !body) return
  await push(ref(db, `users/${uid}/notes`), { title, body, createdAt: Date.now(), updatedAt: Date.now() })
  form.reset()
})

function renderNotes(){
  listEl.innerHTML=""
  Object.entries(notes).forEach(([id,n])=>{
    const div=document.createElement("div")
    div.className="goal"
    div.innerHTML=`<h4>${n.title}</h4>
      <div class="muted small" style="white-space:pre-wrap">${n.body}</div>
      <div class="row" style="margin-top:8px;">
        <button class="btn outline small" data-edit="${id}">Labot</button>
        <button class="btn danger small" data-del="${id}">Dzēst</button>
      </div>`
    listEl.appendChild(div)
  })
  listEl.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-del")
      if (confirm("Dzēst piezīmi?")) await remove(ref(db, `users/${uid}/notes/${id}`))
    })
  })
  listEl.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-edit")
      const note = notes[id]
      if (!note) return
      const newTitle = prompt("Jauns nosaukums:", note.title) || note.title
      const newBody = prompt("Jauns teksts:", note.body) || note.body
      update(ref(db, `users/${uid}/notes/${id}`), { title: newTitle, body: newBody, updatedAt: Date.now() })
    })
  })
}

/* Bills */
function watchBills() {
  if (!uid) return
  onValue(ref(db, `users/${uid}/bills`), snap => {
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
    renderBills(list);
  });
}

billForm?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!uid) return;
  const payload = {
    name: billNameEl.value.trim(),
    amount: Number(billAmountEl.value || 0),
    due: billDueEl.value,
    createdAt: Date.now()
  };
  if (!payload.name || !payload.due) return;
  await push(ref(db, `users/${uid}/bills`), payload);
  billForm.reset();
});

function renderBills(list) {
  billsList.innerHTML = "";
  if (!list.length) {
    billsList.innerHTML = '<div class="muted small">Nav rēķinu.</div>';
    return;
  }
  const today = Date.now();
  list.sort((a, b) => (new Date(a.due) - new Date(b.due)));
  list.forEach(b => {
    const dueTs = new Date(b.due).getTime();
    const days = Math.floor((dueTs - today) / (1000 * 60 * 60 * 24));
    let badge = `<span class="badge">${b.due}</span>`;
    if (days < 0) badge = `<span class="badge danger">Nokavēts ${Math.abs(days)}d</span>`;
    else if (days <= 7) badge = `<span class="badge warn">Drīz (${days}d)</span>`;
    const div = document.createElement("div");
    div.className = "bill-card";
    div.innerHTML = `
      <div class="goal-head">
        <strong>${b.name}</strong>
        ${badge}
      </div>
      <div class="muted small">${formatMoney(b.amount || 0)}</div>
      <div class="row" style="margin-top:8px; gap:8px; flex-wrap:wrap;">
        <button class="btn outline small" data-edit="${b.id}">Labot</button>
        <button class="btn danger small" data-del="${b.id}">Dzēst</button>
      </div>
    `;
    billsList.appendChild(div);
  });
  billsList.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      await remove(ref(db, `users/${uid}/bills/${id}`));
    });
  });
  billsList.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const snap = await (await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js")).get(ref(db, `users/${uid}/bills/${id}`));
      const cur = snap.val();
      if (!cur) return;
      const name = prompt("Nosaukums", cur.name) || cur.name;
      const amount = Number(prompt("Summa", cur.amount ?? "") || cur.amount || 0);
      const due = prompt("Termiņš (YYYY-MM-DD)", cur.due) || cur.due;
      await update(ref(db, `users/${uid}/bills/${id}`), { name, amount, due });
    });
  });
}