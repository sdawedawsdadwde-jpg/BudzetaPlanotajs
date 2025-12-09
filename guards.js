import { auth, db, waitForAuth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

const shownOverlays = new Set();

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showOverlay(id, title, body, dismissMs = 5000, danger = false, onClose) {
  if (shownOverlays.has(id)) return;
  shownOverlays.add(id);
  const wrap = document.createElement('div');
  wrap.className = 'system-guard-overlay';
  wrap.id = `guard-${id}`;
  wrap.innerHTML = `
    <div class="system-guard-box ${danger ? 'sg-alert' : 'sg-info'}">
      <h3>${sanitize(title)}</h3>
      <div class="system-guard-msg">${sanitize(body)}</div>
      <div class="system-guard-actions">
        <button class="close" disabled>Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  const btn = wrap.querySelector('button.close');
  let remaining = Math.max(1000, dismissMs || 5000);
  const tick = 500;
  btn.textContent = `Close (${Math.ceil(remaining/1000)}s)`;
  const iv = setInterval(() => {
    remaining -= tick;
    if (remaining > 0) {
      btn.textContent = `Close (${Math.ceil(remaining/1000)}s)`;
    } else {
      clearInterval(iv);
      btn.disabled = false;
      btn.textContent = "Close";
      btn.onclick = () => {
        wrap.remove();
        if (typeof onClose === 'function') onClose();
      };
    }
  }, tick);
}

export function startGuards() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const uid = user.uid;

    // Ban/warning watcher
    onValue(ref(db, `users/${uid}`), snap => {
      const v = snap.val() || {};
      const now = Date.now();
      const bannedUntil = v.bannedUntil || null;
      const bannedActive = v.banned && (!bannedUntil || now <= bannedUntil);
      if (bannedActive) {
        showOverlay(`ban-${uid}`, 'Account banned', v.lastStrikeReason || 'Policy violation', 8000, true);
        setTimeout(() => { try { window.location.href = 'ban.html'; } catch(e){} }, 1200);
      }
      const warnCount = v.warnings || 0;
      const seenCount = v.settings?.seenWarnings || 0;
      if (warnCount > 0 && warnCount > seenCount) {
        showOverlay(
          `warn-${uid}-${warnCount}`,
          'Warnings',
          `You have ${warnCount} warning(s). Please follow the rules.`,
          6000,
          false,
          async () => {
            // mark seen in DB
            await update(ref(db), { [`users/${uid}/settings/seenWarnings`]: warnCount });
          }
        );
      }
    });

    // Inbox overlay watcher
    onValue(ref(db, `userInbox/${uid}`), snap => {
      const msgs = snap.val() || {};
      const now = Date.now();
      Object.entries(msgs).forEach(([id, m]) => {
        if (m.expiresAt && now > m.expiresAt) {
          update(ref(db), { [`userInbox/${uid}/${id}`]: null });
          return;
        }
        if (document.getElementById(`overlay-${id}`)) return;
        const wrap = document.createElement('div');
        wrap.className = 'system-guard-overlay';
        wrap.id = `overlay-${id}`;
        wrap.innerHTML = `
          <div class="system-guard-box sg-info">
            <h3>Message from support</h3>
            <div class="system-guard-msg">
              ${sanitize(m.text)}
              ${m.reason ? `<div class="small muted" style="margin-top:8px;">Reason: ${sanitize(m.reason)}</div>` : ""}
            </div>
            <div class="system-guard-actions">
              <button class="close" disabled>Close</button>
            </div>
          </div>
        `;
        document.body.appendChild(wrap);
        const closeBtn = wrap.querySelector('button.close');
        let remaining = Math.max(1000, m.dismissibleAfter || 5000);
        const tick = 500;
        closeBtn.textContent = `Close (${Math.ceil(remaining/1000)}s)`;
        const iv = setInterval(() => {
          remaining -= tick;
          if (remaining > 0) {
            closeBtn.textContent = `Close (${Math.ceil(remaining/1000)}s)`;
          } else {
            clearInterval(iv);
            closeBtn.disabled = false;
            closeBtn.textContent = "Close";
            closeBtn.onclick = async () => {
              wrap.remove();
              const cur = await waitForAuth();
              if (!cur) return;
              await update(ref(db), { [`userInbox/${cur.uid}/${id}`]: null });
            };
          }
        }, tick);
      });
    });
  });
}

// auto-start when loaded
startGuards();