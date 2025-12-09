// Investīciju simulators — LAT updated: vairāk aktīvu, augstāka volatilitāte, skaidrākas pogas, aktīvu izvēle

(() => {
  // DOM
  const $ = id => document.getElementById(id);
  const roundEl = $('round');
  const cashEl = $('cash');
  const targetEl = $('target');
  const totalEl = $('totalValue');
  const leverageLabel = $('leverageLabel');
  const difficultyLabel = $('difficultyLabel');
  const expectedReturnEl = $('expectedReturn');
  const portfolioVolEl = $('portfolioVol');
  const diversificationEl = $('diversification');
  const statusLine = $('statusLine');
  const assetsList = $('assetsList');
  const holdingsSummary = $('holdingsSummary');
  const logList = $('logList');

  const difficultySelect = $('difficulty');
  const startBtn = $('start');
  const pauseBtn = $('pause');
  const resetBtn = $('reset');
  const leverageSelect = $('leverage');
  const rebalanceBtn = $('rebalance');
  const convertToCashBtn = $('convertToCash');
  const buyAllRiskyBtn = $('buyAllRisky');

  const chart = $('chart');
  const ctx = chart.getContext('2d');

  // Asset selector
  const assetSelector = $('assetSelect');
  const assetSelectorBlock = $('assetSelectorBlock');

  // Paplašināts aktīvu saraksts (>=20 gab.)
  const EXTENDED_BASE_ASSETS = {
    bitcoin:   { id: 'bitcoin',   label: 'Bitcoin',           price: 29000, mean: 0.009, sd: 0.18, color: '#f59e0b' },
    ethereum:  { id: 'ethereum',  label: 'Ethereum',          price: 1600,  mean: 0.007, sd: 0.17, color: '#7c3aed' },
    whatsapp:  { id: 'whatsapp',  label: 'WhatsApp (akcija)', price: 120,   mean: 0.005, sd: 0.12, color: '#06b6d4' },
    apple:     { id: 'apple',     label: 'Apple',             price: 200,   mean: 0.004, sd: 0.10, color: '#3b82f6' },
    tesla:     { id: 'tesla',     label: 'Tesla',             price: 210,   mean: 0.006, sd: 0.15, color: '#ef4444' },
    amazon:    { id: 'amazon',    label: 'Amazon',            price: 190,   mean: 0.004, sd: 0.11, color: '#f59e42' },
    nvidia:    { id: 'nvidia',    label: 'NVIDIA',            price: 600,   mean: 0.009, sd: 0.22, color: '#a3e635' },
    meta:      { id: 'meta',      label: 'Meta',             price: 330,   mean: 0.005, sd: 0.095, color: '#0ea5e9' },
    gold:      { id: 'gold',      label: 'Zelts',             price: 1900,  mean: 0.0013, sd: 0.012, color: '#fbbf24' },
    savings:   { id: 'savings',   label: 'Krājkonts',         price: 1,     mean: 0.0015, sd: 0.003, color: '#60a5fa' },
    msft:      { id: 'msft',      label: 'Microsoft',         price: 330,   mean: 0.0035, sd: 0.08, color: '#38bdf8' },
    google:    { id: 'google',    label: 'Google',            price: 115,   mean: 0.004, sd: 0.09, color: '#60a5fa' },
    bmw:       { id: 'bmw',       label: 'BMW',               price: 90,    mean: 0.003, sd: 0.085, color: '#e5e7eb' },
    coca:      { id: 'coca',      label: 'CocaCola',          price: 60,    mean: 0.002, sd: 0.075, color: '#f87171' },
    netflix:   { id: 'netflix',   label: 'Netflix',           price: 400,   mean: 0.008, sd: 0.15, color: '#e11d48' },
    tsmc:      { id: 'tsmc',      label: 'TSMC',              price: 110,   mean: 0.004, sd: 0.09, color: '#d946ef' },
    jpm:       { id: 'jpm',       label: 'JPMorgan',          price: 140,   mean: 0.0032, sd: 0.07, color: '#a1a1aa' },
    shell:     { id: 'shell',     label: 'Shell',             price: 35,    mean: 0.002, sd: 0.07, color: '#fde68a' },
    samsung:   { id: 'samsung',   label: 'Samsung',           price: 50,    mean: 0.003, sd: 0.085, color: '#0f766e' },
    airbus:    { id: 'airbus',    label: 'Airbus',            price: 130,   mean: 0.003, sd: 0.10, color: '#6366f1' },
    visa:      { id: 'visa',      label: 'Visa',              price: 240,   mean: 0.004, sd: 0.08, color: '#1e40af' },
    mcd:       { id: 'mcd',       label: 'McDonalds',         price: 280,   mean: 0.003, sd: 0.09, color: '#f59e42' },
    siemens:   { id: 'siemens',   label: 'Siemens',           price: 180,   mean: 0.003, sd: 0.10, color: '#a7f3d0' },
    sap:       { id: 'sap',       label: 'SAP',               price: 140,   mean: 0.003, sd: 0.085, color: '#f472b6' }
  };

  // Keep a working copy for state
  let ASSETS = JSON.parse(JSON.stringify(EXTENDED_BASE_ASSETS));

  // By default 5 assets
  const DEFAULT_ASSET_IDS = [
    'bitcoin', 'ethereum', 'whatsapp', 'gold', 'savings'
  ];

  // Spēles stāvoklis
  let state = {
    running: false,
    intervalId: null,
    round: 0,
    cash: 1000,
    target: 10000,
    difficulty: 'easy',
    leverage: 1,
    prices: {},
    holdings: {},
    insured: {},
    history: [],
    selectedAssets: [...DEFAULT_ASSET_IDS]
  };

  const DIFFICULTY = {
    easy:   { start: 1000, target: 10000, volFactor: 1.0, driftFactor: 1.0 },
    medium: { start: 500,  target: 100000, volFactor: 1.35, driftFactor: 0.9 },
    hard:   { start: 100,  target: 1000000, volFactor: 1.75, driftFactor: 0.85 }
  };

  // Util
  const fmt = n => '€' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const short = n => Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const pct = n => (n * 100).toFixed(2) + '%';
  function randn_bm() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  function randomReturn(mean, sd) {
    return mean + randn_bm() * sd;
  }

  // Iniciē stāvokli pēc grūtības
  function initStateForDifficulty(diffKey) {
    const preset = DIFFICULTY[diffKey];
    state.difficulty = diffKey;
    state.cash = preset.start;
    state.target = preset.target;
    state.round = 0;
    state.leverage = Number(leverageSelect.value) || 1;
    state.prices = {};
    state.holdings = {};
    state.insured = {};
    state.history = [];
    // Reset prices & holdings for only selected assets
    for (const k of Object.keys(ASSETS)) {
      const base = ASSETS[k].price;
      state.prices[k] = Math.max(0.0001, base * (1 + (Math.random() - 0.5) * 0.2));
      state.holdings[k] = 0;
      state.insured[k] = 0;
    }
    updateLabels();
    rebuildAssetsUI();
    clearLog();
    log(`Spēle ielādēta: ${diffKey}. Sākums ${fmt(state.cash)}, mērķis ${fmt(state.target)}.`);
  }

  // Asset selector dropdown
  function updateAssetSelector() {
    assetSelector.innerHTML = '';
    Object.values(ASSETS).forEach(asset => {
      const opt = document.createElement('option');
      opt.value = asset.id;
      opt.textContent = asset.label;
      if (state.selectedAssets.includes(asset.id)) opt.selected = true;
      assetSelector.appendChild(opt);
    });
  }
  assetSelector?.addEventListener('change', () => {
    // At least 5 assets
    const selected = Array.from(assetSelector.selectedOptions).map(o => o.value);
    if (selected.length < 5) {
      alert("Izvēlies vismaz 5 aktīvus!");
      // restore previous selected
      updateAssetSelector();
      return;
    }
    state.selectedAssets = selected;
    rebuildAssetsUI();
    refreshHoldingsUI();
    updateLabels();
  });

  // UI - saraksts ar tikai atlasītajiem aktīviem
  function rebuildAssetsUI() {
    assetsList.innerHTML = '';
    for (const key of state.selectedAssets) {
      const info = ASSETS[key];
      const div = document.createElement('div');
      div.className = 'asset';
      div.innerHTML = `
        <div class="name">${info.label}</div>
        <div class="price" id="price-${key}">${fmt(state.prices[key])}</div>
        <div class="qty" id="qty-${key}">Skaits: ${short(state.holdings[key])}</div>
        <input id="input-${key}" type="number" min="0" step="0.01" value="0" />
        <button class="buy" data-asset="${key}">Pirkt</button>
        <button class="sell" data-asset="${key}">Pārdot</button>
        <button class="insure" data-asset="${key}">Apdrošināt (0.5%)</button>
      `;
      assetsList.appendChild(div);
    }

    document.querySelectorAll('.buy').forEach(b => {
      b.addEventListener('click', e => {
        const asset = e.target.dataset.asset;
        const input = $(`input-${asset}`);
        buyAsset(asset, Number(input.value));
      });
    });
    document.querySelectorAll('.sell').forEach(b => {
      b.addEventListener('click', e => {
        const asset = e.target.dataset.asset;
        const input = $(`input-${asset}`);
        sellAsset(asset, Number(input.value));
      });
    });
    document.querySelectorAll('.insure').forEach(b => {
      b.addEventListener('click', e => {
        const asset = e.target.dataset.asset;
        buyInsurance(asset);
      });
    });
    refreshHoldingsUI();
  }

  function refreshHoldingsUI() {
    const parts = [];
    for (const k of state.selectedAssets) {
      const val = state.holdings[k] * state.prices[k];
      parts.push(`${ASSETS[k].label}: ${fmt(val)} (${short(state.holdings[k])})`);
      const priceEl = $(`price-${k}`);
      const qtyEl = $(`qty-${k}`);
      if (priceEl) priceEl.textContent = fmt(state.prices[k]);
      if (qtyEl) qtyEl.textContent = `Skaits: ${short(state.holdings[k])} ${state.insured[k] ? '🔒' : ''}`;
    }
    holdingsSummary.innerHTML = parts.join(' • ');
    updateLabels();
  }

  function updateLabels() {
    roundEl.textContent = state.round;
    cashEl.textContent = fmt(state.cash);
    targetEl.textContent = fmt(state.target);
    const total = getTotalValue();
    totalEl.textContent = fmt(total);
    leverageLabel.textContent = 'x' + state.leverage;
    difficultyLabel.textContent = state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
    // sagatavot atdevi un volatilitāti
    let expected = 0, vol = 0;
    const totalVal = Math.max(1e-9, getTotalValue());
    for (const k of state.selectedAssets) {
      const w = (state.holdings[k] * state.prices[k]) / totalVal;
      expected += w * (ASSETS[k].mean * DIFFICULTY[state.difficulty].driftFactor);
      vol += w * (ASSETS[k].sd * DIFFICULTY[state.difficulty].volFactor);
    }
    expectedReturnEl.textContent = pct(expected * state.leverage);
    portfolioVolEl.textContent = pct(vol * state.leverage);
    diversificationEl.textContent = `${Object.values(state.holdings).filter((q,idx) => q > 0.0000001 && state.selectedAssets.includes(Object.keys(ASSETS)[idx])).length}/${state.selectedAssets.length}`;
  }

  // Log
  function log(msg) {
    const li = document.createElement('li');
    li.textContent = `[Raunds ${state.round}] ${msg}`;
    logList.prepend(li);
  }
  function clearLog() { logList.innerHTML = ''; }

  // Operācijas: pirkt/pārdot
  function buyAsset(asset, dollars) {
    dollars = Number(dollars) || 0;
    if (dollars <= 0) { alert('Ievadi summu > 0'); return; }
    if (dollars > state.cash) { alert('Pārāk maz naudas'); return; }
    const price = state.prices[asset];
    const qty = dollars / price;
    state.cash -= dollars;
    state.holdings[asset] += qty;
    log(`Iegādāts ${short(qty)} ${ASSETS[asset].label} par ${fmt(dollars)}.`);
    refreshHoldingsUI();
    checkLoss();
  }

  function sellAsset(asset, dollars) {
    dollars = Number(dollars) || 0;
    if (dollars <= 0) { alert('Ievadi summu > 0'); return; }
    const price = state.prices[asset];
    const qty = dollars / price;
    if (qty > state.holdings[asset] + 1e-9) { alert('Nav tik daudz aktīvu'); return; }
    state.holdings[asset] -= qty;
    const proceeds = qty * price;
    state.cash += proceeds;
    log(`Pārdots ${short(qty)} ${ASSETS[asset].label} par ${fmt(proceeds)}.`);
    refreshHoldingsUI();
  }

  // Apdrošināšana: 0.5% no vērtības aizsargā nākamo negatīvo zaudējumu pusē
  function buyInsurance(asset) {
    const holdingValue = state.holdings[asset] * state.prices[asset];
    if (holdingValue <= 0) { alert('Nav aktīvu apdrošināšanai'); return; }
    const cost = holdingValue * 0.005;
    if (cost > state.cash) { alert('Nav pietiekami naudas apdrošināšanai'); return; }
    state.cash -= cost;
    state.insured[asset] = 1;
    log(`Nopirkta apdrošināšana ${ASSETS[asset].label} (izmaksas ${fmt(cost)}).`);
    refreshHoldingsUI();
    checkLoss();
  }

  function sellAllToCash() {
    let totalProceeds = 0;
    for (const k of state.selectedAssets) {
      const qty = state.holdings[k];
      const p = state.prices[k];
      totalProceeds += qty * p;
      state.holdings[k] = 0;
      state.insured[k] = 0;
    }
    state.cash += totalProceeds;
    log(`Pārdots viss par ${fmt(totalProceeds)}.`);
    refreshHoldingsUI();
  }

  function investAllRisky() {
    // All risky assets = everything except savings
    const riskyKeys = state.selectedAssets.filter(k => k !== 'savings');
    if (state.cash <= 0) { alert('Nav naudas ieguldīšanai'); return; }
    const per = state.cash / riskyKeys.length;
    for (const k of riskyKeys) {
      const price = state.prices[k];
      const qty = per / price;
      state.holdings[k] += qty;
    }
    log(`Visi līdzekļi (${fmt(state.cash)}) ieguldīti riskantos aktīvos.`);
    state.cash = 0;
    refreshHoldingsUI();
    checkLoss();
  }

  function rebalanceEven() {
    const keys = state.selectedAssets.filter(k => k !== 'savings');
    const invested = getInvestedValue();
    if (invested <= 0.0001) { alert('Nav investīciju, ko rebalansēt'); return; }
    const per = invested / keys.length;
    sellAllToCash();
    for (const k of keys) {
      const price = state.prices[k];
      const qty = per / price;
      state.holdings[k] = qty;
    }
    state.cash = 0;
    log('Rebalansēts vienādi pa riskantajiem aktīviem.');
    refreshHoldingsUI();
  }

  function getInvestedValue() {
    let v = 0;
    for (const k of state.selectedAssets) v += state.holdings[k] * state.prices[k];
    return v;
  }
  function getTotalValue() {
    return Math.max(0, state.cash + getInvestedValue());
  }

  // Simulācijas kārta (vienas sekundes solis)
  function simulateRound() {
    if (!state.running) return;
    state.round += 1;
    state.leverage = Number(leverageSelect.value) || 1;

    const totalBefore = getTotalValue();

    const volFactor = DIFFICULTY[state.difficulty].volFactor;
    const driftFactor = DIFFICULTY[state.difficulty].driftFactor;

    // ģenerē tirgus kustības un atjauno cenas tikai izvēlētajiem aktīviem
    const roundReturns = {};
    for (const k of state.selectedAssets) {
      const info = ASSETS[k];
      const mean = info.mean * driftFactor;
      const sd = info.sd * volFactor;
      let r = randomReturn(mean, sd);
      roundReturns[k] = r;
      state.prices[k] = Math.max(0.00001, state.prices[k] * (1 + r));
    }

    for (const k of state.selectedAssets) {
      const r = roundReturns[k];
      if (state.insured[k] && r < 0) {
        roundReturns[k] = r / 2;
        state.insured[k] = Math.max(0, state.insured[k] - 1);
      }
    }

    if (state.leverage > 1) {
      const invested = getInvestedValue();
      const borrowCost = invested * 0.002 * (state.leverage - 1);
      state.cash -= borrowCost;
      if (borrowCost > 0) log(`Sviras izmaksas samaksātas: ${fmt(borrowCost)}.`);
    }

    const totalAfter = getTotalValue();
    const pctChange = totalBefore > 0 ? (totalAfter - totalBefore) / totalBefore : 0;
    state.history.push(pctChange);
    if (state.history.length > 200) state.history.shift();

    const summary = Object.keys(roundReturns).map(k => {
      const r = roundReturns[k];
      const sign = r >= 0 ? '+' : '';
      return `${ASSETS[k].label}: ${sign}${(r*100).toFixed(2)}%`;
    }).join(' | ');
    log(`Tirgus: ${summary} → Kopā: ${fmt(totalAfter)} (izmaiņa ${pct(pctChange)})`);

    refreshHoldingsUI();
    drawChart();

    if (totalAfter >= state.target) {
      log(`UZVARA! Sasniegts mērķis ${fmt(totalAfter)}.`);
      statusLine.textContent = `UZVARA! Sasniegts mērķis ${fmt(totalAfter)}.`;
      stopSimulation();
      return;
    }
    if (totalAfter <= 0) {
      log(`ZAUDĒJUMS — portfeļa vērtība nokritusi līdz ${fmt(totalAfter)}. Tiek atiestatīts.`);
      statusLine.textContent = `ZAUDĒJUMS — atiestatīšana...`;
      stopSimulation();
      setTimeout(() => {
        initStateForDifficulty(state.difficulty);
        statusLine.textContent = '';
      }, 1000);
      return;
    }
  }

  function drawChart() {
    const w = chart.width;
    const h = chart.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#041022';
    ctx.fillRect(0,0,w,h);

    const data = state.history.slice(-40);
    const rounds = data.length || 1;
    const pad = 14;
    const blockW = (w - pad*2) / Math.max(1, rounds);

    let maxAbs = 0.0001;
    data.forEach(v => { const a = Math.abs(v); if (a > maxAbs) maxAbs = a; });

    const zeroY = pad + (h - pad*2)/2;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(pad, zeroY);
    ctx.lineTo(w - pad, zeroY);
    ctx.stroke();

    data.forEach((v, i) => {
      const bx = pad + i * blockW;
      const cx = bx + blockW/2 - Math.min(8, blockW*0.18);
      const barW = Math.min(18, Math.max(6, blockW*0.24));
      const barH = (Math.abs(v) / maxAbs) * ((h - pad*2)/2) * 0.95;
      const color = v >= 0 ? '#34d399' : '#fb7185';
      ctx.fillStyle = color;
      if (v >= 0) {
        ctx.fillRect(cx, zeroY - barH, barW, barH);
      } else {
        ctx.fillRect(cx, zeroY, barW, barH);
      }
    });

    ctx.fillStyle = '#c7f9f2';
    ctx.font = '13px Inter, Arial';
    ctx.fillText('R: ' + state.round + ' kopā: ' + fmt(getTotalValue()), pad + 2, h - 8);
  }

  function startSimulation() {
    if (state.running) return;
    state.running = true;
    pauseBtn.textContent = 'Pauze ⏸';
    state.intervalId = setInterval(simulateRound, 1000);
    statusLine.textContent = 'Darbībā...';
  }
  function stopSimulation() {
    state.running = false;
    if (state.intervalId) { clearInterval(state.intervalId); state.intervalId = null; }
    pauseBtn.textContent = 'Turpināt ▶';
  }
  pauseBtn.addEventListener('click', () => {
    if (state.running) stopSimulation(); else startSimulation();
  });

  resetBtn.addEventListener('click', () => {
    if (!confirm('Vai tiešām atiestatīt spēli?')) return;
    stopSimulation();
    initStateForDifficulty(difficultySelect.value);
    statusLine.textContent = '';
  });

  startBtn.addEventListener('click', () => {
    initStateForDifficulty(difficultySelect.value);
    state.leverage = Number(leverageSelect.value) || 1;
    startSimulation();
  });

  rebalanceBtn.addEventListener('click', rebalanceEven);
  convertToCashBtn.addEventListener('click', sellAllToCash);
  buyAllRiskyBtn.addEventListener('click', investAllRisky);
  leverageSelect.addEventListener('change', () => {
    state.leverage = Number(leverageSelect.value) || 1;
    updateLabels();
  });

  function checkLoss() {
    const total = getTotalValue();
    if (total <= 0) {
      log('Tūlītējs ZAUDĒJUMS: portfeļa vērtība ≤ 0. Atiestatīšana.');
      stopSimulation();
      setTimeout(() => initStateForDifficulty(state.difficulty), 700);
    }
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const active = document.activeElement;
      if (active && active.id && active.id.startsWith('input-')) {
        const asset = active.id.replace('input-', '');
        buyAsset(asset, Number(active.value));
      }
    }
  });

  // Initial asset selector UI population and state
  updateAssetSelector();
  initStateForDifficulty('easy');
  drawChart();
})();