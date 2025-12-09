import { db } from "./firebase.js"
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js"

// IMPORTANT: Set this to your live root
const CHAT_ROOT = "support/chat" // or "support/chat/global"

const BROADCAST_REF = ref(db, `${CHAT_ROOT}/systemBroadcast`)
let currentId = null
let overlayEl = null

function dismissedKey(id){ return `sys_guard_dismiss_${id}` }
function isDismissed(id){ try { return localStorage.getItem(dismissedKey(id)) === "1" } catch { return false } }
function setDismissed(id){ try { localStorage.setItem(dismissedKey(id), "1") } catch {} }

function escapeHtml(str){
  return (str||"").replace(/[<>&"]/g, c=>({ "<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;" }[c]))
}

function removeOverlay(){
  if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl)
  overlayEl = null
}

function buildOverlay(data){
  removeOverlay()
  const { message="", level="info", id, dismissible=true } = data
  if (!message.trim()) return

  overlayEl = document.createElement("div")
  overlayEl.className = "system-guard-overlay"

  const box = document.createElement("div")
  box.className = "system-guard-box sg-" + (["info","warning","alert"].includes(level)?level:"info")

  const titleMap = { info:"Sistēmas paziņojums", warning:"Brīdinājums", alert:"Svarīgs paziņojums" }
  const title = titleMap[level] || titleMap.info

  box.innerHTML = `
    <h3>${title}</h3>
    <div class="system-guard-msg">${escapeHtml(message)}</div>
    <div class="system-guard-actions">
      ${dismissible ? `<button type="button" class="close">Aizvērt</button>` : ""}
    </div>
  `
  overlayEl.appendChild(box)
  document.body.appendChild(overlayEl)

  if (dismissible){
    box.querySelector(".close")?.addEventListener("click", ()=>{
      setDismissed(id)
      removeOverlay()
    })
  }
}

onValue(BROADCAST_REF, snap=>{
  const data = snap.val() || {}
  const { active=false, id=null, expiresAt=null } = data

  if (!active){
    currentId = null
    removeOverlay()
    return
  }
  if (expiresAt && Date.now() > expiresAt){
    removeOverlay()
    return
  }

  const resolvedId = id || ("sys_" + (data.message||"").length + "_" + (data.createdAt || Date.now()))
  data.id = resolvedId

  if (currentId === resolvedId) return
  currentId = resolvedId

  if (isDismissed(resolvedId)){
    removeOverlay()
    return
  }

  buildOverlay(data)
}, err=>{
  console.error("[system-guard] read error", err)
})