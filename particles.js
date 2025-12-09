const canvas = document.getElementById("particles")
if (canvas){
  // Respect user preference and app low-graphics flag early.
  const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const appLowGraphics = () => document.documentElement.classList.contains('low-graphics')

  if (prefersReduce || appLowGraphics()) {
    // Hide the element so it's harmless even if present in DOM
    canvas.style.display = 'none'
  } else {
    const ctx = canvas.getContext("2d")
    let w,h, rafId=null, running=true
    // adapt node count to device capabilities: conservative defaults
    const deviceMem = navigator.deviceMemory || 4
    const baseCount = Math.max(30, Math.min(120, Math.round(deviceMem * 18)))
    let nodeCount = baseCount
    // reduce nodes on small screens
    if (window.innerWidth < 800) nodeCount = Math.max(18, Math.round(nodeCount * 0.6))

    function resize(){
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    let resizeTimer = null
    window.addEventListener("resize", ()=> {
      // throttle resizing
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(resize, 200)
    }, { passive:true })

    // build nodes
    const nodes = Array.from({ length: nodeCount }, ()=> ({
      x: Math.random()*w,
      y: Math.random()*h,
      r: Math.random()*3+1,
      p: Math.random(),
      s: Math.random()*0.5+0.2
    }))

    // Pause/resume when page hidden to avoid background CPU
    function updateRunningState(){
      const shouldRun = !document.hidden && !appLowGraphics()
      if (shouldRun && !running){
        running = true
        loop()
      } else if (!shouldRun && running){
        running = false
        if (rafId) { cancelAnimationFrame(rafId); rafId=null }
      }
    }
    document.addEventListener('visibilitychange', updateRunningState)
    // If low-graphics mode toggles live, also watch DOM class changes
    const mo = new MutationObserver(()=> updateRunningState())
    mo.observe(document.documentElement, { attributes:true, attributeFilter:['class'] })

    function loop(){
      if (!running) return
      ctx.clearRect(0,0,w,h)
      for (let i=0;i<nodes.length;i++){
        const n = nodes[i]
        n.p += 0.01*n.s
        const alpha = .12 + Math.abs(Math.sin(n.p))*0.6
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.fill()
        n.x += Math.sin(n.p)*0.4
        n.y += Math.cos(n.p)*0.3
        if (n.x<0) n.x=w; if (n.x>w) n.x=0
        if (n.y<0) n.y=h; if (n.y>h) n.y=0
        for (let j=i+1;j<nodes.length;j++){
          const m = nodes[j]
          const dx = n.x - m.x
          const dy = n.y - m.y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 140){
            ctx.beginPath()
            ctx.moveTo(n.x, n.y)
            ctx.lineTo(m.x, m.y)
            ctx.strokeStyle = `rgba(255,255,255,${0.06 + (140-dist)/140 * 0.08})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }
      rafId = requestAnimationFrame(loop)
    }

    // Start if page visible and not in low-graphics
    updateRunningState()
    if (running && !rafId) loop()
  }
}