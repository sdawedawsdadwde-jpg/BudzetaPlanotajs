// app.js
import { auth } from "./firebase.js"
import { ref, push, update, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"
import { db } from "./firebase.js"
import { uid, onTransactions, formatMoney, settings, addCategory, hydrateDynamicSelects, getCategoryList, onSettings } from "./common.js"

const typeEl = document.getElementById("type")
const categoryEl = document.getElementById("category")
const amountEl = document.getElementById("amount")
const dateEl = document.getElementById("date")
const notesEl = document.getElementById("notes")
const editingIdEl = document.getElementById("editingId")
const txForm = document.getElementById("txForm")
const resetBtn = document.getElementById("resetBtn")
const incomeTotalEl = document.getElementById("incomeTotal")
const expenseTotalEl = document.getElementById("expenseTotal")
const balanceTotalEl = document.getElementById("balanceTotal")
const txBody = document.getElementById("txBody")
const filterTypeEl = document.getElementById("filterType")
const filterCategoryEl = document.getElementById("filterCategory")
const categoryCanvas = document.getElementById("categoryChart")
const dailyCanvas = document.getElementById("dailyLine")
const stackedCanvas = document.getElementById("stackedArea")
const radarCanvas = document.getElementById("radarChart")
const trendEl = document.getElementById("trend")
const chartsDisabledMsg = document.getElementById("chartsDisabledMsg")
const advancedSection = document.getElementById("advancedChartsSection")
const popularCats = document.getElementById("popularCats")

const hasDashboardUI = incomeTotalEl && expenseTotalEl && balanceTotalEl && txBody;

if (hasDashboardUI) {
  initDashboard();
}

function initDashboard(){
  let categoryChart, dailyChart, stackedChart, radarChart
  if (dateEl) dateEl.value = new Date().toISOString().slice(0,10)
  let allTx = []

  onTransactions(arr=>{
    allTx = arr.slice()
    render()
  })
  onSettings(()=> render())

  filterTypeEl?.addEventListener("change", render)
  filterCategoryEl?.addEventListener("change", render)
  resetBtn?.addEventListener("click", clearForm)

  categoryEl?.addEventListener("change", ()=> {
    if (categoryEl.value === "__new__"){
      const name = prompt("Ievadi jauno kategoriju:")
      if (!name) { hydrateDynamicSelects(); return }
      const color = "#"+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,"0")
      addCategory(name, color)
      setTimeout(()=> {
        hydrateDynamicSelects()
        categoryEl.value = name
      }, 300)
    }
  })

  popularCats?.addEventListener("click", e=>{
    const btn = e.target.closest(".chip")
    if (!btn) return
    const name = btn.dataset.cat
    const exists = Array.from(categoryEl.options).some(o=>o.value===name)
    if (exists){
      categoryEl.value = name
      categoryEl.dispatchEvent(new Event("change"))
    } else {
      const defaults = {Alga:"#00d68f","Mājoklis":"#8a7dff","Ēdiens":"#ff8ba7","Transports":"#ffc971","Izklaide":"#ff5470"}
      const color = defaults[name] || "#8a7dff"
      addCategory(name, color)
      setTimeout(()=>{
        hydrateDynamicSelects()
        categoryEl.value = name
        categoryEl.dispatchEvent(new Event("change"))
      }, 350)
    }
  })

  txForm?.addEventListener("submit", async e=>{
    e.preventDefault()
    if (!uid) return alert("Nav lietotāja.")
    const id = editingIdEl.value
    try {
      if (id) {
        const payload = {
          type: typeEl.value,
          category: categoryEl.value,
          amount: Number(amountEl.value||0),
          date: dateEl.value,
          notes: notesEl.value.trim(),
          uid: uid,
          updatedAt: serverTimestamp()
        }
        await update(ref(db, `users/${uid}/transactions/${id}`), payload)
      } else {
        const payload = {
          uid: uid,
          type: typeEl.value,
          category: categoryEl.value,
          amount: Number(amountEl.value||0),
          date: dateEl.value,
          notes: notesEl.value.trim(),
          createdAt: serverTimestamp()
        }
        if (!payload.date || isNaN(payload.amount)) return alert("Nepareizi dati.")
        await push(ref(db, `users/${uid}/transactions`), payload)
      }
      clearForm()
    } catch (err){
      alert("Save error: " + (err && err.message ? err.message : String(err)))
      console.error("Transaction save error:", err)
    }
  })

  function clearForm(){
    editingIdEl.value=""
    typeEl.value="income"
    amountEl.value=""
    notesEl.value=""
    dateEl.value = new Date().toISOString().slice(0,10)
    const list = getCategoryList()
    if (list[0]) categoryEl.value=list[0].name
    document.getElementById("saveBtn").textContent="Saglabāt"
  }

  function render(){
    hydrateDynamicSelects()
    const tFilter = filterTypeEl?.value || "all"
    const cFilter = filterCategoryEl?.value || "all"
    const filt = allTx.filter(t=>{
      const okT = tFilter==="all"||t.type===tFilter
      const okC = cFilter==="all"||t.category===cFilter
      return okT && okC
    }).sort((a,b)=> (a.date < b.date ? 1 : -1))

    const income = filt.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0)
    const expense = filt.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0)
    const balance = income - expense
    incomeTotalEl.textContent = formatMoney(income)
    expenseTotalEl.textContent = formatMoney(expense)
    balanceTotalEl.textContent = formatMoney(balance)

    const now = Date.now()
    const d30 = 1000*60*60*24*30
    const recent = allTx.filter(t=> new Date(t.date).getTime() > now - d30)
    const previous = allTx.filter(t=> {
      const time = new Date(t.date).getTime()
      return time <= now - d30 && time > now - 2*d30
    })
    const rBal = recent.reduce((s,t)=> s + (t.type==="income"?t.amount:-t.amount),0)
    const pBal = previous.reduce((s,t)=> s + (t.type==="income"?t.amount:-t.amount),0)
    const diff = rBal - pBal
    if (trendEl){
      if (diff > 0) { trendEl.textContent = "↑ Uz Augšu"; trendEl.className="trendTag up" }
      else if (diff < 0){ trendEl.textContent = "↓ Uz Leju"; trendEl.className="trendTag down" }
      else { trendEl.textContent = "→ Stabils"; trendEl.className="trendTag neutral" }
    }

    txBody.innerHTML=""
    for (const t of filt){
      const tr=document.createElement("tr")
      tr.innerHTML = `
        <td>${t.date||""}</td>
        <td>${t.type==="income"?"Ienākumi":"Izdevumi"}</td>
        <td>${t.category||""}</td>
        <td>${(t.notes||"").replace(/</g,"&lt;")}</td>
        <td class="right ${t.type==="income"?"money plus":"money minus"}">${formatMoney(t.amount)}</td>
        <td>
          <button class="btn outline small" data-edit="${t.id}">Labot</button>
          <button class="btn danger small" data-del="${t.id}">Dzēst</button>
        </td>`
      txBody.appendChild(tr)
    }
    txBody.querySelectorAll("[data-edit]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-edit")
        const t = allTx.find(x=>x.id===id)
        if (!t) return
        editingIdEl.value = id
        typeEl.value = t.type
        categoryEl.value = t.category
        amountEl.value = t.amount
        dateEl.value = t.date
        notesEl.value = t.notes||""
        document.getElementById("saveBtn").textContent="Atjaunināt"
        window.scrollTo({ top:0, behavior:"smooth" })
      })
    })
    txBody.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        if (!confirm("Dzēst transakciju?")) return
        const id = btn.getAttribute("data-del")
        await remove(ref(db, `users/${uid}/transactions/${id}`))
      })
    })

    if (!settings.advancedCharts){
      chartsDisabledMsg.style.display="flex"
      categoryCanvas.style.display="none"
      advancedSection.querySelectorAll("canvas").forEach(c=> c.style.display="none")
      advancedSection.querySelectorAll(".adv-off").forEach(p=> p.style.display="flex")
      destroyCharts()
      return
    } else {
      chartsDisabledMsg.style.display="none"
      categoryCanvas.style.display="block"
      advancedSection.querySelectorAll("canvas").forEach(c=> c.style.display="block")
      advancedSection.querySelectorAll(".adv-off").forEach(p=> p.style.display="none")
    }

    drawCategoryChart(filt.filter(t=>t.type==="expense"))
    drawDailyChart(allTx)
    drawStackedChart(allTx)
    drawRadarChart(allTx.filter(t=>t.type==="expense"))
  }

  function destroyCharts(){
    ;[categoryChart,dailyChart,stackedChart,radarChart].forEach(ch=>{
      if (ch) ch.destroy()
    })
    categoryChart=dailyChart=stackedChart=radarChart=null
  }

  function escapeHtml(str){
    if (!str) return ''
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }

  function drawCategoryChart(expenseOnly){
    if (!categoryCanvas) return
    const byCat = {}
    for (const t of expenseOnly){
      byCat[t.category] = (byCat[t.category]||0) + t.amount
    }
    const labels = Object.keys(byCat)
    const data = Object.values(byCat)
    const total = data.reduce((s,v)=> s+v, 0)

    if (categoryChart) categoryChart.destroy()

    let tooltipEl = document.getElementById('chartjs-tooltip')
    if (!tooltipEl) {
      tooltipEl = document.createElement('div')
      tooltipEl.id = 'chartjs-tooltip'
      tooltipEl.className = 'chartjs-tooltip'
      document.body.appendChild(tooltipEl)
    }

    categoryChart = new Chart(categoryCanvas, {
      type:"doughnut",
      data:{
        labels,
        datasets:[{
          data,
          backgroundColor: labels.map(l=>getCatColor(l)),
          borderWidth: 2,
          borderColor: "#0b0f2b66",
          hoverOffset: 18
        }]
      },
      options:{
        cutout: '68%',
        rotation: -Math.PI/2,
        plugins:{
          legend:{
            position: 'top',
            align: 'start',
            labels:{
              usePointStyle:true,
              pointStyle: 'circle',
              padding: 18,
              boxWidth: 12,
              color: "#eaf1ff",
              font: { weight: 600, size: 12 }
            }
          },
          tooltip: {
            enabled: false,
            external: function(context) {
              const tooltipModel = context.tooltip
              if (!tooltipModel || tooltipModel.opacity === 0) {
                tooltipEl.style.opacity = 0
                tooltipEl.style.pointerEvents = 'none'
                return
              }
              const dpt = tooltipModel.dataPoints && tooltipModel.dataPoints[0]
              if (!dpt) return
              const idx = dpt.dataIndex
              const label = labels[idx]
              const value = data[idx] || 0
              const percent = total ? (value / total * 100) : 0
              const color = getCatColor(label)
              const recentNotes = allTx
                .filter(t => t.category === label && t.notes)
                .slice()
                .sort((a,b) => (new Date(b.date) - new Date(a.date)))
                .map(t => t.notes)
                .filter(Boolean)
                .slice(0,3)

              const money = formatMoney(value)
              const pct = percent.toFixed(1) + '%'

              let notesHtml = '<div class="cnotes"><em>— nav piezīmju —</em></div>'
              if (recentNotes.length){
                notesHtml = '<ul class="notes-list">'
                for (const n of recentNotes){
                  notesHtml += `<li>${escapeHtml(n)}</li>`
                }
                notesHtml += '</ul>'
              }

              tooltipEl.innerHTML = `
                <div class="tt-head">${escapeHtml(label)}</div>
                <div class="tt-row"><span class="tt-label">Izdevumi:</span> <span class="tt-val">${money} <span class="tt-pct">${pct}</span></span></div>
                <div class="tt-row color-row"><span class="tt-label">Krāsa:</span> <span class="swatch" style="background:${color}"></span> <code class="hex">${color}</code></div>
                <div class="tt-divider"></div>
                <div class="tt-sub">Pēdējās piezīmes:</div>
                ${notesHtml}
              `

              const canvasRect = context.chart.canvas.getBoundingClientRect()
              const caretX = tooltipModel.caretX ?? (canvasRect.width/2)
              const caretY = tooltipModel.caretY ?? (canvasRect.height/2)
              const left = window.scrollX + canvasRect.left + caretX - tooltipEl.offsetWidth/2
              const top = window.scrollY + canvasRect.top + caretY + 10

              tooltipEl.style.left = Math.max(8, left) + 'px'
              tooltipEl.style.top = Math.max(8, top) + 'px'
              tooltipEl.style.opacity = 1
              tooltipEl.style.pointerEvents = 'auto'
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true
        }
      }
    })
  }

  function drawDailyChart(all){
    if (!dailyCanvas) return
    const dayMap = {}
    all.forEach(t=>{
      if (!t.date) return
      dayMap[t.date] = dayMap[t.date] || 0
      dayMap[t.date] += t.type==="income"? t.amount : -t.amount
    })
    const labels = Object.keys(dayMap).sort()
    const data = labels.map(d=>dayMap[d])
    if (dailyChart) dailyChart.destroy()
    dailyChart = new Chart(dailyCanvas, {
      type:"line",
      data:{
        labels,
        datasets:[{
          label:"Net dienā",
          data,
          borderColor: settings.accentColor,
          backgroundColor: settings.accentColor+"40",
          tension:.3,
          fill:true,
          pointRadius:4
        }]
      },
      options:{
        plugins:{ legend:{ labels:{ color:"#eaf1ff" }}}},
        scales:{
          x:{ ticks:{ color:"#eaf1ff" } },
          y:{ ticks:{ color:"#eaf1ff" } }
        }
    })
  }

  function drawStackedChart(all){
    if (!stackedCanvas) return
    const dayMapIncome = {}
    const dayMapExpense = {}
    all.forEach(t=>{
      if (!t.date) return
      if (t.type==="income") dayMapIncome[t.date] = (dayMapIncome[t.date]||0)+t.amount
      else dayMapExpense[t.date] = (dayMapExpense[t.date]||0)+t.amount
    })
    const allDays = Array.from(new Set([...Object.keys(dayMapIncome), ...Object.keys(dayMapExpense)])).sort()
    let runIncome=0, runExpense=0
    const incomeData = allDays.map(d=> runIncome += (dayMapIncome[d]||0))
    const expenseData = allDays.map(d=> runExpense += (dayMapExpense[d]||0))
    if (stackedChart) stackedChart.destroy()
    stackedChart = new Chart(stackedCanvas, {
      type:"line",
      data:{
        labels: allDays,
        datasets:[
          { label:"Kumul. Ienākumi", data:incomeData, borderColor:"#00d68f", backgroundColor:"#00d68f40", tension:.3, fill:true },
          { label:"Kumul. Izdevumi", data:expenseData, borderColor:"#ff5470", backgroundColor:"#ff547040", tension:.3, fill:true }
        ]
      },
      options:{
        plugins:{ legend:{ labels:{ color:"#eaf1ff" }}}},
        scales:{
          x:{ ticks:{ color:"#eaf1ff" } },
          y:{ ticks:{ color:"#eaf1ff" } }
        }
    })
  }

  function drawRadarChart(exp){
    if (!radarCanvas) return
    const byCat = {}
    exp.forEach(t=>{
      byCat[t.category] = (byCat[t.category]||0)+t.amount
    })
    const labels = Object.keys(byCat)
    const data = Object.values(byCat)
    if (radarChart) radarChart.destroy()
    radarChart = new Chart(radarCanvas, {
      type:"radar",
      data:{
        labels,
        datasets:[{
          label:"Izdevumu struktūra",
          data,
          borderColor:"#c77dff",
          backgroundColor:"#c77dff40",
          pointBackgroundColor: labels.map(l=>getCatColor(l))
        }]
      },
      options:{
        plugins:{ legend:{ labels:{ color:"#eaf1ff" }}}},
        scales:{
          r:{
            grid:{ color:"#ffffff30" },
            pointLabels:{ color:"#eaf1ff" },
            ticks:{ color:"#eaf1ff" }
          }
        }
    })
  }

  function getCatColor(name){
    const cat = getCategoryList().find(c=>c.name===name)
    return cat ? cat.color : "#8a7dff"
  }

  onAuthStateChanged(auth, ()=>{})
}