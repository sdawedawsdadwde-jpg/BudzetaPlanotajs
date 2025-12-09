// settings.js
// Handles UI for settings page: themes, accent color, currency/language/advanced charts,
// categories/planner categories, performance mode toggle, auto-purge controls,
// subscription status control, notifications toggle.
//
// IMPORTANT: avoid calling saveSettings while responding to onSettings to prevent recursion.

import {
  onSettings,
  saveSettings,
  addCategory,
  deleteCategory,
  addPlannerCategory,
  deletePlannerCategory,
  applyTheme,
  applyAccent,
  onTransactions,
  purgeTransactions,
  settings as appSettings
} from "./common.js"

const themeButtons = document.querySelectorAll(".theme-btn")
const accentColorEl = document.getElementById("accentColor")
const form = document.getElementById("settingsForm")
const currencyEl = document.getElementById("currency")
const languageEl = document.getElementById("language")
const advChartsEl = document.getElementById("advCharts")

const catForm = document.getElementById("categoryForm")
const catNameEl = document.getElementById("catName")
const catColorEl = document.getElementById("catColor")
const catListEl = document.getElementById("catList")

const plannerCatForm = document.getElementById("plannerCatForm")
const plannerCatNameEl = document.getElementById("plannerCatName")
const plannerCatColorEl = document.getElementById("plannerCatColor")
const plannerCatListEl = document.getElementById("plannerCatList")

// Performance toggle elements
const lowGraphicsToggle = document.getElementById("lowGraphicsToggle")
const perfToggleWrap = document.getElementById("perfToggleWrap")
const lowGraphicsTitle = document.getElementById("lowGraphicsTitle")
let lowGraphicsEnabled = false

// Auto-purge UI elements
const autoPurgeEnable = document.getElementById("autoPurgeEnable")
const autoPurgeType = document.getElementById("autoPurgeType")
const autoPurgeNowBtn = document.getElementById("autoPurgeNow")
const autoPurgeLastEl = document.getElementById("autoPurgeLast")

// Subscription UI
const settingsPlanSelect = document.getElementById("settingsPlanSelect")
const settingsPlanStatus = document.getElementById("settingsPlanStatus")

// Notifications UI
const notifToggle = document.getElementById("notifToggle")
const notifStatus = document.getElementById("notifStatus")
const notifTest = document.getElementById("notifTest")

// Local state for plan + notifications
let currentPlan = "free"
let currentNotifEnabled = true

// Prepare currency options
const currencyOptions = ["€","$","£","kr","SEK","DKK","PLN","CZK","CAD","AUD","CHF","JPY","CNY","RUB","HUF","RON","TRY"]
if (currencyEl) {
  currencyEl.innerHTML = ""
  currencyOptions.forEach(c=>{
    const o = document.createElement("option")
    o.value = c
    o.textContent = c
    currencyEl.appendChild(o)
  })
}

// Perf toggle UI helper
function updatePerfToggleUI() {
  if (perfToggleWrap) {
    if (lowGraphicsEnabled) perfToggleWrap.classList.add('on')
    else perfToggleWrap.classList.remove('on')
  }
  if (lowGraphicsToggle) {
    lowGraphicsToggle.setAttribute('aria-checked', lowGraphicsEnabled ? 'true' : 'false')
  }
  if (lowGraphicsTitle) {
    lowGraphicsTitle.innerHTML = lowGraphicsEnabled ? "<strong>Zema grafika — ieslēgta</strong>" : "<strong>Zema grafika</strong>"
  }
}

let allTx = []
onTransactions(arr=> allTx = arr.slice())

