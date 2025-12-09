// firebase.js
// CDN-based Firebase init + helpers.
// Exports: app, auth, db, storage, waitForAuth, saveUserSetting, fetchInitialUserSettings

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAnalytics, isSupported as analyticsSupported } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-analytics.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getDatabase, ref, update, get, child } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDiGRvZGp1iW4wFDEYt7BtdSkuvVZHddV8",
  authDomain: "datorikasproject.firebaseapp.com",
  databaseURL: "https://datorikasproject-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "datorikasproject",
  storageBucket: "datorikasproject.appspot.com",
  messagingSenderId: "838323655873",
  appId: "1:838323655873:web:00ce08bcc4d27ad5d8b040",
  measurementId: "G-NWJ7BSZZFE"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

export let analytics = null;
(async () => {
  try {
    if (await analyticsSupported()) analytics = getAnalytics(app);
  } catch (e) {
    analytics = null;
  }
})();

// Wait for Firebase Auth user (resolve with user or null)
export function waitForAuth(timeout = 4500) {
  return new Promise((resolve) => {
    const cur = auth.currentUser;
    if (cur) return resolve(cur);
    let done = false;
    const unbind = onAuthStateChanged(auth, (u) => {
      if (done) return;
      done = true;
      try { if (typeof unbind === 'function') unbind(); } catch (e) {}
      resolve(u);
    });
    setTimeout(() => {
      if (done) return;
      done = true;
      try { if (typeof unbind === 'function') unbind(); } catch (e) {}
      resolve(auth.currentUser || null);
    }, timeout);
  });
}

// Save a single setting under /users/{uid}/settings/{key}
export async function saveUserSetting(key, value) {
  if (value === undefined) {
    console.warn(`saveUserSetting: value for ${key} is undefined; skipping`);
    return false;
  }
  const user = await waitForAuth();
  if (!user) throw new Error("Not authenticated - cannot save setting to DB");
  const updates = {};
  updates[`users/${user.uid}/settings/${key}`] = value;
  await update(ref(db), updates);
  return true;
}

// Fetch /users/{uid}/settings
export async function fetchInitialUserSettings() {
  const user = await waitForAuth();
  if (!user) return null;
  try {
    const snap = await get(child(ref(db), `users/${user.uid}/settings`));
    if (!snap.exists()) return null;
    return snap.val();
  } catch (e) {
    console.warn('fetchInitialUserSettings error', e);
    return null;
  }
}