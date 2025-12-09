import { onTransactions, settings, getCategoryList, formatMoney } from "./common.js"

const panel = document.getElementById("advicePanel")
const listEl = document.getElementById("adviceList")
let lastTx = []
let budgetsCache = window.budgets || []

onTransactions(arr => { lastTx = arr.slice(); renderAdvice() })
if (window.onBudgets) window.onBudgets(b => { budgetsCache = b; renderAdvice() })

const rand = arr => arr[Math.floor(Math.random() * arr.length)]
const chance = p => Math.random() < p
const sum = (arr, fn) => arr.reduce((s, x) => s + (fn ? fn(x) : x), 0)

const today = new Date()
const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
const dayOfMonth = today.getDate()

const E_ALERT = ["⚠️","🚨","😬","🤔","🛑","🥵","❗","‼️","💣","🔥","😱","😡"]
const E_SAVE  = ["💡","✨","🧠","✅","🪙","📌","🔖","🧭","🧩","🔧","🧱","📈"]
const E_FUN   = ["😅","🤖","🧋","🍕","☕","🦄","🐙","😎","🧊","🍩","🎮","🎧"]
const E_GOOD  = ["👏","🌟","🚀","🟢","💎","🥳","👌","🎉","🪴","🛡️","💯","🔥"]

const catAlt = {
  "Ēdiens": [
    "Plāno maltītes, ņem līdzi pusdienas, atlaižu appi ir draugi.",
    "Aizvieto 2 ārpus-mājas ēdienreizes nedēļā ar mājas gatavošanu.",
    "Pērc pamata produktus lielākos iepakojumos, pārbaudi akcijas."
  ],
  "Transports": [
    "Dažas dienas sabiedriskais vai velo; takši tikai, kad tiešām vajag.",
    "Apvieno braucienus, optimizē maršrutu; mēnešbiļete bieži izdevīgāka.",
    "Kājām īsie gabali; degvielas cena nav draugs."
  ],
  "Izklaide": [
    "Ievies “0 tēriņu” nedēļu. Bez maksas pasākumi ir visur.",
    "Dalies abonementos ar ģimeni (ja atļauts), atcel tos, kurus nelieto.",
    "Bibliotēka/YouTube var aizvietot dārgas platformas."
  ],
  "Mājoklis": [
    "Pārbaudi komunālo tarifu plānus, fiksētās likmes.",
    "Atvieno tehniku no rozetes, samazini standby patēriņu.",
    "Termostata -1°C dod ~5–7% ietaupījumu."
  ],
  "Cits": [
    "24h gaidīšanas noteikums pirms pirkuma.",
    "Salīdzini cenas, kuponi ir spēka gājiens.",
    "Atliec pirkumu par nedēļu; ja vēl vajag, tad pērc."
  ]
}

function fmt(n){ try { return formatMoney(n) } catch(_) { return (Number(n)||0).toFixed(2) + " €" } }
function savingRate(income, expense){ return income > 0 ? (income - expense) / income : null }
function topCategories(arr, type="expense", limit=3){
  const m={}
  arr.filter(t=>t.type===type).forEach(t=>{
    const c=t.category||"Cits"
    m[c]=(m[c]||0)+Number(t.amount||0)
  })
  return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,limit)
}
function detectSubs(arr){
  const keys=["abon","subscription","netflix","spotify","prime","hbo","icloud","google","disney","xbox","ps","playstation","telefons","internet","phone","cloud","vpn","patreon","onlyfans","tinder","deezer","youtube","audible","apple","microsoft"]
  const res=[]
  const byKey={}
  arr.forEach(t=>{
    const key=((t.category||"")+":"+(t.notes||"").toLowerCase())
    byKey[key]=byKey[key]||[]
    byKey[key].push(t)
  })
  Object.entries(byKey).forEach(([k,items])=>{
    const text=k.toLowerCase()
    if (!keys.some(x=>text.includes(x))) return
    const avg = sum(items,i=>Number(i.amount||0))/items.length
    res.push({ name: deriveName(items[0]), avg, count: items.length })
  })
  return res.slice(0,5)
}
function deriveName(t){
  const n=(t.notes||"").trim()
  if (n) return n.length>42? n.slice(0,42)+"…" : n
  return t.category||"Abonements"
}
function projection(income, expense){
  const perDayInc = income>0 ? income/dayOfMonth : 0
  const perDayExp = expense>0 ? expense/dayOfMonth : 0
  const projInc = perDayInc * daysInMonth
  const projExp = perDayExp * daysInMonth
  return { projInc, projExp }
}
function paceLine(sumVal, label, em){
  if (sumVal<=0) return null
  const perDay = sumVal / Math.max(1, dayOfMonth)
  const projected = perDay * daysInMonth
  const variants = [
    `${em} ${label}: ${fmt(sumVal)}. Vidēji dienā ~${fmt(perDay.toFixed(2))}, projekcija ~${fmt(projected.toFixed(0))}.`,
    `${em} ${label} temps: ${fmt(sumVal)} līdz šodienai; ja turpini, ~${fmt(projected.toFixed(0))} mēneša beigās.`,
    `${em} ${label}: ${fmt(sumVal)}. Ja gribi iekļauties mērķī, samazini dienas tēriņus par 5–10%.`
  ]
  return rand(variants)
}
function crazyEarly(cat, cur) {
  const e = rand(E_ALERT)
  return `${e} Jau šobrīd tēriņi kategorijā ${cat}: ${fmt(cur)}. Apsver samazināt tempu, lai mēneša beigās nav pārsteigumu.`
}