function download(filename, text){
  const blob = new Blob([text], { type:"text/plain;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

document.getElementById("exportCSV")?.addEventListener("click", ()=>{
  if (!allTx.length) return alert("Nav datu.")
  const header = ["id","type","category","amount","date","notes"].join(",")
  const rows = allTx.map(t=> [
    t.id, t.type, t.category, t.amount, t.date, (t.notes||"").replace(/"/g,'""')
  ].map(v=> `"${v}"`).join(","))
  const csv = [header, ...rows].join("\n")
  download("transactions.csv", csv)
})

document.getElementById("exportJSON")?.addEventListener("click", ()=>{
  if (!allTx.length) return alert("Nav datu.")
  download("transactions.json", JSON.stringify(allTx,null,2))
})

async function applyLowGraphicsSetting(enabled, { persist = true } = {}) {
  lowGraphicsEnabled = !!enabled
  updatePerfToggleUI()

  if (window.graphGuard && typeof window.graphGuard.enable === 'function') {
    if (lowGraphicsEnabled) window.graphGuard.enable()
    else window.graphGuard.disable()

    if (persist) {
      try {
        const common = await import('./common.js')
        if (common && typeof common.saveSettings === 'function') {
          setTimeout(() => {
            try { common.saveSettings({ lowGraphics: lowGraphicsEnabled }) } catch (e) {}
          }, 0)
        }
      } catch (e) {}
    }
    return
  }

  if (persist) {
    try { await saveSettings({ lowGraphics: lowGraphicsEnabled }) } catch (e) { console.warn("saveSettings failed for lowGraphics:", e) }
  }

  if (lowGraphicsEnabled) document.documentElement.classList.add('low-graphics')
  else document.documentElement.classList.remove('low-graphics')
}

// Helper to update notification UI text consistently
function updateNotifUI(plan, enabled) {
  if (!notifToggle || !notifStatus) return
  if (plan === "free") {
    notifToggle.value = "on"
    notifStatus.textContent = "Free — paziņojumi vienmēr ieslēgti"
    return
  }
  notifToggle.value = enabled ? "on" : "off"
  notifStatus.textContent = enabled ? "Ieslēgts" : "Izslēgts"
}

// Populate from settings
onSettings(s=>{
  if (!s) return
  try {
    if (currencyEl && typeof s.currency !== 'undefined') currencyEl.value = s.currency
    if (languageEl && typeof s.language !== 'undefined') languageEl.value = s.language
    if (advChartsEl && typeof s.advancedCharts !== 'undefined') advChartsEl.value = s.advancedCharts ? "true" : "false"
    if (accentColorEl) accentColorEl.value = s.accentColor || "#00e5ff"
    if (s.categories) renderCats(s.categories)
    if (s.plannerCategories) renderPlannerCats(s.plannerCategories)
  } catch (e) { console.warn("Failed to apply incoming settings:", e) }

  // subscription
  if (settingsPlanSelect) {
    const sub = s.subscription || { plan: "free" }
    currentPlan = (sub.plan || "free").toLowerCase()
    settingsPlanSelect.value = sub.plan || "free"
  }
  if (settingsPlanStatus) {
    const sub = s.subscription
    if (!sub || (sub.plan || "free").toLowerCase() === "free") settingsPlanStatus.textContent = "Free — reklāmas ieslēgtas"
    else {
      const expiry = sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : ""
      settingsPlanStatus.textContent = `${sub.plan} ${expiry ? "• derīgs līdz "+expiry : ""} — reklāmas izslēgtas`
    }
  }

  // notifications
  if (notifToggle) {
    const n = s.notifications || { enabled:true }
    currentNotifEnabled = !!n.enabled
    if (currentPlan === "free") currentNotifEnabled = true
    updateNotifUI(currentPlan, currentNotifEnabled)
  }

  // low graphics
  if (typeof s.lowGraphics !== 'undefined') {
    applyLowGraphicsSetting(!!s.lowGraphics, { persist: false })
  } else if (window.graphGuard && typeof window.graphGuard.isEnabled === 'function') {
    lowGraphicsEnabled = !!window.graphGuard.isEnabled()
    updatePerfToggleUI()
  }

  // Auto-purge UI
  try {
    const ap = s.autoPurge || { enabled:false, type:"both", interval:"monthly", lastRun:0 }
    if (autoPurgeEnable) autoPurgeEnable.checked = !!ap.enabled
    if (autoPurgeType) autoPurgeType.value = ap.type || "both"
    if (autoPurgeLastEl) autoPurgeLastEl.textContent = ap.lastRun ? new Date(Number(ap.lastRun)).toLocaleString() : "—"
  } catch (e) { console.warn("Failed to populate autoPurge UI", e) }
})

// Theme buttons
themeButtons.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const theme = btn.dataset.theme
    applyTheme(theme)
    saveSettings({ theme }).catch(()=>{})
  })
})

