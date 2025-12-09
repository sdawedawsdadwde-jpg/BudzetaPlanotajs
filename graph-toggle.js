// graph-toggle.js
// Small helper that injects a compact toggle into your header and keeps it synced with window.graphGuard.
// Include after graph-guard.js or include both in the layout.
// If you already have a header toggle, you can skip including this.

function createToggle() {
  const wrap = document.createElement('div')
  wrap.id = 'graphToggleWrap'
  wrap.style.display = 'flex'
  wrap.style.alignItems = 'center'
  wrap.style.gap = '8px'
  wrap.style.marginLeft = '12px'
  wrap.style.fontSize = '0.9rem'
  wrap.style.userSelect = 'none'

  const btn = document.createElement('button')
  btn.id = 'graphToggleBtn'
  btn.type = 'button'
  btn.className = 'btn small'
  btn.style.padding = '6px 10px'
  btn.style.borderRadius = '999px'
  btn.style.cursor = 'pointer'
  btn.style.background = 'transparent'
  btn.style.border = '1px solid rgba(255,255,255,0.06)'

 

  wrap.appendChild(btn)
  wrap.appendChild(label)

  btn.addEventListener('click', () => {
    if (window.graphGuard && typeof window.graphGuard.toggle === 'function') window.graphGuard.toggle()
    else document.dispatchEvent(new CustomEvent('graph-guard:toggle'))
  })

  // update UI when guard changes
  function updateUI(enabled) {
    label.textContent = enabled ? 'Veiktspējas režīms: ieslēgts' : 'Veiktspējas režīms: izslēgts'
    btn.setAttribute('aria-pressed', !!enabled ? 'true' : 'false')
    if (enabled) btn.style.background = 'linear-gradient(90deg,#2ea44f,#1b8a3e)'
    else { btn.style.background = 'transparent' }
  }

  document.addEventListener('graph-guard:changed', (e) => {
    try { updateUI(!!(e && e.detail && e.detail.enabled)) } catch (err) {}
  })

  // initialize from existing guard state if available
  try {
    updateUI(Boolean(window.graphGuard && typeof window.graphGuard.isEnabled === 'function' ? window.graphGuard.isEnabled() : false))
  } catch (e) {}

  return wrap
}

function mountToggle() {
  // try to put the toggle near .userbox or nav in header
  const header = document.querySelector('header.topbar') || document.querySelector('header')
  if (!header) return
  if (document.getElementById('graphToggleWrap')) return

  // prefer to insert before/after .userbox
  const userbox = header.querySelector('.userbox')
  if (userbox && userbox.parentElement) {
    userbox.insertAdjacentElement('afterend', createToggle())
  } else {
    // fallback: append to header nav area
    header.appendChild(createToggle())
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountToggle)
else mountToggle()