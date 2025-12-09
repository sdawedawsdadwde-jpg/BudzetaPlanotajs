import { auth, db } from "./firebase.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js"

const SUPPORT_EMAIL = "help@help.com"
const CHAT_ROOT = "support/chat" // align with your DB path
const page = location.pathname.split("/").pop()
let userEmail = null
let maintenance = { enabled:false }

onAuthStateChanged(auth, u=>{
  userEmail = u?.email || null
  runGuard()
})

onValue(ref(db, `${CHAT_ROOT}/maintenance`), snap=>{
  maintenance = snap.val() || { enabled:false }
  runGuard()
})

function runGuard(){
  const support = userEmail === SUPPORT_EMAIL
  if (maintenance.enabled){
    if (!support && page !== "maintenance.html" && page !== "agent.html") {
      location.replace("maintenance.html")
    }
  } else {
    if (page === "maintenance.html") location.replace("index.html")
  }
}