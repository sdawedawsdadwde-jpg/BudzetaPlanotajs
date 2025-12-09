import { onTransactions, formatMoney, groupByMonth, monthOrder, monthName, getCategoryList, settings, onSettings } from "./common.js"

let transactionsLoaded = false
let settingsLoaded = false
let allTx = []

let barChart = null
let lineChart = null
let heatmapChart = null

const monthBarCanvas = document.getElementById("monthBar")
const balanceLineCanvas = document.getElementById("balanceLine")
const heatmapCanvas = document.getElementById("heatmap")
const summaryEl = document.getElementById("summary")

const stateMonthBar = document.getElementById("stateMonthBar")
const stateBalanceLine = document.getElementById("stateBalanceLine")
const stateHeatmap = document.getElementById("stateHeatmap")
const stateSummary = document.getElementById("stateSummary")

const disabledMonthBar = document.getElementById("disabledMonthBar")
const disabledBalanceLine = document.getElementById("disabledBalanceLine")
const disabledHeatmap = document.getElementById("disabledHeatmap")
const disabledSummary = document.getElementById("disabledSummary")

onTransactions(arr=>{
  allTx = arr.slice().sort((a,b)=> a.date.localeCompare(b.date))
  transactionsLoaded = true
  attemptRender()
})

onSettings(()=>{
  settingsLoaded = true
  attemptRender()
})

function attemptRender(){
  if (!settingsLoaded || !transactionsLoaded){
    setLoadingAll()
    return
  }
  if (!window.Chart){
    setErrorAll("Chart.js nav ielādēts")
    retryUntilChartLoaded()
    return
  }
  render()
}

let chartRetryCount = 0
function retryUntilChartLoaded(){
  if (window.Chart){ attemptRender(); return }
  chartRetryCount++
  if (chartRetryCount > 15){
    setErrorAll("Neizdevās ielādēt Chart.js")
    return
  }
  setTimeout(retryUntilChartLoaded,300)
}

function setLoadingAll(){
  stateMonthBar.textContent="Ielādē..."
  stateBalanceLine.textContent="Ielādē..."
  stateHeatmap.textContent="Ielādē..."
  stateSummary.textContent="Ielādē..."
  hideDisabled()
  hideCanvases()
}

function setErrorAll(msg){
  stateMonthBar.textContent=msg
  stateBalanceLine.textContent=msg
  stateHeatmap.textContent=msg
  stateSummary.textContent=msg
  hideDisabled()
  hideCanvases()
}

function hideDisabled(){
  disabledMonthBar.style.display="none"
  disabledBalanceLine.style.display="none"
  disabledHeatmap.style.display="none"
  disabledSummary.style.display="none"
}

function showDisabled(){
  disabledMonthBar.style.display="flex"
  disabledBalanceLine.style.display="flex"
  disabledHeatmap.style.display="flex"
  disabledSummary.style.display="flex"
  monthBarCanvas.style.display="none"
  balanceLineCanvas.style.display="none"
  heatmapCanvas.style.display="none"
  stateMonthBar.textContent=""
  stateBalanceLine.textContent=""
  stateHeatmap.textContent=""
  stateSummary.textContent=""
  summaryEl.innerHTML=""
}

function hideCanvases(){
  monthBarCanvas.style.display="none"
  balanceLineCanvas.style.display="none"
  heatmapCanvas.style.display="none"
}

function clearCharts(){
  if (barChart){ barChart.destroy(); barChart=null }
  if (lineChart){ lineChart.destroy(); lineChart=null }
  if (heatmapChart){ heatmapChart.destroy(); heatmapChart=null }
}

function render(){
  const adv = !!settings.advancedCharts
  if (!adv){
    clearCharts()
    showDisabled()
    return
  }
  hideDisabled()
  buildCharts()
  buildSummary()
}

