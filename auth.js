import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { loadUserSettingsApply, applyI18n } from "./common.js";

const SUPPORT_EMAIL = "help@help.com";

const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const googleBtn = document.getElementById("googleBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");

// Auth state: only protect gated pages when signed out.
// No auto-redirect to dashboard/index when already signed in.
onAuthStateChanged(auth, async (user) => {
  const file = location.pathname.split("/").pop();
  const isProtected = [
    "dashboard.html",
    "budgets.html",
    "reports.html",
    "settings.html",
    "export.html",
    "planner.html",
    "notes.html",
    "help.html",
    "agent.html",
  ].includes(file);

  if (user) {
    if (userEmail) userEmail.textContent = user.email;
    await loadUserSettingsApply();
    applyI18n();
    // Stay on the current page; no auto navigation.
  } else {
    if (isProtected) {
      location.replace("index.html");
    }
  }
});

loginBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    const cred = await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    if (cred.user.email === SUPPORT_EMAIL) {
      location.replace("agent.html");
    } else {
      location.replace("dashboard.html");
    }
  } catch (err) {
    alert("Neizdevās pieteikties: " + err.message);
  }
});

signupBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  if (emailInput.value === SUPPORT_EMAIL) {
    alert("Šo kontu nevar reģistrēt caur formu.");
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
    location.replace("dashboard.html");
  } catch (err) {
    alert("Neizdevās reģistrēties: " + err.message);
  }
});

if (googleBtn) {
  const provider = new GoogleAuthProvider();
  googleBtn.addEventListener("click", async () => {
    try {
      const cred = await signInWithPopup(auth, provider);
      if (cred.user.email === SUPPORT_EMAIL) {
        location.replace("agent.html");
      } else {
        location.replace("dashboard.html");
      }
    } catch (err) {
      alert("Google kļūda: " + err.message);
    }
  });
}

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Logout error:", e);
  }
  // Force redirect to index after logout (even if currently on help.html)
  location.replace("index.html");
});