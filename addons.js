import { db, auth } from "./firebase.js";
import { ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { settings, formatMoney } from "./common.js";

const watchList = document.getElementById("watchList");
const watchForm = document.getElementById("watchForm");
const watchNameEl = document.getElementById("watchName");
const watchTargetEl = document.getElementById("watchTarget");
const watchNoteEl = document.getElementById("watchNote");
const watchCurrentEl = document.getElementById("watchCurrent");
const openSubsBtn = document.getElementById("openSubsBtn");

let currentUid = null;

function initSubsButtonOnly() {
  if (!openSubsBtn) return;
  onAuthStateChanged(auth, user => {
    const plan = settings?.subscription?.plan || "free";
    openSubsBtn.style.display = user && plan === "free" ? "inline-flex" : "none";
    openSubsBtn.onclick = () => location.href = "subscriptions.html";
  });
}

function initWatchlist() {
  onAuthStateChanged(auth, user => {
    currentUid = user ? user.uid : null;
    if (currentUid) {
      watchWatchlist();
      syncPlanUI(settings?.subscription);
    }
  });

  watchForm?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUid) return;
    const payload = {
      name: watchNameEl.value.trim(),
      target: watchTargetEl.value ? Number(watchTargetEl.value) : null,
      current: watchCurrentEl.value ? Number(watchCurrentEl.value) : null,
      note: watchNoteEl.value.trim(),
      createdAt: Date.now()
    };
    if (!payload.name) return;
    await push(ref(db, `users/${currentUid}/watchlist`), payload);
    watchForm.reset();
  });
}

function syncPlanUI(sub) {
  const plan = sub?.plan || "free";
  if (openSubsBtn) {
    openSubsBtn.style.display = plan === "free" ? "inline-flex" : "none";
    openSubsBtn.onclick = () => location.href = "subscriptions.html";
  }
}

function watchWatchlist() {
  onValue(ref(db, `users/${currentUid}/watchlist`), snap => {
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
    renderWatchlist(list);
  });
}

function renderWatchlist(list) {
  if (!watchList) return;
  watchList.innerHTML = "";
  if (!list.length) {
    watchList.innerHTML = '<div class="muted small">Nav preču saraksta.</div>';
    return;
  }
  list.forEach(item => {
    const diff = item.target ? (item.current || 0) - item.target : null;
    const status = diff !== null
      ? (diff <= 0 ? `<span class="badge success">Vēlamā cena sasniegta</span>` : `<span class="badge warn">Jākrīt par ${formatMoney(diff)}</span>`)
      : `<span class="badge">Bez mērķa</span>`;
    const div = document.createElement("div");
    div.className = "watch-card";
    div.innerHTML = `
      <div class="goal-head">
        <strong>${item.name}</strong>
        ${status}
      </div>
      <div class="muted small">Pašreiz: ${item.current ? formatMoney(item.current) : "—"}</div>
      <div class="muted small">Vēlamā: ${item.target ? formatMoney(item.target) : "—"}</div>
      ${item.note ? `<div class="muted small">${item.note}</div>` : ""}
      <div class="row" style="margin-top:8px; gap:8px; flex-wrap:wrap;">
        <button class="btn outline small" data-edit="${item.id}">Labot</button>
        <button class="btn danger small" data-del="${item.id}">Dzēst</button>
      </div>
    `;
    watchList.appendChild(div);
  });
  watchList.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      await remove(ref(db, `users/${currentUid}/watchlist/${id}`));
    });
  });
  watchList.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const snap = await (await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js")).get(ref(db, `users/${currentUid}/watchlist/${id}`));
      const cur = snap.val();
      if (!cur) return;
      const name = prompt("Prece", cur.name) || cur.name;
      const current = Number(prompt("Pašreizējā cena", cur.current ?? "") || cur.current || 0);
      const target = Number(prompt("Vēlamā cena", cur.target ?? "") || cur.target || 0);
      const note = prompt("Piezīme", cur.note || "") || cur.note || "";
      await update(ref(db, `users/${currentUid}/watchlist/${id}`), { name, current, target, note });
    });
  });
}

// Decide which initialization to run
if (!watchList || !watchForm) {
  initSubsButtonOnly();
} else {
  initWatchlist();
}