const overspendPool = []
for (let i=0;i<200;i++) overspendPool.push(`${rand(E_ALERT)} {cat} šomēnes {cur} pret vidējo {avg}. Samazini tempu.`)
for (let i=0;i<200;i++) overspendPool.push(`${rand(E_ALERT)} {cat}: {cur} jau pārsniedz parasto {avg}. Uzliec griestus.`)
for (let i=0;i<200;i++) overspendPool.push(`${rand(E_ALERT)} {cat} ir lielāks nekā parasti ({cur} > {avg}). Apsver -10% šonedēļ.`)

const cheapPool = []
for (let i=0;i<180;i++) cheapPool.push(`${rand(E_SAVE)} {cat}: {tip}`)
for (let i=0;i<180;i++) cheapPool.push(`${rand(E_SAVE)} Padoms {cat}: {tip}`)
for (let i=0;i<180;i++) cheapPool.push(`${rand(E_SAVE)} Paskaties uz {cat} — {tip}`)

const subsPool = []
for (let i=0;i<160;i++) subsPool.push(`🔔 “{name}” ~{amt}/mēn, {count} maksājumi. Vai izmanto pietiekami?`)
for (let i=0;i<160;i++) subsPool.push(`🔔 Abonements: {name}, ~{amt}/mēn. Pārskati, vai var samazināt vai atcelt.`)
for (let i=0;i<160;i++) subsPool.push(`🔔 {name}: {amt}/mēn. Samazini plānu vai pauzē uz mēnesi.`)

const savingHighPool = []
for (let i=0;i<120;i++) savingHighPool.push(`${rand(E_GOOD)} Uzkrājuma likme {rate}%. Lieliski! Turpini.`)
for (let i=0;i<120;i++) savingHighPool.push(`${rand(E_GOOD)} Pozitīvs temps: {rate}% un plusā {save}.`)
for (let i=0;i<120;i++) savingHighPool.push(`${rand(E_GOOD)} {rate}% uzkrājumi. Apsver automatizētu investēšanu.`)

const savingMidPool = []
for (let i=0;i<120;i++) savingMidPool.push(`${rand(E_SAVE)} Uzkrājuma likme {rate}%. Mērķē ≥15–20%.`)
for (let i=0;i<120;i++) savingMidPool.push(`${rand(E_SAVE)} {rate}% uzkrājumi. Pacel latiņu par +5% nākamajā mēnesī.`)

const savingNegPool = []
for (let i=0;i<120;i++) savingNegPool.push(`${rand(E_ALERT)} Izdevumi > ienākumi par {save}. Pārskati lielos fiksētos tēriņus.`)
for (let i=0;i<120;i++) savingNegPool.push(`${rand(E_ALERT)} Negatīva bilance: {save}. Uzliec nedēļas griestus un seko tiem.`)

const incExpPool = []
for (let i=0;i<120;i++) incExpPool.push(`⚖️ Ienākumi {inc}, izdevumi {exp}, bilance {bal}.`)
for (let i=0;i<120;i++) incExpPool.push(`📊 Ienākumi: {inc}. Izdevumi: {exp}. Atlikums: {bal}.`)
for (let i=0;i<120;i++) incExpPool.push(`📈/📉 Ienākumi {inc}, izdevumi {exp}. Rezultāts: {bal}.`)

const projPool = []
for (let i=0;i<160;i++) projPool.push(`📅 Projekcija: ienākumi ~{pinc}, izdevumi ~{pexp}. Ja gribi plusā, samazini dienas tēriņus.`)
for (let i=0;i<160;i++) projPool.push(`📅 Ja temps turpinās: ienākumi ~{pinc}, izdevumi ~{pexp}. Vari koriģēt šo nedēļu.`)
for (let i=0;i<160;i++) projPool.push(`📅 Prognoze: {pinc} ienākumi, {pexp} izdevumi. Pārbaudi lielās kategorijas.`)

