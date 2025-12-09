// graph-guard.js
// Site-wide performance guard: toggle .low-graphics, suppress particles, persist per-user setting.
// Auto-injects a header toggle via graph-toggle.js (if present) and emits graph-guard:changed events.
//
// Usage:
// <script type="module" src="/path/to/firebase.js"></script>
// <script type="module" src="/path/to/graph-guard.js"></script>
// Optionally include graph-toggle.js (below) after graph-guard to inject the switch UI.
//
// NOTE: this module expects firebase.js to export saveUserSetting and fetchInitialUserSettings
// as previously provided. It will gracefully fall back to localStorage when firebase isn't available.

const STORAGE_KEY = 'lowGraphics'
let enabled = false
let initDone = false

// apply/remove class safely
function _applyClass(state) {
  const run = () => {
    if (state) document.documentElement.classList.add('low-graphics')
    else document.documentElement.classList.remove('low-graphics')
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true })
  } else run()
}

// persist pref to DB or localStorage (firebase.saveUserSetting fallback)
async function _persistPref(val) {
  try {
    const fb = await import('./firebase.js')
    if (fb && typeof fb.saveUserSetting === 'function') {
      try {
        await fb.saveUserSetting('lowGraphics', !!val)
        return
      } catch (e) {
        console.warn('graph-guard: firebase save failed, falling back to localStorage', e)
      }
    }
  } catch (e) { /* ignore */ }
  try { localStorage.setItem(STORAGE_KEY, val ? '1' : '0') } catch (e) {}
}

// read pref: onSettings quick -> firebase -> localStorage
async function _readPref() {
  // try common.onSettings quick
  try {
    const common = await import('./common.js')
    if (common && typeof common.onSettings === 'function') {
      return new Promise((resolve) => {
        let resolved = false
        common.onSettings((s) => {
          if (resolved) return
          if (s && typeof s.lowGraphics !== 'undefined') {
            resolved = true
            resolve(!!s.lowGraphics)
          } else {
            resolved = true
            resolve(null)
          }
        })
        setTimeout(() => {
          if (resolved) return
          resolved = true
          resolve(null)
        }, 600)
      })
    }
  } catch (e) {}

  // try firebase
  try {
    const fb = await import('./firebase.js')
    if (fb && typeof fb.fetchInitialUserSettings === 'function') {
      try {
        const settings = await fb.fetchInitialUserSettings()
        if (settings && typeof settings.lowGraphics !== 'undefined') return !!settings.lowGraphics
      } catch (e) { console.warn('graph-guard fetchInitialUserSettings failed', e) }
    }
  } catch (e) {}

  // fallback localStorage
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v !== null) return v === '1'
  } catch (e) {}
  return false
}

/* -------- particles suppression (best-effort) -------- */
// hide canvases conservatively; keep backups so restore is possible
const _canvasBackups = new WeakMap()
function _hideCanvas(canvas) {
  if (!canvas || canvas.nodeName !== 'CANVAS') return
  if (!_canvasBackups.has(canvas)) {
    _canvasBackups.set(canvas, {
      display: canvas.style.display || '',
      visibility: canvas.style.visibility || '',
      opacity: canvas.style.opacity || '',
      pointerEvents: canvas.style.pointerEvents || '',
      willChange: canvas.style.willChange || ''
    })
  }
  canvas.style.display = 'none'
  canvas.style.visibility = 'hidden'
  canvas.style.opacity = '0'
  canvas.style.pointerEvents = 'none'
  canvas.style.willChange = 'auto'
}
function _restoreCanvas(canvas) {
  const prev = _canvasBackups.get(canvas)
  if (!prev) return
  canvas.style.display = prev.display
  canvas.style.visibility = prev.visibility
  canvas.style.opacity = prev.opacity
  canvas.style.pointerEvents = prev.pointerEvents
  canvas.style.willChange = prev.willChange
  _canvasBackups.delete(canvas)
}
async function _suppressParticles() {
  // tsParticles
  try {
    if (window.tsParticles && typeof window.tsParticles.dom === 'function') {
      const dom = window.tsParticles.dom()
      for (let i = 0; i < dom.length; i++) {
        const container = dom[i]
        try {
          if (typeof container.pause === 'function') { container.pause(); continue }
          if (typeof container.stop === 'function') { container.stop(); continue }
        } catch (e) {}
        const canvas = container && container.canvas && container.canvas.element ? container.canvas.element : null
        if (canvas) _hideCanvas(canvas)
      }
    }
  } catch (e) {}
  // particles.js (older lib)
  try {
    if (window.pJSDom && Array.isArray(window.pJSDom)) {
      for (let i = 0; i < window.pJSDom.length; i++) {
        try {
          const entry = window.pJSDom[i]
          const canvas = (entry && entry.canvas && entry.canvas.el) || document.querySelector('.particles-js-canvas-el')
          if (canvas) _hideCanvas(canvas)
        } catch (e) {}
      }
    }
  } catch (e) {}
  // generic selectors fallback
  try {
    document.querySelectorAll('canvas.tsparticles-canvas-el, canvas.particles-js-canvas-el, canvas[data-particles]').forEach(c => _hideCanvas(c))
  } catch (e) {}
}
async function _restoreParticles() {
  try {
    document.querySelectorAll('canvas.tsparticles-canvas-el, canvas.particles-js-canvas-el, canvas[data-particles]').forEach(_restoreCanvas)
  } catch (e) {}
  // try tsParticles resume calls
  try {
    if (window.tsParticles && typeof window.tsParticles.dom === 'function') {
      const dom = window.tsParticles.dom()
      dom.forEach(container => {
        try {
          if (typeof container.play === 'function') { container.play(); return }
          if (typeof container.start === 'function') { container.start(); return }
        } catch (e) {}
      })
    }
  } catch (e) {}
}