function buildCharts(){
  const hasData = allTx.length > 0
  if (!hasData){
    clearCharts()
    buildEmptyBar()
    buildEmptyLine()
    buildEmptyHeat()
    return
  }

  const monthMap = groupByMonth(allTx)
  const months = Object.keys(monthMap).sort(monthOrder)
  if (!months.length){
    clearCharts()
    buildEmptyBar()
    buildEmptyLine()
    buildEmptyHeat()
    return
  }

  const incomeData = months.map(m=> monthMap[m].filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0))
  const expenseData = months.map(m=> monthMap[m].filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0))
  const balanceData = []
  let running=0
  for (let i=0;i<months.length;i++){
    running += incomeData[i] - expenseData[i]
    balanceData.push(running)
  }

  clearCharts()

  // Bar
  monthBarCanvas.style.display="block"
  stateMonthBar.textContent=""
  barChart = new Chart(monthBarCanvas,{
    type:"bar",
    data:{
      labels:months.map(monthName),
      datasets:[
        { label:"Ienākumi", data:incomeData, backgroundColor:"#00d68f", borderRadius:6 },
        { label:"Izdevumi", data:expenseData, backgroundColor:"#ff5470", borderRadius:6 }
      ]
    },
    options:{
      scales:{ x:{ ticks:{ color:"#eaf1ff" } }, y:{ beginAtZero:true, ticks:{ color:"#eaf1ff" } } },
      plugins:{ legend:{ labels:{ color:"#eaf1ff" } } }
    }
  })

  // Line
  balanceLineCanvas.style.display="block"
  stateBalanceLine.textContent=""
  lineChart = new Chart(balanceLineCanvas,{
    type:"line",
    data:{
      labels:months.map(monthName),
      datasets:[{
        label:"Kumulatīvā Bilance",
        data:balanceData,
        borderColor:"#8a7dff",
        backgroundColor:"#8a7dff",
        fill:false,
        tension:.25,
        pointRadius:5
      }]
    },
    options:{
      scales:{ x:{ ticks:{ color:"#eaf1ff" } }, y:{ ticks:{ color:"#eaf1ff" } } },
      plugins:{ legend:{ labels:{ color:"#eaf1ff" } } }
    }
  })

  // Heatmap
  const dayMap={}
  allTx.filter(t=>t.type==="expense").forEach(t=>{
    if (t.date) dayMap[t.date]=(dayMap[t.date]||0)+t.amount
  })
  const sortedDays=Object.keys(dayMap).sort()
  const values=sortedDays.map(d=>dayMap[d])
  const colors=values.map(v=> heatColor(v,values))

  heatmapCanvas.style.display="block"
  stateHeatmap.textContent=""
  heatmapChart=new Chart(heatmapCanvas,{
    type:"bar",
    data:{ labels:sortedDays, datasets:[{ label:"Dienas izdevumi", data:values, backgroundColor:colors }] },
    options:{
      scales:{ x:{ ticks:{ color:"#eaf1ff", maxRotation:60, minRotation:30 } }, y:{ beginAtZero:true, ticks:{ color:"#eaf1ff" } } },
      plugins:{ legend:{ labels:{ color:"#eaf1ff" } } }
    }
  })
}

function buildEmptyBar(){
  monthBarCanvas.style.display="block"
  stateMonthBar.textContent="Nav datu"
  new Chart(monthBarCanvas,{
    type:"bar",
    data:{
      labels:["—"],
      datasets:[
        { label:"Ienākumi", data:[0], backgroundColor:"#00d68f", borderRadius:6 },
        { label:"Izdevumi", data:[0], backgroundColor:"#ff5470", borderRadius:6 }
      ]
    },
    options:{
      scales:{ x:{ ticks:{ color:"#eaf1ff" } }, y:{ beginAtZero:true, ticks:{ color:"#eaf1ff" } } },
      plugins:{ legend:{ labels:{ color:"#eaf1ff" } } }
    }
  })
}

function buildEmptyLine(){
  balanceLineCanvas.style.display="block"
  stateBalanceLine.textContent="Nav datu"
  new Chart(balanceLineCanvas,{
    type:"line",
    data:{
      labels:["—"],
      datasets:[{
        label:"Kumulatīvā Bilance",
        data:[0],
        borderColor:"#8a7dff",
        backgroundColor:"#8a7dff",
        tension:.25,
        pointRadius:5,
        fill:false
      }]
    },
    options:{
      scales:{ x:{ ticks:{ color:"#eaf1ff" } }, y:{ ticks:{ color:"#eaf1ff" } } },
      plugins:{ legend:{ labels:{ color:"#eaf1ff" } } }
    }
  })
}

function buildEmptyHeat(){
  heatmapCanvas.style.display="block"
  stateHeatmap.textContent="Nav datu"
  new Chart(heatmapCanvas,{
    type:"bar",
    data:{ labels:["—"], datasets:[{ label:"Dienas izdevumi", data:[0], backgroundColor:["#333"] }] },
    options:{
      scales:{ x:{ ticks:{ color:"#eaf1ff" } }, y:{ beginAtZero:true, ticks:{ color:"#eaf1ff" } } },
      plugins:{ legend:{ labels:{ color:"#eaf1ff" } } }
    }
  })
}

function buildSummary(){
  summaryEl.innerHTML=""
  if (!allTx.length){
    stateSummary.textContent="Nav datu"
    return
  }
  stateSummary.textContent=""
  const cats={}
  allTx.filter(t=>t.type==="expense").forEach(t=>{
    if (t.category) cats[t.category]=(cats[t.category]||0)+t.amount
  })
  const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1])
  if (!sorted.length){
    stateSummary.textContent="Nav izdevumu"
    return
  }
  sorted.forEach(([cat,sum])=>{
    const color=(getCategoryList().find(c=>c.name===cat)||{}).color || "#8a7dff"
    const div=document.createElement("div")
    div.className="goal"
    div.innerHTML=`<h4 style="color:${color}">${cat}</h4><div class="muted small">Izdevumi: ${formatMoney(sum)}</div>`
    summaryEl.appendChild(div)
  })
}

function heatColor(v,all){
  if (!all||!all.length) return "#222"
  const max=Math.max(...all)||1
  const pct=(v||0)/max
  const r=Math.round(255*pct)
  const g=Math.round(120*(1-pct))
  const b=Math.round(180*(1-pct))
  return `rgba(${r},${g},${b},0.8)`
}