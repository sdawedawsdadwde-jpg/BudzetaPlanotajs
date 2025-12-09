import { auth, db } from "./firebase.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"
import { ref, push, onValue, serverTimestamp, update, get } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js"

// IMPORTANT: Keep the value that is already working in your app.
// If your working setup uses 'support/chat/global', set it to that.
// const CHAT_ROOT = "support/chat/global"
const CHAT_ROOT = "support/chat"

const messagesEl = document.getElementById("chatMessages")
const form = document.getElementById("chatForm")
const input = document.getElementById("chatInput")
const statusEl = document.getElementById("chatStatus")
const loginPrompt = document.getElementById("loginPrompt")
const maintenanceBanner = document.getElementById("helpMaintenanceBanner")

let currentUser = null
let roomId = null
let unsub = null
let cacheRestored = false

// Local cache config
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

function sanitize(str){
  return (str||"").replace(/[<>&]/g, c => ({ "<":"&lt;", "&":"&amp;", ">":"&gt;" }[c]))
}

// Cache helpers
function keyMsgs(){ return `chat_cache_msgs_${roomId}` }
function keyDraft(){ return `chat_cache_draft_${roomId}` }
function keyScroll(){ return `chat_cache_scroll_${roomId}` }

function saveMsgsCache(list){
  try{
    const payload = { ts: Date.now(), data: list }
    localStorage.setItem(keyMsgs(), JSON.stringify(payload))
  }catch{}
}

function loadMsgsCache(){
  try{
    const raw = localStorage.getItem(keyMsgs())
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.ts !== "number" || !Array.isArray(parsed.data)) return null
    if (Date.now() - parsed.ts > CACHE_TTL) return null
    return parsed.data
  }catch{
    return null
  }
}

function saveDraftCache(val){
  try{ localStorage.setItem(keyDraft(), val||"") }catch{}
}
function loadDraftCache(){
  try{ return localStorage.getItem(keyDraft()) || "" }catch{ return "" }
}

function saveScroll(){
  try{ localStorage.setItem(keyScroll(), String(messagesEl.scrollTop||0)) }catch{}
}
function loadScroll(){
  try{
    const v = localStorage.getItem(keyScroll())
    return v ? parseInt(v,10) || 0 : 0
  }catch{ return 0 }
}
function clearScroll(){
  try{ localStorage.removeItem(keyScroll()) }catch{}
}

// Maintenance banner
function watchMaintenance(){
  onValue(ref(db, `${CHAT_ROOT}/maintenance`), snap=>{
    const d = snap.val() || {}
    if (d.enabled){
      maintenanceBanner.style.display="block"
      maintenanceBanner.textContent = d.message || "Apkopes režīms."
    } else {
      maintenanceBanner.style.display="none"
      maintenanceBanner.textContent = ""
    }
  })
}

// Room meta
async function ensureMeta(user){
  roomId = "user_" + user.uid
  const metaRef = ref(db, `${CHAT_ROOT}/rooms/${roomId}/meta`)
  const snap = await get(metaRef)
  const existing = snap.val() || {}
  const now = Date.now()
  await update(metaRef, {
    title: user.email || "Lietotājs",
    userUid: user.uid,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    started: true
  })
}

// Start listening to messages
function startMessages(){
  if (unsub) unsub()

  // 1) Immediately render from cache so chat doesn't look empty on re-entry
  const cached = loadMsgsCache()
  if (cached && !cacheRestored){
    render(cached, { restoreScroll: true })
    cacheRestored = true
  }

  // 2) Live updates from Firebase
  const mRef = ref(db, `${CHAT_ROOT}/rooms/${roomId}/messages`)
  unsub = onValue(mRef, snap=>{
    const raw = snap.val() || {}
    const list = Object.entries(raw).map(([id,v])=>({ id, ...v }))
      .sort((a,b)=>{
        const ta = typeof a.ts === "number" ? a.ts : 0
        const tb = typeof b.ts === "number" ? b.ts : 0
        return ta - tb
      })
    // Save to cache and render
    saveMsgsCache(list)
    render(list)
  })
}