/* -------- API: enable/disable/toggle -------- */

async function enableLowGraphics() {
  if (enabled) return
  enabled = true
  _applyClass(true)
  try { await _suppressParticles() } catch (e) { console.warn('graph-guard suppress particles', e) }
  _persistPref(true).catch(()=>{})
  try { document.dispatchEvent(new CustomEvent('graph-guard:changed', { detail: { enabled: true } })) } catch (e) {}
}

async function disableLowGraphics() {
  if (!enabled) return
  enabled = false
  _applyClass(false)
  try { await _restoreParticles() } catch (e) { console.warn('graph-guard restore particles', e) }
  _persistPref(false).catch(()=>{})
  try { document.dispatchEvent(new CustomEvent('graph-guard:changed', { detail: { enabled: false } })) } catch (e) {}
}

function toggleLowGraphics() { if (enabled) disableLowGraphics(); else enableLowGraphics() }
function isEnabled() { return enabled }

/* -------- auth & settings sync -------- */

async function _attachAuthListener() {
  try {
    const fb = await import('./firebase.js')
    if (fb && fb.auth) {
      const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js')
      onAuthStateChanged(fb.auth, async (user) => {
        if (user) {
          try {
            const settings = await fb.fetchInitialUserSettings()
            if (settings && typeof settings.lowGraphics !== 'undefined') {
              if (settings.lowGraphics && !enabled) { enabled = true; _applyClass(true); await _suppressParticles(); document.dispatchEvent(new CustomEvent('graph-guard:changed', { detail: { enabled: true } })) }
              else if (!settings.lowGraphics && enabled) { enabled = false; _applyClass(false); await _restoreParticles(); document.dispatchEvent(new CustomEvent('graph-guard:changed', { detail: { enabled: false } })) }
            }
          } catch (e) { console.warn('graph-guard fetch on auth change failed', e) }
        }
      })
    }
  } catch (e) {}
}

;(async function init() {
  if (initDone) return
  initDone = true

  try {
    const common = await import('./common.js')
    if (common && typeof common.onSettings === 'function') {
      common.onSettings((s) => {
        if (s && typeof s.lowGraphics !== 'undefined') {
          const want = !!s.lowGraphics
          if (want && !enabled) { enabled = true; _applyClass(true); _suppressParticles().catch(()=>{}); document.dispatchEvent(new CustomEvent('graph-guard:changed', { detail: { enabled: true } })) }
          if (!want && enabled) { enabled = false; _applyClass(false); _restoreParticles().catch(()=>{}); document.dispatchEvent(new CustomEvent('graph-guard:changed', { detail: { enabled: false } })) }
        }
      })
    }
  } catch (e) {}

  _attachAuthListener().catch(()=>{})

  try {
    const pref = await _readPref()
    if (pref) { enabled = true; _applyClass(true); await _suppressParticles(); document.dispatchEvent(new CustomEvent('graph-guard:changed', { detail: { enabled: true } })) }
    else { enabled = false; _applyClass(false) }
  } catch (e) { console.warn('graph-guard init readPref failed', e) }

  try { window.graphGuard = { enable: enableLowGraphics, disable: disableLowGraphics, toggle: toggleLowGraphics, isEnabled } } catch (e) {}
  try { document.addEventListener('graph-guard:toggle', () => toggleLowGraphics()) } catch (e) {}
})()

export { enableLowGraphics as enable, disableLowGraphics as disable, toggleLowGraphics as toggle, isEnabled as isEnabled }