const funPool = []
for (let i=0;i<200;i++) funPool.push(`☕ 1 kafija mazāk dienā ~30 € mēnesī.`)
for (let i=0;i<200;i++) funPool.push(`🍕 2 mazāk ātrā ēdiena reizes = ~40–60 € / mēn.`)
for (let i=0;i<200;i++) funPool.push(`🚕 1–2 takši mazāk = 20–30 € / mēn.`)
for (let i=0;i<200;i++) funPool.push(`🧊 “Bez tēriņu” diena: labs izaicinājums.`)
for (let i=0;i<200;i++) funPool.push(`🧠 24h noteikums pirms lieliem pirkumiem.`)
for (let i=0;i<200;i++) funPool.push(`🧩 Mikromērķis: -5% šonedēļ vienā kategorijā.`)
for (let i=0;i<200;i++) funPool.push(`🪙 Vispirms samaksā sev: 10% uzreiz pēc ienākumiem.`)

const chartPool = []
for (let i=0;i<120;i++) chartPool.push(`📈 Ieslēdz “Grafiki”, lai redzētu kategorijas un dienas tendences.`)
for (let i=0;i<120;i++) chartPool.push(`📊 Grafiki ieslēgti? Paskaties dienas līniju un kumulatīvo salīdzinājumu.`)

const exportPool = []
for (let i=0;i<120;i++) exportPool.push(`💾 Eksports: lejupielādē CSV/JSON pirms lielas tīrīšanas.`)
for (let i=0;i<120;i++) exportPool.push(`📥 Saglabā datus (CSV/JSON), ja plāno dzēst vai sākt jaunu mēnesi.`)

const purgeOnPool = []
for (let i=0;i<120;i++) purgeOnPool.push(`🗑️ Auto-dzēšana ieslēgta. Pārliecinies, ka eksportēji, ja vēlies vēsturi.`)
for (let i=0;i<120;i++) purgeOnPool.push(`🧹 Automātiskā dzēšana strādās mēneša ritmā; eksports pirms tam.`)

const purgeOffPool = []
for (let i=0;i<120;i++) purgeOffPool.push(`🗑️ Ja gribi tīru lapu, ieslēdz auto-dzēšanu iestatījumos.`)
for (let i=0;i<120;i++) purgeOffPool.push(`🧹 Manuālā dzēšana? Vispirms eksports, tad tīri.`)

const lowGfxPool = []
for (let i=0;i<120;i++) lowGfxPool.push(`🌿 Low graphics ieslēgts. Ja gribi vizuāli bagātāk, izslēdz to.`)
for (let i=0;i<120;i++) lowGfxPool.push(`🌿 Zema grafika = ātrāk, bet mazāk spīdumu.`)

const humorPool = []
for (let i=0;i<180;i++) humorPool.push(`🤖 Es neredzu kafiju, bet redzu budžetu. Piezīmes palīdz saprast paradumus.`)
for (let i=0;i<180;i++) humorPool.push(`😅 24h noteikums pirms lieliem pirkumiem — maciņš pateiks paldies.`)
for (let i=0;i<180;i++) humorPool.push(`🦄 Pamēģini vienu “bez tēriņu” dienu; paskaties, kā jūtas maciņš.`)
for (let i=0;i<180;i++) humorPool.push(`🧊 Ja grafiki nepatīk, pārbaudi, vai tie ir ieslēgti, nevis mani lamā.`)

const chatterPool = []
for (let i=0;i<200;i++) chatterPool.push(`🙌 Jo vairāk ierakstu, jo precīzāki ieteikumi.`)
for (let i=0;i<200;i++) chatterPool.push(`👀 Pārskati lielās kategorijas reizi nedēļā, lai nepiepūšas.`)
for (let i=0;i<200;i++) chatterPool.push(`😎 Krāso kategorijas — pārskatam būs daudz skaidrāks izskats.`)
for (let i=0;i<200;i++) chatterPool.push(`📆 Piezīme pie transakcijas šodien = skaidrība pēc mēneša.`)
for (let i=0;i<200;i++) chatterPool.push(`🧾 Neliels ieradums: pieraksti uzreiz pēc pirkuma.`)

const fillerPool = []
for (let i=0;i<240;i++) fillerPool.push(`🧠 Mikromērķis nedēļai: -5% vienā izvēlētā kategorijā.`)
for (let i=0;i<240;i++) fillerPool.push(`🪙 “Vispirms samaksā sev” — 10% uzkrājumos, tiklīdz ienāk.`)
for (let i=0;i<240;i++) fillerPool.push(`📌 Atceries pievienot datumu un piezīmi — nākotnē tas palīdz.`)
for (let i=0;i<240;i++) fillerPool.push(`🚀 Pieraksti arī sīkās summas, tās kopā veido bildi.`)
for (let i=0;i<240;i++) fillerPool.push(`🛠️ Regulāri pārskati abonementus — vismaz vienu mēnesī atcel, ja nelieto.`)

