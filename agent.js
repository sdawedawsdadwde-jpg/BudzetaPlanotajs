import { auth, db } from "./firebase.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"
import { ref, onValue, push, update, remove, serverTimestamp, get, set } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js"

const SUPPORT_EMAIL = "help@help.com"
const CHAT_ROOT = "support/chat"

const roomsListEl = document.getElementById("roomsList")
const roomSearchEl = document.getElementById("roomSearch")
const refreshRoomsBtn = document.getElementById("refreshRooms")

const reportsListEl = document.getElementById("reportsList")
const usersListEl = document.getElementById("usersList")

const chatStatusEl = document.getElementById("chatStatus")
const messagesEl = document.getElementById("chatMessages")
const chatForm = document.getElementById("chatForm")
const chatInput = document.getElementById("chatInput")

const systemForm = document.getElementById("systemForm")
const systemInput = document.getElementById("systemInput")

const clearRoomBtn = document.getElementById("clearRoom")
const toggleMaintenanceBtn = document.getElementById("toggleMaintenance")
const maintenanceBanner = document.getElementById("maintenanceBanner")
const assignRoomBtn = document.getElementById("assignRoom")
const exportJSONBtn = document.getElementById("exportJSON")
const exportCSVBtn = document.getElementById("exportCSV")
const systemTools = document.getElementById("systemTools")

const currentRoomTitle = document.getElementById("currentRoomTitle")
const roomMeta = document.getElementById("roomMeta")

const broadcastForm = document.getElementById("broadcastForm")
const broadcastMessage = document.getElementById("broadcastMessage")
const broadcastLevel = document.getElementById("broadcastLevel")
const broadcastMinutes = document.getElementById("broadcastMinutes")
const broadcastDismissible = document.getElementById("broadcastDismissible")
const broadcastClear = document.getElementById("broadcastClear")

const reportActions = document.getElementById("reportActions")
const reportMeta = document.getElementById("reportMeta")
const warnUserBtn = document.getElementById("warnUserBtn")
const banUserBtn = document.getElementById("banUserBtn")
const unbanUserBtn = document.getElementById("unbanUserBtn")
const closeReportBtn = document.getElementById("closeReportBtn")
const sendInboxBtn = document.getElementById("sendInboxBtn")

// User editor
const userEditor = document.getElementById("userEditor")
const userMeta = document.getElementById("userMeta")
const ueDisplayName = document.getElementById("ueDisplayName")
const ueWarnings = document.getElementById("ueWarnings")
const ueStrikes = document.getElementById("ueStrikes")
const ueBanMinutes = document.getElementById("ueBanMinutes")
const ueLastReason = document.getElementById("ueLastReason")
const ueBanned = document.getElementById("ueBanned")
const ueSave = document.getElementById("ueSave")
const ueClear = document.getElementById("ueClear")

let currentUser = null
let currentRoomId = null
let rooms = {}
let messagesCache = []
let messagesUnsub = null
let currentReport = null
let reports = {}
let users = {}
let selectedUserId = null