// Accent color
accentColorEl?.addEventListener("input", ()=>{
  applyAccent(accentColorEl.value)
  saveSettings({ accentColor: accentColorEl.value }).catch(()=>{})
})

// Save base settings
form?.addEventListener("submit", e=>{
  e.preventDefault()
  saveSettings({
    currency: currencyEl ? currencyEl.value : undefined,
    language: languageEl ? languageEl.value : undefined,
    advancedCharts: advChartsEl ? (advChartsEl.value === "true") : undefined
  }).then(()=>{ alert("Iestatījumi saglabāti!") })
    .catch((err)=>{ console.error("Failed to save settings:", err); alert("Neizdevās saglabāt iestatījumus.") })
})

// Categories
catForm?.addEventListener("submit", e=>{
  e.preventDefault()
  const name = catNameEl.value.trim()
  if (!name) return
  addCategory(name, catColorEl.value)
  catForm.reset()
})

// Planner categories
plannerCatForm?.addEventListener("submit", e=>{
  e.preventDefault()
  const name = plannerCatNameEl.value.trim()
  if (!name) return
  addPlannerCategory(name, plannerCatColorEl.value)
  plannerCatForm.reset()
})

// Performance toggle
if (lowGraphicsToggle) {
  lowGraphicsToggle.addEventListener("click", async (ev) => {
    ev.preventDefault()
    await applyLowGraphicsSetting(!lowGraphicsEnabled, { persist: true })
  })
  lowGraphicsToggle.addEventListener("keydown", async (ev)=>{
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault()
      await applyLowGraphicsSetting(!lowGraphicsEnabled, { persist: true })
    }
  })
}

// Auto-purge wiring
if (autoPurgeEnable) {
  autoPurgeEnable.addEventListener("change", ()=>{
    const enabled = !!autoPurgeEnable.checked
    const type = autoPurgeType ? autoPurgeType.value : "both"
    const autoPurgeObj = { enabled, type, interval: "monthly", lastRun: appSettings.autoPurge?.lastRun || 0 }
    saveSettings({ autoPurge: autoPurgeObj })
  })
}
if (autoPurgeType) {
  autoPurgeType.addEventListener("change", ()=>{
    const enabled = !!(autoPurgeEnable && autoPurgeEnable.checked)
    const type = autoPurgeType.value
    const autoPurgeObj = { enabled, type, interval: "monthly", lastRun: appSettings.autoPurge?.lastRun || 0 }
    saveSettings({ autoPurge: autoPurgeObj })
  })
}
if (autoPurgeNowBtn) {
  autoPurgeNowBtn.addEventListener("click", async ()=>{
    try {
      const type = autoPurgeType ? autoPurgeType.value : "both"
      if (!confirm(`Dzēst tagad: ${type === "both" ? "Ienākumi un Izdevumi" : (type === "income" ? "Ienākumi" : "Izdevumi")}?`)) return
      const res = await purgeTransactions({ type })
      const newAuto = { ...(appSettings.autoPurge || {}), lastRun: Date.now(), enabled: !!(autoPurgeEnable && autoPurgeEnable.checked), type, interval: "monthly" }
      await saveSettings({ autoPurge: newAuto })
      if (autoPurgeLastEl) autoPurgeLastEl.textContent = new Date(newAuto.lastRun).toLocaleString()
      alert(`Pabeigts. Dzēsti: ${res.deleted} ieraksti.`)
    } catch (e) {
      console.error("Auto purge now failed:", e)
      alert("Neizdevās dzēst ierakstus.")
    }
  })
}