function renderAdvice(){
  if (!panel || !listEl) return
  if (!lastTx.length){ panel.style.display="none"; return }
  panel.style.display="block"

  const adv = []
  const now = Date.now()
  const d30 = 1000 * 60 * 60 * 24 * 30
  const recent = lastTx.filter(t => new Date(t.date).getTime() > now - d30)

  const income30 = sum(recent.filter(t=>t.type==="income"), t=>Number(t.amount||0))
  const expense30 = sum(recent.filter(t=>t.type==="expense"), t=>Number(t.amount||0))
  const rate = savingRate(income30, expense30)
  const saving = income30 - expense30

  const paceExp = paceLine(expense30, "Izdevumi", rand(E_SAVE))
  const paceInc = income30>0 ? paceLine(income30, "Ienākumi", rand(E_GOOD)) : null
  if (paceExp) adv.push(paceExp)
  if (paceInc && chance(0.5)) adv.push(paceInc)

  topCategories(recent,"expense",3).forEach(([cat,val])=>{
    if (val >= 200 && chance(0.65)) adv.push(crazyEarly(cat, val))
    if (chance(0.55)) {
      const tip = rand(catAlt[cat] || catAlt["Cits"])
      adv.push(fill(cheapPool, {cat, tip}))
    }
  })

  budgetsCache.forEach(b=>{
    const spent = sum(lastTx.filter(t=>t.type==="expense" && t.category===b.category), t=>Number(t.amount||0))
    if (spent > b.limit*1.05) adv.push(fill(overspendPool, {cat:b.category, cur:fmt(spent), avg:fmt(b.limit)}))
    else if (spent > b.limit*0.9 && chance(0.6)) adv.push(`⏳ Tuvojas limits ${b.category}: ${fmt(spent)} / ${fmt(b.limit)}.`)
  })

  detectSubs(lastTx).forEach(s=> adv.push(fill(subsPool, {name:s.name, amt:fmt(s.avg), count:s.count})))

  if (rate !== null){
    if (rate < 0) adv.push(fill(savingNegPool, {save:fmt(-saving)}))
    else if (rate < 0.1) adv.push(fill(savingMidPool, {rate:(rate*100).toFixed(1)}))
    else adv.push(fill(savingHighPool, {rate:(rate*100).toFixed(1), save:fmt(saving)}))
  }

  const incExpLine = fill(incExpPool, {inc:fmt(income30), exp:fmt(expense30), bal:fmt(saving)})
  adv.push(incExpLine)

  const { projInc, projExp } = projection(income30, expense30)
  if (chance(0.7)) adv.push(fill(projPool, {pinc:fmt(projInc.toFixed(0)), pexp:fmt(projExp.toFixed(0))}))

  if (chance(0.6)) adv.push(rand(funPool))
  if (chance(0.6)) adv.push(rand(chatterPool))
  if (chance(0.6)) adv.push(rand(humorPool))
  if (chance(0.5)) adv.push(rand(exportPool))
  if (chance(0.5)) adv.push(settings.autoPurge && settings.autoPurge.enabled ? rand(purgeOnPool) : rand(purgeOffPool))
  const lg = lowGfxReminder(); if (lg && chance(0.4)) adv.push(lg)
  if (chance(0.6)) adv.push(rand(chartPool))
  if (chance(0.6)) adv.push(rand(fillerPool))

  const cats = getCategoryList()
  if (cats.length && chance(0.5)) {
    const pick = rand(cats)
    adv.push(`🎨 Kategoriju krāsas vari mainīt iestatījumos; ${pick.name} pašlaik ir ${pick.color}.`)
  }

  const seen = new Set()
  const finalTips = []
  for (const a of adv){
    if (!a) continue
    if (seen.has(a)) continue
    seen.add(a)
    finalTips.push(a)
    if (finalTips.length >= 5) break
  }
  if (!finalTips.length) finalTips.push(`${rand(E_GOOD)} Nav brīdinājumu — turpini šajā tempā!`)

  listEl.innerHTML = `<ul class="advice-ul">${finalTips.map(x=>`<li class="advice-li">${x}</li>`).join("")}</ul>`
}

function fill(pool, map){
  const tpl = rand(pool)
  return tpl.replace(/\{(\w+)\}/g, (_,k)=> map[k]!==undefined ? map[k] : "")
}
function lowGfxReminder(){
  if (document.documentElement.classList.contains("low-graphics")){
    return rand(lowGfxPool)
  }
  return null
}

const style = document.createElement("style")
style.textContent = `
#advicePanel { padding:16px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); }
#adviceList .advice-ul { list-style:none; padding-left:0; margin:0; display:grid; gap:8px; }
#adviceList .advice-li { padding:10px 12px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.06); font-size:13px; line-height:1.4; }
`
document.head.appendChild(style)