function sanitize(s){ return (s||"").replace(/[<>&]/g, x=>({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[x])) }

function requireSupport(user){
  if (!user || user.email !== SUPPORT_EMAIL){
    location.replace("help.html")
    return false
  }
  return true
}

function watchMaintenance(){
  onValue(ref(db, `${CHAT_ROOT}/maintenance`), snap=>{
    const d = snap.val() || {}
    if (d.enabled){
      maintenanceBanner.style.display="block"
      maintenanceBanner.textContent = d.message || "Apkope."
    } else {
      maintenanceBanner.style.display="none"
      maintenanceBanner.textContent = ""
    }
  })
}

function loadRooms(){
  onValue(ref(db, `${CHAT_ROOT}/rooms`), snap=>{
    const data = snap.val() || {}
    rooms = {}
    Object.entries(data).forEach(([id,obj])=>{
      if (!id.startsWith("user_")) return
      const meta = obj.meta || {}
      rooms[id] = { id, meta }
      rooms[id].meta.updatedAt = meta.updatedAt || meta.createdAt || 0
    })
    renderRooms()
  })
}

function renderRooms(){
  roomsListEl.innerHTML = ""
  const search = (roomSearchEl.value||"").toLowerCase()
  Object.values(rooms)
    .filter(r=> !search || (r.meta?.title||"").toLowerCase().includes(search))
    .sort((a,b)=>(b.meta.updatedAt||0)-(a.meta.updatedAt||0))
    .forEach(r=>{
      const btn = document.createElement("button")
      btn.className = "room-item"
      btn.setAttribute("data-room", r.id)
      const assigned = r.meta?.assignedTo ? ` • ${r.meta.assignedTo}` : ""
      btn.innerHTML = `
        <div class="room-title">${sanitize(r.meta?.title || r.id)}</div>
        <div class="room-sub muted small">ID: ${sanitize(r.id)}${sanitize(assigned)}</div>
      `
      if (r.id === currentRoomId) btn.classList.add("active")
      roomsListEl.appendChild(btn)
    })
}

function switchRoom(roomId){
  currentRoomId = roomId
  currentRoomTitle.textContent = rooms[roomId]?.meta?.title || roomId
  roomMeta.textContent = rooms[roomId]?.meta?.assignedTo ? `Atbild: ${rooms[roomId].meta.assignedTo}` : ""
  chatStatusEl.textContent="Ielādē ziņas..."
  enableRoom(true)
  startMessages(roomId)
}

function enableRoom(on){
  assignRoomBtn.disabled = !on
  clearRoomBtn.disabled = !on
  exportJSONBtn.disabled = !on
  exportCSVBtn.disabled = !on
  chatForm.style.display = on ? "flex" : "none"
  systemTools.style.display = on ? "block" : "none"
}

function startMessages(roomId){
  if (messagesUnsub) messagesUnsub()
  const mRef = ref(db, `${CHAT_ROOT}/rooms/${roomId}/messages`)
  messagesUnsub = onValue(mRef, snap=>{
    const raw = snap.val() || {}
    messagesCache = Object.entries(raw).map(([id,v])=>({ id, ...v }))
      .sort((a,b)=> ( (typeof a.ts==="number"?a.ts:0) - (typeof b.ts==="number"?b.ts:0) ))
    renderMessages(messagesCache)
    chatStatusEl.textContent = messagesCache.length ? "" : "Nav ziņu."
    update(ref(db, `${CHAT_ROOT}/rooms/${roomId}/meta`), { updatedAt: Date.now() })
  })
}

function renderMessages(list){
  messagesEl.innerHTML = ""
  list.forEach(m=>{
    const div = document.createElement("div")
    let cls = ""
    if (m.system) cls = "system"
    else if (m.isSupport) cls = "support"
    div.className = "chat-msg " + cls
    const time = typeof m.ts === "number"
      ? new Date(m.ts).toLocaleTimeString("lv-LV",{hour:"2-digit",minute:"2-digit"})
      : ""
    div.innerHTML = `
      <div class="meta">
        <span class="author">${sanitize(m.system ? "SYSTEM" : (m.email||"Anonīms"))}${m.isSupport && !m.system ? " (Atbalsts)" : ""}</span>
        <span class="time">${time}</span>
      </div>
      <div class="text">${sanitize(m.text)}</div>
      <div class="actions">
        <button class="btn danger small" data-del="${m.id}">Dzēst</button>
      </div>
    `
    messagesEl.appendChild(div)
  })
  messagesEl.scrollTop = messagesEl.scrollHeight
  messagesEl.querySelectorAll("[data-del]").forEach(b=>{
    b.addEventListener("click", async ()=>{
      const id = b.getAttribute("data-del")
      if (!currentRoomId) return
      if (!confirm("Dzēst ziņu?")) return
      try{ await remove(ref(db, `${CHAT_ROOT}/rooms/${currentRoomId}/messages/${id}`)) }
      catch(err){ alert("Neizdevās dzēst: " + err.message) }
    })
  })
}

// Reports handling
function loadReports(){
  onValue(ref(db, `reports`), snap=>{
    const data = snap.val() || {}
    reports = {}
    Object.entries(data).forEach(([id,v])=>{
      reports[id] = { id, ...v }
    })
    renderReports()
  })
}

function renderReports(){
  reportsListEl.innerHTML = ""
  Object.values(reports)
    .sort((a,b)=> (b.createdAt||0)-(a.createdAt||0))
    .forEach(r=>{
      const btn = document.createElement("button")
      btn.className = "room-item"
      btn.setAttribute("data-report", r.id)
      btn.innerHTML = `
        <div class="room-title">${sanitize(r.reason || '(no reason)')}</div>
        <div class="room-sub muted small">${sanitize(r.targetType)} • status: ${sanitize(r.status||'open')} • reported: ${new Date(r.createdAt||0).toLocaleString()}</div>
      `
      reportsListEl.appendChild(btn)
    })
}

// Users
function loadUsers(){
  onValue(ref(db, `users`), snap=>{
    const data = snap.val() || {}
    users = {}
    Object.entries(data).forEach(([id,v])=>{
      users[id] = { id, ...v }
    })
    renderUsers()
  })
}

function renderUsers(){
  usersListEl.innerHTML = ""
  Object.values(users)
    .sort((a,b)=> ( (b.warnings||0) - (a.warnings||0) )) // warnings first
    .forEach(u=>{
      const btn = document.createElement("button")
      btn.className = "room-item"
      btn.setAttribute("data-user", u.id)
      btn.innerHTML = `
        <div class="room-title">${sanitize(u.profile?.displayName || u.id)}</div>
        <div class="room-sub muted small">warns: ${u.warnings||0} • strikes: ${u.strikes||0} • banned: ${u.banned ? 'yes' : 'no'}</div>
      `
      usersListEl.appendChild(btn)
    })
}

// Report actions
reportsListEl?.addEventListener("click", e=>{
  const btn = e.target.closest("[data-report]")
  if (!btn) return
  const id = btn.getAttribute("data-report")
  currentReport = reports[id] || null
  if (!currentReport) return
  reportActions.style.display = "block"
  reportMeta.textContent = `Target: ${currentReport.targetType} ${currentReport.targetId} • reason: ${currentReport.reason} • reporter: ${currentReport.reporterUid || ''}`
})

closeReportBtn?.addEventListener("click", async ()=>{
  if (!currentReport) return
  await remove(ref(db, `reports/${currentReport.id}`))
  alert("Report deleted.")
  reportActions.style.display = "none"
  currentReport = null
})

warnUserBtn?.addEventListener("click", async ()=>{
  if (!currentReport || !currentReport.authorUid) return
  if (!currentUser || currentUser.email !== SUPPORT_EMAIL) { alert("Only support"); return; }
  const uid = currentReport.authorUid
  const snap = await get(ref(db, `users/${uid}/warnings`))
  const warns = (snap.exists() ? snap.val() : 0) + 1
  await update(ref(db), { [`users/${uid}/warnings`]: warns })
  await update(ref(db, `reports/${currentReport.id}`), { status: "actioned", action: "warn", actionAt: Date.now() })
  alert("Warned.")
})

banUserBtn?.addEventListener("click", async ()=>{
  if (!currentReport || !currentReport.authorUid) return
  if (!currentUser || currentUser.email !== SUPPORT_EMAIL) { alert("Only support"); return; }
  const uid = currentReport.authorUid
  const mins = parseInt(prompt("Ban minutes (0 for forever):", "0") || "0", 10)
  const until = mins > 0 ? Date.now() + mins*60*1000 : null
  await update(ref(db), { [`users/${uid}/banned`]: true, [`users/${uid}/bannedUntil`]: until })
  await update(ref(db, `reports/${currentReport.id}`), { status: "actioned", action: "ban", actionAt: Date.now() })
  alert("Banned.")
})

unbanUserBtn?.addEventListener("click", async ()=>{
  if (!currentReport || !currentReport.authorUid) return
  if (!currentUser || currentUser.email !== SUPPORT_EMAIL) { alert("Only support"); return; }
  const uid = currentReport.authorUid
  await update(ref(db), { [`users/${uid}/banned`]: false, [`users/${uid}/bannedUntil`]: null })
  await update(ref(db, `reports/${currentReport.id}`), { status: "actioned", action: "unban", actionAt: Date.now() })
  alert("Unbanned.")
})

sendInboxBtn?.addEventListener("click", async ()=>{
  if (!currentReport || !currentReport.authorUid) return;
  if (!currentUser || currentUser.email !== SUPPORT_EMAIL) { alert("Only support can send inbox messages."); return; }
  const msg = prompt("Message to user (overlay):","Please follow the rules.") || "";
  if (!msg.trim()) return;
  const reason = prompt("Reason (will be shown to user):","Policy violation") || "";
  const dismissAfter = parseInt(prompt("Dismissible after ms (default 5000):","5000")||"5000",10);
  const expiresAt = Date.now() + 24*60*60*1000;
  const mRef = push(ref(db, `userInbox/${currentReport.authorUid}`));
  await set(mRef, {
    text: msg.trim().slice(0,500),
    reason: reason.trim().slice(0,300) || null,
    createdAt: Date.now(),
    dismissibleAfter: isNaN(dismissAfter)?5000:dismissAfter,
    expiresAt
  });
  alert("Overlay message sent.");
})

// User editor helpers
function clearUserEditor(){
  selectedUserId = null
  userEditor.style.display = "none"
  ueDisplayName.value = ""
  ueWarnings.value = ""
  ueStrikes.value = ""
  ueBanMinutes.value = ""
  ueLastReason.value = ""
  ueBanned.checked = false
  userMeta.textContent = ""
}

usersListEl?.addEventListener("click", e=>{
  const btn = e.target.closest("[data-user]")
  if (!btn) return
  const uid = btn.getAttribute("data-user")
  selectedUserId = uid
  const u = users[uid] || {}
  userMeta.textContent = `UID: ${uid}`
  ueDisplayName.value = u.profile?.displayName || ""
  ueWarnings.value = u.warnings || 0
  ueStrikes.value = u.strikes || 0
  ueBanMinutes.value = ""
  ueLastReason.value = u.lastStrikeReason || ""
  ueBanned.checked = !!u.banned
  userEditor.style.display = "block"
})

ueClear?.addEventListener("click", clearUserEditor)

ueSave?.addEventListener("click", async ()=>{
  if (!selectedUserId) return alert("Select a user first.")
  if (!currentUser || currentUser.email !== SUPPORT_EMAIL) { alert("Only support"); return; }

  const uid = selectedUserId
  const updates = {}

  updates[`users/${uid}/warnings`] = Number(ueWarnings.value || 0)
  updates[`users/${uid}/strikes`]  = Number(ueStrikes.value || 0)
  updates[`users/${uid}/banned`]   = !!ueBanned.checked

  const mins = Number(ueBanMinutes.value || 0)
  if (mins > 0) {
    updates[`users/${uid}/bannedUntil`] = Date.now() + mins*60*1000
  } else {
    updates[`users/${uid}/bannedUntil`] = null
  }

  if (ueLastReason.value.trim()) {
    updates[`users/${uid}/lastStrikeReason`] = ueLastReason.value.trim()
  } else {
    updates[`users/${uid}/lastStrikeReason`] = null
  }

  const name = ueDisplayName.value.trim()
  if (name) {
    updates[`users/${uid}/profile/displayName`] = name
  }

  await update(ref(db), updates)
  alert("User updated.")
})

// Chat handlers
chatForm?.addEventListener("submit", async e=>{
  e.preventDefault()
  if (!currentUser || !currentRoomId) return
  const text = chatInput.value.trim()
  if (!text) return
  try{
    await push(ref(db, `${CHAT_ROOT}/rooms/${currentRoomId}/messages`), {
      uid: currentUser.uid,
      email: currentUser.email,
      text,
      isSupport: true,
      system: false,
      ts: serverTimestamp()
    })
    await update(ref(db, `${CHAT_ROOT}/rooms/${currentRoomId}/meta`), {
      updatedAt: Date.now(),
      lastSupportActivity: Date.now()
    })
    chatInput.value=""
    chatInput.focus()
  }catch(err){
    alert("Nosūtīšana neizdevās: " + err.message)
  }
})

systemForm?.addEventListener("submit", async e=>{
  e.preventDefault()
  if (!currentUser || !currentRoomId) return
  const text = systemInput.value.trim()
  if (!text) return
  try{
    await push(ref(db, `${CHAT_ROOT}/rooms/${currentRoomId}/messages`), {
      uid: currentUser.uid,
      email: currentUser.email,
      text,
      isSupport: true,
      system: true,
      ts: serverTimestamp()
    })
    await update(ref(db, `${CHAT_ROOT}/rooms/${currentRoomId}/meta`), {
      updatedAt: Date.now(),
      lastSupportActivity: Date.now()
    })
    systemInput.value=""
    systemInput.focus()
  }catch(err){
    alert("Sistēmas ziņa neizdevās: " + err.message)
  }
})

clearRoomBtn?.addEventListener("click", async ()=>{
  if (!currentRoomId) return
  if (!confirm("Dzēst VISAS ziņas šajā čatā?")) return
  try{
    const msgSnap = await get(ref(db, `${CHAT_ROOT}/rooms/${currentRoomId}/messages`))
    const data = msgSnap.val() || {}
    const ids = Object.keys(data)
    if (!ids.length){ alert("Nav ko dzēst."); return }
    await Promise.all(ids.map(id=> remove(ref(db, `${CHAT_ROOT}/rooms/${currentRoomId}/messages/${id}`)) ))
    alert("Ziņas dzēstas.")
  }catch(err){
    alert("Neizdevās dzēst: " + err.message)
  }
})

toggleMaintenanceBtn?.addEventListener("click", async ()=>{
  try{
    const snap = await get(ref(db, `${CHAT_ROOT}/maintenance`))
    const cur = snap.val() || {}
    const next = !cur.enabled
    let msg = cur.message || ""
    if (next){
      msg = prompt("Maintenance paziņojums:", msg || "Apkope. Lūdzu, mēģini vēlāk.") || "Apkope. Lūdzu, mēģini vēlāk."
    }
    await update(ref(db, `${CHAT_ROOT}/maintenance`), { enabled: next, message: msg })
    alert(next ? "Ieslēgts" : "Izslēgts")
  }catch(err){
    alert("Neizdevās pārslēgt: " + err.message)
  }
})

assignRoomBtn?.addEventListener("click", async ()=>{
  if (!currentRoomId || !currentUser) return
  try{
    await update(ref(db, `${CHAT_ROOT}/rooms/${currentRoomId}/meta`), {
      assignedTo: currentUser.email,
      updatedAt: Date.now()
    })
    renderRooms()
  }catch(err){
    alert("Neizdevās piešķirt: " + err.message)
  }
})

exportJSONBtn?.addEventListener("click", ()=>{
  if (!messagesCache.length) return alert("Nav ziņu.")
  const blob = new Blob([JSON.stringify(messagesCache,null,2)],{type:"application/json"})
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `chat_${currentRoomId}.json`
  a.click()
  URL.revokeObjectURL(a.href)
})

exportCSVBtn?.addEventListener("click", ()=>{
  if (!messagesCache.length) return alert("Nav ziņu.")
  const header = ["id","email","isSupport","system","text","ts"].join(",")
  const rows = messagesCache.map(m=>[
    m.id, m.email||"", m.isSupport?"1":"0", m.system?"1":"0",
    (m.text||"").replace(/"/g,'""'), m.ts||""
  ].map(v=>`"${v}"`).join(","))
  const csv = [header, ...rows].join("\n")
  const blob = new Blob([csv],{type:"text/csv;charset=utf-8"})
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `chat_${currentRoomId}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
})

roomsListEl?.addEventListener("click", e=>{
  const btn = e.target.closest("[data-room]")
  if (!btn) return
  switchRoom(btn.getAttribute("data-room"))
})
refreshRoomsBtn?.addEventListener("click", renderRooms)
roomSearchEl?.addEventListener("input", renderRooms)

onAuthStateChanged(auth, user=>{
  if (!requireSupport(user)) return
  currentUser = user
  watchMaintenance()
  loadRooms()
  loadReports()
  loadUsers()
})

// Global broadcast
broadcastForm?.addEventListener("submit", async e=>{
  e.preventDefault()
  const msg = (broadcastMessage.value||"").trim()
  if (!msg) return
  const level = broadcastLevel.value
  const minutes = parseInt(broadcastMinutes.value,10)
  const dismissible = broadcastDismissible.checked
  const now = Date.now()
  const expiresAt = (!isNaN(minutes) && minutes > 0) ? now + minutes*60*1000 : null
  const id = "sys_" + now
  try{
    await update(ref(db, `${CHAT_ROOT}/systemBroadcast`), {
      active: true,
      message: msg,
      level,
      id,
      createdAt: now,
      expiresAt: expiresAt,
      dismissible
    })
    broadcastMessage.value=""
    alert("Globālais paziņojums publicēts.")
  }catch(err){
    alert("Neizdevās publicēt: " + err.message)
  }
})

broadcastClear?.addEventListener("click", async ()=>{
  if (!confirm("Atslēgt aktīvo globālo paziņojumu?")) return
  try{
    await update(ref(db, `${CHAT_ROOT}/systemBroadcast`), { active: false })
    alert("Globālais paziņojums atslēgts.")
  }catch(err){
    alert("Neizdevās atslēgt: " + err.message)
  }
})