// Subscription select save
settingsPlanSelect?.addEventListener("change", async ()=>{
  const plan = settingsPlanSelect.value || "free"
  currentPlan = plan.toLowerCase()
  const expires = plan === "free" ? null : (Date.now() + 30*24*60*60*1000)
  await saveSettings({ subscription: { plan, startedAt: Date.now(), expiresAt: expires } })

  // If downgraded to free, force notifications on
  if (currentPlan === "free") {
    currentNotifEnabled = true
    updateNotifUI(currentPlan, currentNotifEnabled)
    await saveSettings({ notifications: { enabled: true } })
  }
})

// Notifications toggle
notifToggle?.addEventListener("change", async ()=> {
  const desired = notifToggle.value === "on"
  const canDisable = currentPlan === "pro" || currentPlan === "standard"

  if (!canDisable && !desired) {
    // Free users cannot turn off notifications
    currentNotifEnabled = true
    updateNotifUI("free", true)
    alert("Paziņojumus var izslēgt tikai Standard vai Pro lietotāji.")
    return
  }

  if (desired && Notification && Notification.permission !== "granted") {
    const perm = await Notification.requestPermission()
    if (perm !== "granted") {
      currentNotifEnabled = false
      notifToggle.value = "off"
      notifStatus.textContent = "Atteikts"
      await saveSettings({ notifications: { enabled: false } })
      return
    }
  }

  currentNotifEnabled = desired
  updateNotifUI(currentPlan, currentNotifEnabled)
  await saveSettings({ notifications: { enabled: desired } })
})

// Notification test
notifTest?.addEventListener("click", ()=>{
  if (!("Notification" in window)) return alert("Pārlūks neatbalsta paziņojumus.")
  if (Notification.permission !== "granted") {
    Notification.requestPermission().then(p=>{
      if (p === "granted") new Notification("Test paziņojums", { body: "Tas strādā!" })
    })
  } else {
    new Notification("Test paziņojums", { body: "Tas strādā!" })
  }
})

// Sync from graph-guard events
document.addEventListener('graph-guard:changed', (e) => {
  try { const enabled = !!(e && e.detail && e.detail.enabled); lowGraphicsEnabled = enabled; updatePerfToggleUI() } catch (err) {}
})

// Render helpers
function renderCats(cats = {}) {
  if (!catListEl) return
  catListEl.innerHTML = ""
  Object.entries(cats).forEach(([id,obj])=>{
    const div = document.createElement("div")
    div.className="cat-item"
    div.innerHTML = `
      <div class="left">
        <div class="swatch" style="background:${obj.color}"></div>
        <strong style="margin-left:10px">${obj.name}</strong>
      </div>
      <button class="btn danger small" data-del="${id}">Dzēst</button>
    `
    const left = div.querySelector(".left")
    if (left) { left.style.display="flex"; left.style.alignItems="center" }
    catListEl.appendChild(div)
  })
  catListEl.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-del")
      if (confirm("Dzēst kategoriju?")) deleteCategory(id)
    })
  })
}

function renderPlannerCats(cats = {}) {
  if (!plannerCatListEl) return
  plannerCatListEl.innerHTML = ""
  Object.entries(cats).forEach(([id,obj])=>{
    const div = document.createElement("div")
    div.className="cat-item"
    div.innerHTML = `
      <div class="left">
        <div class="swatch" style="background:${obj.color}"></div>
        <strong style="margin-left:10px">${obj.name}</strong>
      </div>
      <button class="btn danger small" data-del="${id}">Dzēst</button>
    `
    const left = div.querySelector(".left")
    if (left) { left.style.display="flex"; left.style.alignItems="center" }
    plannerCatListEl.appendChild(div)
  })
  plannerCatListEl.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-del")
      if (confirm("Dzēst plāna kategoriju?")) deletePlannerCategory(id)
    })
  })
}

// Initial sync from graphGuard if exists
if (window.graphGuard && typeof window.graphGuard.isEnabled === 'function') {
  try { lowGraphicsEnabled = !!window.graphGuard.isEnabled(); updatePerfToggleUI() } catch (e) {}
}