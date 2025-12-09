(() => {
  // game2_Version10.js — full updated script (fixed chipIdCounter TDZ)
  // Locale: Latvian UI strings embedded in code.

  // --- Config & data ---
  const MONTHS_GOAL_DEFAULT = 12;
  const BASE_MONTHLY_INCOME = 2000;
  const START_WALLET = 0;
  const TRIP_GOAL = 7000;

  const categories = [
    { id: 'rent', name: 'Noma / Hipotēka' },
    { id: 'food', name: 'Pārtika' },
    { id: 'utilities', name: 'Rēķini' },
    { id: 'transport', name: 'Transports' },
    { id: 'entertain', name: 'Izklaide' },
    { id: 'savings', name: 'Uzkrājumi' },
    { id: 'invest', name: 'Investīcijas' },
    { id: 'loan', name: 'Kredīts' }
  ];

  const eventsBase = [
    { title: "Dzimšanas diena", desc: "Saņem dāvanu vai rīko ballīti.", cost: 200, chance: 0.06, happiness: 0.06 },
    { title: "Drauga dzimšanas diena", desc: "Jāiegādājas dāvana.", cost: -100, chance: 0.08, happiness: 0.04 },
    { title: "Auto remonts", desc: "Neplānota auto remonta rēķins.", cost: -450, chance: 0.08, happiness: -0.05 },
    { title: "Medicīnas izdevumi", desc: "Neliels medicīnas izdevums.", cost: -300, chance: 0.06, happiness: -0.06 },
    { title: "Nodokļu atmaks", desc: "Saņem nodokļu atmaksu.", cost: 300, chance: 0.05, happiness: 0.03 },
    { title: "Iekārtas nomaiņa", desc: "Veļas mašīna jāmaina.", cost: -350, chance: 0.04, happiness: -0.04 },
    { title: "Freelance darbs", desc: "Papildu ienākumi šomēnes.", cost: 150, chance: 0.05, happiness: 0.02 }
  ];

  const initialBankAmounts = [10,25,50,100,200,500,1000,2000,5000];

  const investProducts = [
    { type: 'stocks', label: 'Akcijas', desc: 'Vidēji risks, potenciāls augsts atdeve.' },
    { type: 'bonds', label: 'Obligācijas', desc: 'Zemāks risks, stabila atdeve.' },
    { type: 'startup', label: 'Startaps', desc: 'Ļoti riskants, iespējam liels ieguvums vai zaudējums.' }
  ];

  // --- State ---
  let month = 1;
  let monthsGoal = MONTHS_GOAL_DEFAULT;
  let baseMonthlyIncome = BASE_MONTHLY_INCOME;
  let monthlyIncome = baseMonthlyIncome;
  let wallet = START_WALLET;
  let savingsReserve = 0;
  const allocations = {}; // allocations[catId] = [{id,amount,investType?,mandatory?}, ...]
  let investmentsPlaced = []; // {id,amount,type,openedMonth}
  let log = [];
  let events = JSON.parse(JSON.stringify(eventsBase));
  let monthlyMinimums = {};
  let happiness = 0.5;
  let nextMonthBonus = 0;
  let loan = null; // { original, outstanding, termMonths, startMonth, missedCount, pendingCredit }

  // --- fix: declare chipIdCounter BEFORE initAllocations is invoked to avoid TDZ ---
  let chipIdCounter = 1;

  // --- focus helper for modal (fix aria-hidden-on-focused-element) ---
  let lastFocusedBeforeModal = null;

  // --- DOM refs ---
  const incomeDisplay = document.getElementById('incomeDisplay');
  const monthDisplay = document.getElementById('month');
  const monthsGoalElem = document.getElementById('monthsGoal');
  const walletDisplay = document.getElementById('walletDisplay');
  const savingsDisplay = document.getElementById('savingsDisplay');
  const allocatedDisplay = document.getElementById('allocatedDisplay');
  const remainingDisplay = document.getElementById('remainingDisplay');
  const happinessBar = document.getElementById('happinessBar');
  const happinessPct = document.getElementById('happinessPct');
  const chipsDiv = document.getElementById('chips');
  const investOptionsDiv = document.getElementById('investOptions');
  const categoriesDiv = document.getElementById('categories');
  const nextMonthBtn = document.getElementById('nextMonth');
  const logDiv = document.getElementById('log');
  const eventText = document.getElementById('eventText');
  const message = document.getElementById('message');
  const addChipBtn = document.getElementById('addChip');
  const customAmountInput = document.getElementById('customAmount');
  const autoAllocBtn = document.getElementById('autoAlloc');
  const resetAllBtn = document.getElementById('resetAll');
  const downloadStateBtn = document.getElementById('downloadState');
  const confettiCanvas = document.getElementById('confetti');
  const difficultySelect = document.getElementById('difficulty');
  const startChallengeBtn = document.getElementById('startChallenge');
  const challengeInfo = document.getElementById('challengeInfo');
  const goalAmountElem = document.getElementById('goalAmount');
  const goalProgressValue = document.getElementById('goalProgressValue');
  const nextBonusDisplay = document.getElementById('nextBonusDisplay');

  const loanAmountInput = document.getElementById('loanAmount');
  const takeLoanBtn = document.getElementById('takeLoanBtn');
  const loanOutstandingEl = document.getElementById('loanOutstanding');
  const loanRequiredEl = document.getElementById('loanRequired');
  const loanMissedEl = document.getElementById('loanMissed');
  const loanRemainingEl = document.getElementById('loanRemaining'); // new UI element in HTML

  // modal elements
  const investModal = document.getElementById('investModal');
  const investModalTitle = document.getElementById('investModalTitle');
  const investTypeRow = document.getElementById('investTypeRow');
  const investTypeSelect = document.getElementById('investTypeSelect');
  const investAmountInput = document.getElementById('investAmountInput');
  const investConfirm = document.getElementById('investConfirm');
  const investCancel = document.getElementById('investCancel');

  goalAmountElem.textContent = fmt(TRIP_GOAL);

  // ensure investModal inert initial state if attribute exists (defensive)
  try { if (investModal) investModal.inert = investModal.classList.contains('hidden'); } catch(e){ /* inert not supported */ }

  // --- init ---
  initAllocations();
  buildBank();
  buildInvestOptions();
  buildCategories();
  applyDifficulty('normal');
  updateMonthlyMinimums();
  updateUI();
  pushLog("Spēle sākta", `Mērķis: uzkrāt ${fmt(TRIP_GOAL)}.`);

  // --- helpers ---
  function uid(){ return 'c' + (chipIdCounter++); }
  function fmt(n){ return '€' + Number(n).toLocaleString(); }
  function clamp(v,a=0,b=1){ return Math.max(a, Math.min(b, v)); }

  // --- allocations init ---
  function initAllocations(){
    categories.forEach(c => allocations[c.id] = []);
    month = 1;
    monthsGoal = MONTHS_GOAL_DEFAULT;
    baseMonthlyIncome = BASE_MONTHLY_INCOME;
    monthlyIncome = baseMonthlyIncome;
    wallet = START_WALLET;
    savingsReserve = 0;
    investmentsPlaced = [];
    log = [];
    events = JSON.parse(JSON.stringify(eventsBase));
    happiness = 0.5;
    nextMonthBonus = 0;
    loan = null;
    // reset counter for reproducible chip ids on new game
    chipIdCounter = 1;
  }

  // --- build bank ---
  function buildBank(){
    chipsDiv.innerHTML = '';
    initialBankAmounts.forEach(a => chipsDiv.appendChild(createBankChip(a, 'cash')));
  }
  function createBankChip(amount, kind='cash'){
    const el = document.createElement('div');
    el.className = 'chip' + (kind === 'invest' ? ' invest' : '');
    el.draggable = true;
    el.tabIndex = 0;
    el.textContent = (kind === 'invest') ? `${amount}` : (typeof amount === 'number' ? fmt(amount) : String(amount));
    el.dataset.amount = amount;
    el.dataset.kind = kind;
    el.addEventListener('dragstart', bankDragStart);
    el.addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ chipsDiv.appendChild(createBankChip(amount, kind)); }});
    return el;
  }

  // custom amount add
  addChipBtn.addEventListener('click', ()=>{
    const val = Number(customAmountInput.value);
    if (val && val > 0){
      chipsDiv.appendChild(createBankChip(Math.round(val), 'cash'));
      customAmountInput.value = '';
    } else {
      chipsDiv.appendChild(createBankChip(100, 'cash'));
    }
  });

  // --- take loan handler ---
  takeLoanBtn.addEventListener('click', ()=>{
    const val = Math.round(Number(loanAmountInput.value) || 0);
    if (!val || val <= 0){
      alert('Ievadi derīgu kredīta summu (>0).');
      return;
    }
    if (loan && loan.outstanding > 0){
      if (!confirm('Jau aktīvs kredīts. Paņemt jaunu kredītu pārrakstīs esošo?')) return;
    }
    const remaining = Math.max(1, monthsGoal - (month - 1)); // months left in challenge
    loan = {
      original: val,
      outstanding: val,
      termMonths: remaining,
      startMonth: month,
      missedCount: 0,
      pendingCredit: true
    };
    // compute required monthly payment so loan is repaid within remaining months
    const requiredNow = Math.min(loan.outstanding, Math.ceil(loan.outstanding / remaining));
    ensureLoanMandatoryAllocation(requiredNow);
    pushLog('Kredīts pieprasīts', `Kredīts ${fmt(val)} tiks pievienots kontam nākamajā mēnesī. Līdz pilnai atmaksai: ${remaining} mēneši. Minimālais šī mēneša maksājums: ${fmt(requiredNow)}.`, 'info');
    loanAmountInput.value = '';
    updateLoanUI();
    updateUI();
  });

  // --- invest UI builder ---
  function buildInvestOptions(){
    investOptionsDiv.innerHTML = '';
    investProducts.forEach(p => {
      const row = document.createElement('div');
      row.className = 'investOption';
      const btn = document.createElement('button');
      btn.textContent = `${p.label}`;
      btn.addEventListener('click', ()=> {
        const chip = createBankChip(p.type, 'invest');
        chip.textContent = p.label;
        chip.dataset.investType = p.type;
        chipsDiv.appendChild(chip);
      });
      const info = document.createElement('div');
      info.className = 'small muted';
      info.textContent = p.desc;
      row.appendChild(btn);
      row.appendChild(info);
      investOptionsDiv.appendChild(row);
    });
  }

  // --- placed chip element ---
  function createPlacedChip(amount, id, meta = {}){
    const el = document.createElement('div');
    el.className = 'chip' + (meta.investType ? ' invest' : '');
    if (meta.mandatory) el.classList.add('mandatory');
    el.textContent = (meta.label) ? `${meta.label} ${fmt(amount)}` : fmt(amount);
    el.dataset.amount = amount;
    el.dataset.id = id;
    if (meta.investType) el.dataset.investType = meta.investType;
    el.tabIndex = 0;
    el.draggable = true;
    if (!meta.mandatory){
      el.addEventListener('click', ()=>{
        const parentCat = el.closest('.category');
        if (!parentCat) return;
        const catId = parentCat.dataset.cat;
        removeChipFromCategory(catId, id);
      });
    } else {
      el.setAttribute('aria-disabled', 'true');
    }
    el.addEventListener('dragstart', placedDragStart);
    return el;
  }

  // --- build categories ---
  function buildCategories(){
    categoriesDiv.innerHTML = '';
    categories.forEach(c => {
      allocations[c.id] = allocations[c.id] || [];
      const box = document.createElement('div');
      box.className = 'category';
      box.dataset.cat = c.id;
      box.innerHTML = `<h4>${c.name} <span class="catBadge" id="badge-${c.id}"></span></h4>
        <div class="dropzone" data-cat="${c.id}"></div>
        <div>Piešķirts: <span class="catTotal" id="total-${c.id}">€0</span></div>`;
      categoriesDiv.appendChild(box);

      const dz = box.querySelector('.dropzone');
      dz.addEventListener('dragover', (ev)=> { ev.preventDefault(); dz.classList.add('dragover'); });
      dz.addEventListener('dragleave', ()=> { dz.classList.remove('dragover'); dz.classList.remove('forbidden'); });
      dz.addEventListener('drop', onDropToCategory);
    });
  }

  // --- drag handlers ---
  function bankDragStart(e){
    const amount = e.target.dataset.amount;
    const kind = e.target.dataset.kind || 'cash';
    const investType = e.target.dataset.investType || null;
    const payload = { type:'bank', amount: Number(amount), kind, investType };
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  }
  function placedDragStart(e){
    const el = e.target;
    const id = el.dataset.id;
    const amount = Number(el.dataset.amount);
    const parentCat = el.closest('.category');
    const from = parentCat ? parentCat.dataset.cat : null;
    const investType = el.dataset.investType || null;
    const payload = { type:'placed', id, amount, from, investType };
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  }

  // --- Invest modal flow ---
  let pendingInvestAction = null; // { kind, data, targetCat }

  function openInvestModal({ kind, data, targetCat }){
    lastFocusedBeforeModal = document.activeElement;
    pendingInvestAction = { kind, data, targetCat };

    if (kind === 'cash'){
      investModalTitle.textContent = 'Investēt - izvēlies tipu un summu';
      investTypeRow.style.display = 'block';
      investTypeSelect.innerHTML = '';
      investProducts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.type;
        opt.textContent = p.label;
        investTypeSelect.appendChild(opt);
      });
      investAmountInput.value = Math.round(data.amount || 100);
    } else {
      investModalTitle.textContent = `Investēt (${String(data.investType).toUpperCase()}) — ievadi summu`;
      investTypeRow.style.display = 'none';
      investAmountInput.value = Math.max(1, Math.round(data.amount || 100));
    }

    investModal.classList.remove('hidden');
    investModal.setAttribute('aria-hidden', 'false');
    try { investModal.inert = false; } catch(e){ /* inert unsupported */ }
    setTimeout(()=> investAmountInput.focus(), 10);
  }

  function closeInvestModal(){
    try {
      if (document.activeElement && investModal.contains(document.activeElement)){
        if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function'){
          lastFocusedBeforeModal.focus();
        } else {
          nextMonthBtn.focus();
        }
      }
    } catch(e){ /* ignore focus errors */ }

    investModal.classList.add('hidden');
    investModal.setAttribute('aria-hidden', 'true');
    try { investModal.inert = true; } catch(e){ /* inert unsupported */ }
    pendingInvestAction = null;
  }

  investCancel.addEventListener('click', ()=>{
    closeInvestModal();
  });

  investConfirm.addEventListener('click', ()=>{
    if (!pendingInvestAction) { closeInvestModal(); return; }
    const amount = Math.max(1, Math.round(Number(investAmountInput.value) || 0));
    if (amount <= 0) { alert('Ievadi summu (>0)'); return; }

    if (pendingInvestAction.kind === 'cash'){
      const type = investTypeSelect.value;
      const newId = uid();
      allocations['invest'].push({ id: newId, amount, investType: type });
      investmentsPlaced.push({ id: newId, amount, type, openedMonth: month });
      pushLog('Investēts', `Ieguldīji ${fmt(amount)} kā ${type.toUpperCase()}.`, 'success');
    } else if (pendingInvestAction.kind === 'invest'){
      const type = pendingInvestAction.data.investType;
      const newId = uid();
      allocations['invest'].push({ id: newId, amount, investType: type });
      investmentsPlaced.push({ id: newId, amount, type, openedMonth: month });
      pushLog('Investēts', `Ieguldīji ${fmt(amount)} kā ${type.toUpperCase()} (no invest-čipa).`, 'success');
    }

    refreshCategoryDOM('invest');
    updateUI();
    closeInvestModal();
  });

  // --- drop handler (enforces invest restrictions and uses modal) ---
  function onDropToCategory(ev){
    ev.preventDefault();
    const dz = ev.currentTarget;
    dz.classList.remove('dragover');
    const catId = dz.dataset.cat;
    let raw = ev.dataTransfer.getData('text/plain');
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch(e){ return; }

    // If dragging an invest-chip: only allow into invest
    if ((data.kind === 'invest' || data.investType) && catId !== 'invest'){
      pushLog('Neatļauts', 'Investīciju čipu drīkst novietot tikai kategorijā "Investīcijas".', 'error');
      dz.classList.add('forbidden');
      dz.classList.add('shake');
      setTimeout(()=>{ dz.classList.remove('shake'); dz.classList.remove('forbidden'); }, 450);
      return;
    }

    // bank cash -> invest: open modal to choose invest type & amount
    if (data.type === 'bank' && data.kind === 'cash' && catId === 'invest'){
      openInvestModal({ kind: 'cash', data, targetCat: catId });
      return;
    }

    // bank invest chip -> invest: open modal to set amount
    if (data.type === 'bank' && (data.kind === 'invest' || data.investType) && catId === 'invest'){
      const investType = data.investType || data.amount;
      openInvestModal({ kind: 'invest', data: { investType }, targetCat: catId });
      return;
    }

    // bank cash -> other categories: directly place chip
    if (data.type === 'bank' && data.kind === 'cash'){
      const newId = uid();
      const amount = Number(data.amount);
      allocations[catId].push({ id:newId, amount });
      refreshCategoryDOM(catId);
      updateUI();
      return;
    }

    // Moving placed items
    if (data.type === 'placed'){
      const id = data.id;
      const fromCat = data.from || findChipCategory(id);
      if (!fromCat) return;
      if (fromCat === catId) return;
      // If moving a placed invest item, prevent moving it outside invest
      if (data.investType && catId !== 'invest'){
        pushLog('Neatļauts', 'Investīcijas novietojamas tikai kategorijā "Investīcijas".', 'error');
        dz.classList.add('forbidden');
        setTimeout(()=>dz.classList.remove('forbidden'), 350);
        return;
      }
      const chipObj = removeChipFromCategory(fromCat, id, false);
      if (chipObj){
        allocations[catId].push(chipObj);
        if (catId === 'invest' && chipObj.investType){
          investmentsPlaced.push({ id: chipObj.id, amount: chipObj.amount, type: chipObj.investType, openedMonth: month });
        }
      }
      refreshCategoryDOM(fromCat);
      refreshCategoryDOM(catId);
      updateUI();
      return;
    }
  }

  function findChipCategory(id){
    for (const cid of Object.keys(allocations)){
      if (allocations[cid].some(ch => ch.id === id)) return cid;
    }
    return null;
  }

  function removeChipFromCategory(catId, id, removeDOM = true){
    const arr = allocations[catId];
    const idx = arr.findIndex(ch => ch.id === id);
    if (idx === -1) return null;
    const [removed] = arr.splice(idx,1);
    if (removeDOM) refreshCategoryDOM(catId);
    if (catId === 'invest'){
      investmentsPlaced = investmentsPlaced.filter(inv => inv.id !== id);
    }
    updateUI();
    return removed;
  }

  function refreshCategoryDOM(catId){
    const zone = document.querySelector(`.dropzone[data-cat="${catId}"]`);
    if (!zone) return;
    zone.innerHTML = '';
    allocations[catId].forEach(ch => {
      const meta = { investType: ch.investType, label: ch.investType ? ch.investType.toUpperCase() : undefined, mandatory: !!ch.mandatory };
      zone.appendChild(createPlacedChip(ch.amount, ch.id, meta));
    });
  }

  // --- remaining logic (loan, month handling, investments returns) ---
  function totalAllocated(){
    let sum = 0;
    Object.values(allocations).forEach(arr => arr.forEach(ch => sum += Number(ch.amount)));
    return sum;
  }
  function categoryTotal(catId){
    return allocations[catId].reduce((a,b) => a + Number(b.amount), 0);
  }

  function updateMonthlyMinimums(){
    const base = baseMonthlyIncome || BASE_MONTHLY_INCOME;
    monthlyMinimums.rent = Math.round(base * (0.30 + Math.random()*0.18));
    monthlyMinimums.utilities = Math.round(base * (0.04 + Math.random()*0.08));
    monthlyMinimums.transport = Math.round(base * (0.02 + Math.random()*0.05));
    monthlyMinimums.food = Math.round(base * (0.10 + Math.random()*0.06));
    ['rent','utilities','transport','food'].forEach(id => {
      const badge = document.getElementById('badge-' + id);
      if (badge && monthlyMinimums[id]) badge.textContent = `Min: ${fmt(monthlyMinimums[id])}`;
    });
    // If loan exists, recompute mandatory allocation with new remaining months/outstanding
    if (loan && loan.outstanding > 0){
      const remainingMonths = Math.max(1, monthsGoal - (month - 1));
      const req = Math.min(loan.outstanding, Math.ceil(loan.outstanding / remainingMonths));
      ensureLoanMandatoryAllocation(req);
    }
  }

  function happinessMultiplier(p){
    p = clamp(p,0,1);
    return p*p + 0.5*p + 0.5;
  }

  function nextMonth(){
    // If loan was requested previous month, credit wallet now
    if (loan && loan.pendingCredit){
      wallet += loan.original;
      loan.pendingCredit = false;
      pushLog('Kredīts pievienots kontam', `Kredīta summa ${fmt(loan.original)} pievienota kontam.`, 'success');
    }

    monthlyIncome = Math.round(baseMonthlyIncome + nextMonthBonus);
    const mult = happinessMultiplier(happiness);
    const effectiveIncome = Math.round(monthlyIncome * mult);

    let income = effectiveIncome;
    let allocated = totalAllocated();
    const allocatedSavings = categoryTotal('savings');

    if (allocated > income){
      const deficit = allocated - income;
      wallet -= deficit;
      pushLog(`Pārtērēts mēnesī ${month}`, `Piešķirts ${fmt(allocated)}, efektīvie ienākumi ${fmt(income)}. Deficīts ${fmt(deficit)}.`, 'warn');
    } else {
      const leftover = income - allocated;
      wallet += leftover;
      savingsReserve += allocatedSavings;
      pushLog(`Mēnesis ${month} apstrādāts`, `Piešķirts ${fmt(allocated)}. Atlikums ${fmt(leftover)} pievienots kontam. Uzkrājumi +${fmt(allocatedSavings)}.`, 'info');
    }

    // Handle loan payments: requiredPerMonth = ceil(outstanding / remainingMonths)
    if (loan && loan.outstanding > 0){
      const remainingMonths = Math.max(1, monthsGoal - (month - 1));
      const requiredPerMonth = Math.min(loan.outstanding, Math.ceil(loan.outstanding / remainingMonths));
      const payment = categoryTotal('loan');
      if (payment >= loan.outstanding){
        pushLog('Kredīts atmaksāts', `Kredīts pilnībā atmaksāts (${fmt(payment)}).`, 'success');
        loan.outstanding = 0;
        loan = null;
        // remove mandatory allocation(s)
        allocations['loan'] = allocations['loan'].filter(ch => !ch.mandatory);
        refreshCategoryDOM('loan');
      } else {
        loan.outstanding = Math.max(0, loan.outstanding - payment);
        if (payment < 1 || payment < requiredPerMonth){
          loan.missedCount = (loan.missedCount || 0) + 1;
          const smallPenalty = 50;
          wallet -= smallPenalty;
          pushLog('Kredīta kavējums', `Maksājums ${fmt(payment)} bija mazāks par prasīto ${fmt(requiredPerMonth)}. Soda nauda ${fmt(smallPenalty)}.`, 'error');
        } else {
          pushLog('Kredīta maksājums', `Veikts maksājums ${fmt(payment)}. Atlikums ${fmt(loan.outstanding)}.`, 'info');
        }
        if ( (month === monthsGoal - 1 || (monthsGoal===12 && month===11)) && loan.outstanding > 0 ){
          const bigPenalty = Math.max(500, Math.round(loan.outstanding * 0.25));
          wallet -= bigPenalty;
          pushLog('Liels sods par neizpildītu kredītu', `Kredīts nav atmaksāts pie 11. mēneša. Liels sods ${fmt(bigPenalty)} piemērots.`, 'error');
        }
        // After payment, if loan still active, recompute mandatory allocation for next months
        if (loan && loan.outstanding > 0){
          const nextRemaining = Math.max(1, monthsGoal - month); // after incrementing month
          const nextReq = Math.min(loan.outstanding, Math.ceil(loan.outstanding / Math.max(1, nextRemaining)));
          ensureLoanMandatoryAllocation(nextReq);
        }
      }
    } else {
      const payment = categoryTotal('loan');
      if (payment > 0){
        pushLog('Brīdinājums', `Nav aktīva kredīta, bet piešķirts ${fmt(payment)} kategorijai Kredīts. Šī summa tiks atgriezta bankā nākamajā mēnesī.`, 'warn');
      }
    }

    // food handling
    const allocatedFood = categoryTotal('food');
    const foodMin = monthlyMinimums.food || Math.round(baseMonthlyIncome * 0.12);
    if (allocatedFood > foodMin){
      const extraFood = allocatedFood - foodMin;
      const delta = clamp(extraFood / 500, 0, 0.25);
      happiness = clamp(happiness + delta, 0, 1);
      pushLog('Snaki', `Pārtikas pārsniegums ${fmt(extraFood)} → prieks +${Math.round(delta*100)}%.`, 'success');
    } else if (allocatedFood < foodMin){
      const shortfall = foodMin - allocatedFood;
      const penalty = Math.round(shortfall * 0.6);
      wallet -= penalty;
      pushLog('Pārtikas trūkums', `Pārtikai piešķirts ${fmt(allocatedFood)}, nepieciešams ${fmt(foodMin)}. Soda nauda ${fmt(penalty)}.`, 'error');
      happiness = clamp(happiness - 0.12, 0, 1);
    }

    // other minimums compute nextMonthBonus and penalties
    let computedNextBonus = 0;
    ['rent','utilities','transport'].forEach(catId => {
      const allocatedForCat = categoryTotal(catId);
      const minReq = monthlyMinimums[catId] || 0;
      if (allocatedForCat > minReq){
        const extra = allocatedForCat - minReq;
        computedNextBonus += extra;
        pushLog('Pārsniegums', `${categories.find(c=>c.id===catId).name}: pārsniegums ${fmt(extra)} — pievienots nākamajai algai.`, 'info');
      } else if (allocatedForCat < minReq){
        const shortfall = minReq - allocatedForCat;
        const penalty = Math.round(shortfall * 0.5);
        wallet -= penalty;
        pushLog('Mājas izmaksu problēma', `${categories.find(c=>c.id===catId).name} piešķirts ${fmt(allocatedForCat)}, nepieciešams ${fmt(minReq)}. Soda nauda ${fmt(penalty)}.`, 'error');
        happiness = clamp(happiness - 0.06, 0, 1);
      }
    });

    // entertainment effect
    const entertainAlloc = categoryTotal('entertain');
    const baselineEnt = Math.max(1, Math.round(monthlyIncome * 0.05));
    const ratio = entertainAlloc / baselineEnt;
    const deltaEnt = clamp((ratio - 1) * 0.06, -0.12, 0.12);
    happiness = clamp(happiness + deltaEnt, 0, 1);
    if (Math.abs(Math.round(deltaEnt*100)/100) > 0.001){
      pushLog('Izklaides ietekme', `Izklaide: ${fmt(entertainAlloc)} (bāze ${fmt(baselineEnt)}) → prieks ${Math.round(happiness*100)}%`, 'info');
    }

    // investments returns
    if (investmentsPlaced.length){
      investmentsPlaced.forEach(inv => {
        const ret = computeInvestmentReturn(inv);
        wallet += Math.round(ret);
        pushLog(ret >= 0 ? 'Investīciju atdeve' : 'Investīciju zudums', `Investīcija (${inv.type}) ietekmēja kontu par ${fmt(Math.round(ret))}.`, ret >= 0 ? 'success' : 'error');
      });
    }

    // investments affect next month's salary
    let investBonus = 0;
    if (investmentsPlaced.length){
      investmentsPlaced.forEach(inv => {
        const a = Number(inv.amount);
        if (inv.type === 'bonds'){
          investBonus += Math.round(a * (0.002 + Math.random() * 0.004));
        } else if (inv.type === 'stocks'){
          investBonus += Math.round(a * (0.01 + Math.random() * 0.02));
        } else if (inv.type === 'startup'){
          const r = Math.random();
          if (r < 0.18){
            investBonus += Math.round(a * (0.05 + Math.random() * 0.13));
          } else if (r < 0.40){
            investBonus += Math.round(a * (0.01 + Math.random() * 0.02));
          }
        }
      });
      if (investBonus > 0){
        computedNextBonus += investBonus;
        pushLog('Investīciju bonuss', `Investīcijas deva nākamajai algai ${fmt(investBonus)}.`, 'success');
      } else {
        pushLog('Investīciju atskaite', `Šomēnes investīcijas nedeva papildu algu.`, 'info');
      }
    }

    // life event
    const ev = rollEvent();
    if (ev){
      eventText.textContent = `${ev.title} (${fmt(ev.cost)}) — ${ev.desc}`;
      if (ev.cost >= 0){
        wallet += ev.cost;
      } else {
        applyEventCost(ev.cost);
      }
      if (ev.happiness){
        happiness = clamp(happiness + ev.happiness, 0, 1);
      }
      pushLog(`Notikums: ${ev.title}`, `${ev.desc} Ietekme uz kontu: ${fmt(ev.cost)}. Prieks: ${Math.round(happiness*100)}%`, ev.cost >= 0 ? 'success' : 'warn');
    } else {
      eventText.textContent = 'Nav';
    }

    pushLog('Kopsavilkums', `Kontā: ${fmt(wallet)} • Uzkrājumi: ${fmt(savingsReserve)} • Prieks: ${Math.round(happiness*100)}%`, 'info');

    // clear tokens & set next bonus
    clearNonPersistentAllocations();
    nextMonthBonus = computedNextBonus;
    nextBonusDisplay.textContent = fmt(nextMonthBonus);

    month++;
    if (month > monthsGoal) finishGame();
    else {
      updateMonthlyMinimums();
      monthlyIncome = Math.round(baseMonthlyIncome + nextMonthBonus);
    }

    updateLoanUI();
    updateUI();
  }

  function clearNonPersistentAllocations(){
    Object.keys(allocations).forEach(cat => allocations[cat] = []);
    buildBank();
    Object.keys(allocations).forEach(k => refreshCategoryDOM(k));
    // After clearing, re-create mandatory loan allocation if loan still active
    if (loan && loan.outstanding > 0){
      const remainingMonths = Math.max(1, monthsGoal - (month - 1));
      const mandAmt = Math.min(loan.outstanding, Math.ceil(loan.outstanding / remainingMonths));
      ensureLoanMandatoryAllocation(mandAmt);
    }
  }

  function computeInvestmentReturn(inv){
    const amount = Number(inv.amount);
    if (inv.type === 'bonds'){
      const rate = 0.02 + (Math.random()-0.5)*0.006;
      return amount * rate;
    } else if (inv.type === 'stocks'){
      const rate = (Math.random()*0.8) - 0.2;
      return amount * rate;
    } else if (inv.type === 'startup'){
      const r = Math.random();
      if (r < 0.18){
        const mult = 0.5 + Math.random()*4.0;
        return amount * mult;
      } else {
        return -amount * (0.3 + Math.random()*0.6);
      }
    }
    return 0;
  }

  function rollEvent(){
    const candidates = events.filter(e => Math.random() < e.chance);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function applyEventCost(amount){
    let remaining = Math.abs(amount);
    if (savingsReserve >= remaining){
      savingsReserve -= remaining;
      remaining = 0;
      pushLog('Notikums apmaksāts no uzkrājumiem', `Izlietots ${fmt(Math.abs(amount))} no uzkrājumiem.`, 'info');
      return;
    } else {
      if (savingsReserve > 0){
        remaining -= savingsReserve;
        pushLog('Daļa no uzkrājumiem izmantota', `Izlietots ${fmt(savingsReserve)} no uzkrājumiem.`, 'warn');
        savingsReserve = 0;
      }
      wallet -= remaining;
      pushLog('Atlikums apmaksāts no konta', `Apmaksāts ${fmt(remaining)} no konta.`, 'error');
    }
  }

  function finishGame(){
    const goalMet = savingsReserve >= TRIP_GOAL;
    let result;
    if (goalMet){
      result = `Apsveicu! Tu sasniedzi mērķi — uzkrāti ${fmt(savingsReserve)}. Ceļojuma mērķis ${fmt(TRIP_GOAL)} sasniegts.`;
      runConfetti();
      pushLog('Spēle beigusies', result, 'success');
    } else {
      result = `Spēle beigusies. Uzkrājumi ${fmt(savingsReserve)} (mērķis ${fmt(TRIP_GOAL)}). Mēģini vēlreiz!`;
      pushLog('Spēle beigusies', result, 'info');
    }
    message.textContent = result;
    nextMonthBtn.disabled = true;
  }

  function autoAllocate(){
    Object.keys(allocations).forEach(k => allocations[k] = []);
    const rent = Math.min(Math.round(baseMonthlyIncome * 0.35), monthlyMinimums.rent || Math.round(baseMonthlyIncome * 0.35));
    const food = Math.max(monthlyMinimums.food || Math.round(baseMonthlyIncome * 0.12), Math.round(baseMonthlyIncome * 0.12));
    const utilities = Math.round(baseMonthlyIncome * 0.07);
    const transport = Math.round(baseMonthlyIncome * 0.05);
    const entertain = Math.round(baseMonthlyIncome * 0.05);
    const savings = Math.max(50, Math.round(baseMonthlyIncome * 0.10));
    const pairs = [
      ['rent', rent], ['food', food], ['utilities', utilities],
      ['transport', transport], ['entertain', entertain], ['savings', savings]
    ];
    pairs.forEach(([cat, amt]) => allocations[cat].push({ id: uid(), amount: amt }));
    // Recreate mandatory loan allocation if present
    if (loan && loan.outstanding > 0){
      const remainingMonths = Math.max(1, monthsGoal - (month - 1));
      const mandAmt = Math.min(loan.outstanding, Math.ceil(loan.outstanding / remainingMonths));
      ensureLoanMandatoryAllocation(mandAmt);
    }
    Object.keys(allocations).forEach(k => refreshCategoryDOM(k));
    pushLog('Automātiskā sadale', 'Ieteikta pamata sadale atbilstoši ienākumiem.', 'info');
    updateUI();
  }

  function updateUI(){
    incomeDisplay.textContent = fmt(Math.round(baseMonthlyIncome + nextMonthBonus));
    monthDisplay.textContent = Math.min(month, monthsGoal);
    monthsGoalElem.textContent = monthsGoal;
    walletDisplay.textContent = fmt(Math.round(wallet));
    savingsDisplay.textContent = fmt(Math.round(savingsReserve));
    allocatedDisplay.textContent = fmt(totalAllocated());
    remainingDisplay.textContent = fmt(Math.round((baseMonthlyIncome + nextMonthBonus) - totalAllocated()));

    categories.forEach(c => {
      const el = document.getElementById('total-'+c.id);
      if (el) el.textContent = fmt(categoryTotal(c.id));
      refreshCategoryDOM(c.id);
      const badge = document.getElementById('badge-'+c.id);
      if (badge && monthlyMinimums[c.id]) badge.textContent = `Min: ${fmt(monthlyMinimums[c.id])}`;
    });

    const pct = Math.round(happiness * 100);
    happinessPct.textContent = pct + '%';
    happinessBar.style.width = `${pct}%`;

    const progress = Math.round(Math.min(100, (savingsReserve / TRIP_GOAL) * 100));
    goalProgressValue.textContent = `${progress}%`;

    nextBonusDisplay.textContent = fmt(nextMonthBonus);

    if (totalAllocated() > (baseMonthlyIncome + nextMonthBonus)){
      remainingDisplay.parentElement.classList.add('warning');
    } else {
      remainingDisplay.parentElement.classList.remove('warning');
    }

    updateLoanUI();

    nextMonthBtn.disabled = month > monthsGoal;
  }

  function updateLoanUI(){
    if (loan && loan.outstanding > 0){
      loanOutstandingEl.textContent = fmt(Math.round(loan.outstanding));
      const remainingMonths = Math.max(1, monthsGoal - (month - 1));
      const required = Math.min(loan.outstanding, Math.ceil(loan.outstanding / remainingMonths));
      loanRequiredEl.textContent = fmt(required);
      loanRemainingEl.textContent = `${remainingMonths} mēneši`;
      loanMissedEl.textContent = String(loan.missedCount || 0);
    } else {
      loanOutstandingEl.textContent = '—';
      loanRequiredEl.textContent = '—';
      loanRemainingEl.textContent = '—';
      loanMissedEl.textContent = '0';
    }
  }

  // --- ensure loan mandatory allocation exists/updates ---
  function ensureLoanMandatoryAllocation(amount){
    if (!loan || loan.outstanding <= 0) return;
    allocations['loan'] = allocations['loan'].filter(ch => !ch.mandatory);
    const mandAmt = Math.max(0, Math.round(amount || Math.ceil(loan.outstanding / Math.max(1, (monthsGoal - (month - 1))))));
    const mand = { id: 'loan-mandatory', amount: mandAmt, mandatory: true };
    allocations['loan'].unshift(mand);
    refreshCategoryDOM('loan');
    updateLoanUI();
  }

  // --- improved log: auto-detect level & render nicely --- //
  function detectLevel(title, text){
    const t = (title + ' ' + text).toLowerCase();
    if (t.includes('neatļauts') || t.includes('soda') || t.includes('kavējums') || t.includes('zudums') || t.includes('trūkums') ) return 'error';
    if (t.includes('apsveicu') || t.includes('investēts') || t.includes('atmaksāts') || t.includes('bonuss') || t.includes('snaki')) return 'success';
    if (t.includes('brīdinājums') || t.includes('pārtērēts') ) return 'warn';
    return 'info';
  }

  function pushLog(title, text, level){
    const d = new Date();
    if (!level) level = detectLevel(title, text);
    const entry = { time:d.toISOString(), title, text, level };
    log.push(entry);
    renderLog();
  }
  function renderLog(){
    logDiv.innerHTML = '';
    log.slice().reverse().forEach(e => {
      const node = document.createElement('div');
      node.className = 'logEntry level-' + (e.level || 'info');
      const icon = e.level === 'success' ? '✅' : (e.level === 'error' ? '⛔' : (e.level === 'warn' ? '⚠️' : 'ℹ️'));
      const timeStr = new Date(e.time).toLocaleString();
      node.innerHTML = `<div class="logHeader">${icon} <strong>${e.title}</strong> <span class="small timestamp">[${timeStr}]</span></div>
                        <div class="logBody small">${e.text}</div>`;
      logDiv.appendChild(node);
    });
  }

  function applyDifficulty(diff){
    events = JSON.parse(JSON.stringify(eventsBase));
    if (diff === 'easy'){
      baseMonthlyIncome = Math.round(BASE_MONTHLY_INCOME * 1.15);
      for (let i=0;i<events.length;i++) events[i].chance *= 0.6;
      challengeInfo.textContent = 'Viegls režīms: vairāk ienākumu, mazāk notikumu.';
    } else if (diff === 'normal'){
      baseMonthlyIncome = BASE_MONTHLY_INCOME;
      challengeInfo.textContent = 'Vidējs režīms.';
    } else if (diff === 'hard'){
      baseMonthlyIncome = Math.round(BASE_MONTHLY_INCOME * 0.85);
      for (let i=0;i<events.length;i++){ events[i].chance *= 1.3; events[i].cost = Math.round(events[i].cost * 1.2); }
      challengeInfo.textContent = 'Grūts režīms: mazāki ienākumi, spēcīgāki notikumi.';
    } else if (diff === 'challenge'){
      baseMonthlyIncome = Math.round(BASE_MONTHLY_INCOME * 0.9);
      for (let i=0;i<events.length;i++){ events[i].chance *= 1.4; events[i].cost = Math.round(events[i].cost * 1.3); }
      challengeInfo.textContent = 'Izaicinājums: centies uzkrāt mērķi.';
    }
    monthlyIncome = baseMonthlyIncome + nextMonthBonus;
    updateUI();
  }

  // --- persistence helpers ---
  downloadStateBtn.addEventListener('click', ()=>{
    const state = { month, monthsGoal, baseMonthlyIncome, monthlyIncome, wallet, savingsReserve, allocations, investmentsPlaced, log, happiness, nextMonthBonus, loan };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budzets_state_month${month}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  nextMonthBtn.addEventListener('click', ()=>{
    if (categoryTotal('rent') === 0){
      if (!confirm('Tu neesi piešķīris neko Noma / Hipotēkai. Turpināt?')) return;
    }
    if (categoryTotal('food') === 0){
      if (!confirm('Tu neesi piešķīris neko pārtikai — var rasties sods. Turpināt?')) return;
    }
    nextMonth();
  });

  autoAllocBtn.addEventListener('click', autoAllocate);
  resetAllBtn.addEventListener('click', ()=>{
    if (!confirm('Vai tiešām atiestatīt spēli?')) return;
    initAllocations();
    buildBank();
    buildCategories();
    investmentsPlaced = [];
    month = 1;
    wallet = START_WALLET;
    savingsReserve = 0;
    happiness = 0.5;
    message.textContent = '';
    nextMonthBtn.disabled = false;
    updateMonthlyMinimums();
    pushLog('Atiestatīts', 'Spēle atiestatīta.', 'info');
    updateUI();
  });

  startChallengeBtn.addEventListener('click', ()=>{
    const diff = difficultySelect.value;
    initAllocations();
    buildBank();
    buildCategories();
    applyDifficulty(diff);
    updateMonthlyMinimums();
    pushLog('Režīms iestatīts', `Izvēlēts: ${diff}.`, 'info');
    updateUI();
  });

  (function seedStarterChips(){
    [500,1000,2000].forEach(a => chipsDiv.appendChild(createBankChip(a, 'cash')));
    investProducts.forEach(p => {
      const chip = createBankChip(p.type, 'invest');
      chip.textContent = p.label;
      chip.dataset.investType = p.type;
      chipsDiv.appendChild(chip);
    });
  })();

  window.addEventListener('keydown', (e)=>{
    if (e.key === ' ') { e.preventDefault(); nextMonthBtn.click(); }
    if (e.key.toLowerCase() === 'a') autoAllocBtn.click();
    if (e.key.toLowerCase() === 'r') resetAllBtn.click();
  });

  function runConfetti(){
    const canvas = confettiCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.style.display = 'block';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = [];
    for (let i=0;i<140;i++){
      pieces.push({
        x: Math.random()*canvas.width,
        y: Math.random()*canvas.height* -0.5,
        vx: (Math.random()-0.5)*6,
        vy: Math.random()*6+2,
        size: Math.random()*10+4,
        color: `hsl(${Math.random()*360},70%,60%)`
      });
    }
    let t = 0;
    function frame(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      pieces.forEach(p=>{
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x,p.y,p.size,p.size*0.6);
      });
      t++;
      if (t < 220) requestAnimationFrame(frame);
      else { ctx.clearRect(0,0,canvas.width,canvas.height); canvas.style.display='none'; }
    }
    frame();
  }

})();