// Render
function render(list, opts={}){
  const restoreScroll = !!opts.restoreScroll

  // Keep current scroll position if not restoring from cache
  let previousBottomGap = null
  if (!restoreScroll){
    const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 4
    if (!atBottom){
      previousBottomGap = messagesEl.scrollHeight - messagesEl.scrollTop
    }
  }

  messagesEl.innerHTML = ""
  list.forEach(m=>{
    const div = document.createElement("div")
    const roleCls = m.system ? "system" : (m.isSupport ? "support" : "")
    div.className = "chat-msg " + roleCls
    const time = typeof m.ts === "number"
      ? new Date(m.ts).toLocaleTimeString("lv-LV",{hour:"2-digit",minute:"2-digit"})
      : ""
    div.innerHTML = `
      <div class="meta">
        <span class="author">${sanitize(m.system ? "SYSTEM" : (m.email||"Anonīms"))}${m.isSupport && !m.system ? " (Atbalsts)" : ""}</span>
        <span class="time">${time}</span>
      </div>
      <div class="text">${sanitize(m.text)}</div>
    `
    messagesEl.appendChild(div)
  })

  if (restoreScroll){
    const saved = loadScroll()
    if (saved){
      messagesEl.scrollTop = saved
      clearScroll()
    } else {
      messagesEl.scrollTop = messagesEl.scrollHeight
    }
  } else {
    if (previousBottomGap !== null){
      // Maintain user's view offset if they were mid-history
      messagesEl.scrollTop = messagesEl.scrollHeight - previousBottomGap
    } else {
      // Auto-scroll new messages
      messagesEl.scrollTop = messagesEl.scrollHeight
    }
  }

  statusEl.textContent = list.length ? "" : "Nav ziņu."
}

// Send message
form?.addEventListener("submit", async e=>{
  e.preventDefault()
  if (!currentUser) return alert("Nepieciešama pieteikšanās.")
  const text = input.value.trim()
  if (!text) return
  try {
    const nowTs = Date.now()

    // Optimistic append to UI and cache to avoid flicker
    const optimistic = {
      id: "local_"+nowTs,
      uid: currentUser.uid,
      email: currentUser.email,
      text,
      isSupport: false,
      system: false,
      ts: nowTs,
      createdAt: nowTs
    }
    // Merge to cached list and render immediately
    const cached = loadMsgsCache() || []
    const merged = [...cached, optimistic].sort((a,b)=>(a.ts||0)-(b.ts||0))
    saveMsgsCache(merged)
    render(merged)

    await update(ref(db, `${CHAT_ROOT}/rooms/${roomId}/meta`), {
      updatedAt: nowTs,
      lastUserActivity: nowTs
    })
    await push(ref(db, `${CHAT_ROOT}/rooms/${roomId}/messages`), {
      uid: currentUser.uid,
      email: currentUser.email,
      text,
      isSupport: false,
      system: false,
      ts: nowTs,
      createdAt: nowTs
    })
    input.value=""
    saveDraftCache("")
    input.focus()
  } catch(err){
    console.error("Send error", err)
    statusEl.textContent = "Kļūda: " + err.message
  }
})

// Persist draft while typing
input?.addEventListener("input", ()=>{
  saveDraftCache(input.value)
})

// Save scroll on page hide (more robust than 'unload')
window.addEventListener("pagehide", saveScroll)
document.addEventListener("visibilitychange", ()=>{
  if (document.visibilityState === "hidden") saveScroll()
})

// Auth
onAuthStateChanged(auth, async user=>{
  if (!user){
    currentUser = null
    form.style.display="none"
    loginPrompt.style.display="block"
    statusEl.textContent="Nepieteicies."
    return
  }
  currentUser = user
  loginPrompt.style.display="none"
  form.style.display="flex"
  try {
    // Restore draft early
    input.value = loadDraftCache()

    await ensureMeta(user)
    watchMaintenance()
    startMessages()
    statusEl.textContent="Savienots."
  } catch(err){
    console.error("Init chat error", err)
    statusEl.textContent="Kļūda: " + err.message
  }
})