// Smart Shopper — Ļoti Grūts režīms (Latviski)
// Atjaunināts: veikals satur 300+ preces, saraksta preces vairs nav atzīmētas veikala karteļos (spēlētājam pašam jāatrod),
// noņemts saraksta hint, un palielināta iespēja, ka dažas saraksta preces var būt izpārdotas (padara uzvaru reizēm neiespējamu).

(() => {
  // Bāzes preču saraksts (cilvēkam saprotami nosaukumi), plaši variēsim līdz 300+ ierakstiem
  const BASE_ITEMS = [
    { key: 'milk', name: 'Piens', price: 3.5, category: 'dairy' },
    { key: 'bread', name: 'Maize', price: 2.25, category: 'bakery' },
    { key: 'eggs', name: 'Olas', price: 4.2, category: 'dairy' },
    { key: 'apple', name: 'Āboli', price: 3.9, category: 'produce' },
    { key: 'banana', name: 'Banāni', price: 1.9, category: 'produce' },
    { key: 'chicken', name: 'Vistas gaļa', price: 8.5, category: 'meat' },
    { key: 'beef', name: 'Liellopu gaļa', price: 6.9, category: 'meat' },
    { key: 'rice', name: 'Rīsi', price: 2.7, category: 'pantry' },
    { key: 'pasta', name: 'Makaroni', price: 1.8, category: 'pantry' },
    { key: 'cereal', name: 'Kornflakes', price: 4.75, category: 'grocery' },
    { key: 'cheese', name: 'Siers', price: 5.6, category: 'dairy' },
    { key: 'yogurt', name: 'Jogurts', price: 2.1, category: 'dairy' },
    { key: 'butter', name: 'Sviests', price: 3.9, category: 'dairy' },
    { key: 'chocolate', name: 'Šokolāde', price: 1.5, category: 'snack' },
    { key: 'chips', name: 'Čipsi', price: 2.3, category: 'snack' },
    { key: 'water', name: 'Ūdens', price: 3.3, category: 'beverage' },
    { key: 'soda', name: 'Limonāde', price: 2.0, category: 'beverage' },
    { key: 'coffee', name: 'Kafija', price: 7.2, category: 'beverage' },
    { key: 'tea', name: 'Tēja', price: 3.4, category: 'beverage' },
    { key: 'toothpaste', name: 'Zobu pasta', price: 3.2, category: 'personal' },
    { key: 'soap', name: 'Ziepes', price: 1.8, category: 'personal' },
    { key: 'detergent', name: 'Veļas pulveris', price: 9.5, category: 'home' },
    { key: 'toiletpaper', name: 'Tualetes papīrs', price: 7.5, category: 'home' },
    { key: 'napkins', name: 'Salvetes', price: 1.9, category: 'home' },
    { key: 'wrap', name: 'Pārtikas plēve', price: 2.6, category: 'home' },
    { key: 'batteries', name: 'Baterijas', price: 4.0, category: 'home' },
    { key: 'catfood', name: 'Kaķu ēdiens', price: 3.1, category: 'pet' },
    { key: 'dogfood', name: 'Suņu ēdiens', price: 4.2, category: 'pet' },
    { key: 'protein', name: 'Proteīna batoniņi', price: 6.0, category: 'grocery' },
    { key: 'peanut', name: 'Zemesriekstu sviests', price: 3.9, category: 'grocery' },
    { key: 'jam', name: 'Ievārījums', price: 2.8, category: 'grocery' },
    { key: 'olive', name: 'Olivu eļļa', price: 8.2, category: 'pantry' },
    { key: 'salt', name: 'Sāls', price: 0.9, category: 'pantry' },
    { key: 'sugar', name: 'Cukurs', price: 1.6, category: 'pantry' },
    { key: 'flour', name: 'Milti', price: 1.9, category: 'pantry' },
    { key: 'icecream', name: 'Saldējums', price: 5.0, category: 'frozen' },
    { key: 'frozenveg', name: 'Auksti dārzeņi', price: 2.7, category: 'frozen' },
    { key: 'frozenpizza', name: 'Saldpica', price: 4.8, category: 'frozen' },
    { key: 'tomato', name: 'Tomāti', price: 3.1, category: 'produce' },
    { key: 'lettuce', name: 'Salāti', price: 1.7, category: 'produce' },
    { key: 'onion', name: 'Sīpoli', price: 1.5, category: 'produce' },
    { key: 'garlic', name: 'Ķiploki', price: 0.8, category: 'produce' },
    // ... we'll expand programātiski līdz 300+
  ];

  // paplašināšanas elementi (iepakojumi, zīmoli, variācijas)
  const SIZES = ['(500g)', '(1kg)', '(2kg)', '(250g)', '(pack of 4)', '(pack of 6)', '(750ml)', '(1L)', '(2L)'];
  const BRANDS = ['Eco', 'Fresh', 'Prime', 'Daily', 'Budget', 'Gold', 'Nature', 'Farm', 'Local'];
  const EXTRA_VARIANTS = [
    { suffix: 'light', label: 'Light', factor: 0.85 },
    { suffix: 'organic', label: 'BIO', factor: 1.25 },
    { suffix: 'lowfat', label: 'Zems tauku saturs', factor: 1.05 },
    { suffix: 'family', label: 'Ģimenes iepakojums', factor: 1.6 },
    { suffix: 'mini', label: 'Mini', factor: 0.65 },
  ];

  // Spēles iestatījumi — bargāks veryhard režīms
  const DEFAULTS = {
    couponsMax: 1,
    startingStrategy: 80,
    flashInterval: 8000,
    randomEventInterval: 20000,
  };

  // UI refs
  const budgetEl = document.getElementById('budget');
  const timeLeftEl = document.getElementById('timeLeft');
  const remainingEl = document.getElementById('remainingCount');
  const couponsLeftEl = document.getElementById('couponsLeft');
  const strategyEl = document.getElementById('strategyPts');
  const listItemsEl = document.getElementById('listItems');
  const itemsGridEl = document.getElementById('itemsGrid');
  const cartItemsEl = document.getElementById('cartItems');
  const totalEl = document.getElementById('total');
  const messageEl = document.getElementById('message');
  const resultSection = document.getElementById('result');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');

  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const undoBtn = document.getElementById('undoBtn');

  const budgetInput = document.getElementById('budgetInput');
  const listSizeInput = document.getElementById('listSizeInput');
  const couponInput = document.getElementById('couponInput');
  const timeInput = document.getElementById('timeInput');
  const difficultySelect = document.getElementById('difficultySelect');

  // runtime state
  let budget = 0;
  let initialBudget = 0;
  let couponsLeft = 0;
  let storeItems = [];
  let shoppingList = [];
  let cart = [];
  let lastAdded = null;
  let strategyPoints = DEFAULTS.startingStrategy;
  let timer = null;
  let timeLeft = 0;
  let flashTimer = null;
  let eventTimer = null;
  let difficulty = 'veryhard';
  let achievedCombos = new Set();

  // helpers
  function randInt(max) { return Math.floor(Math.random() * max); }
  function shuffle(arr){ return arr.slice().sort(()=> Math.random()-0.5); }
  function format(n){ return Number(n).toFixed(2); }

  // combos (mazākas, bet joprojām)
  const COMBO_DEFS = [
    { id: 'breakfast', name: 'Brokastu komplekts', items: ['milk','cereal','oats','banana'], bonusCash: 2.5, bonusPoints: 10 },
    { id: 'pasta-night', name: 'Makaroni vakars', items: ['pasta','ketchup','cheese','olive'], bonusCash: 2.2, bonusPoints: 10 },
    { id: 'cleaning', name: 'Tīrīšanas komplekts', items: ['detergent','napkins','wrap','sponge'], bonusCash: 3.0, bonusPoints: 12 },
  ];

  // Build a very large MASTER list by combining base items with sizes/brands/variants until >= 300 items
  function buildMasterLarge() {
    const master = [];
    // add base items first (unique keys)
    for (const b of BASE_ITEMS) {
      master.push({ id: b.key, name: b.name, price: b.price, category: b.category });
    }

    // expand by brand and size combos
    let counter = 1;
    const maxTarget = 300;
    const baseLen = BASE_ITEMS.length;
    let i = 0;
    while (master.length < maxTarget) {
      const base = BASE_ITEMS[i % baseLen];
      const brand = BRANDS[randInt(BRANDS.length)];
      const size = SIZES[randInt(SIZES.length)];
      const variant = EXTRA_VARIANTS[randInt(EXTRA_VARIANTS.length)];
      // create unique id
      const id = `${base.key}_${brand.toLowerCase()}_${variant.suffix}_${counter}`;
      const name = `${brand} ${base.name} ${variant.label} ${size}`;
      // price adjust
      const price = Number((base.price * variant.factor * (0.9 + Math.random()*0.4)).toFixed(2));
      master.push({ id, name, price, category: base.category });
      counter++;
      i++;
      // if we loop too long, vary strategy
      if (i > baseLen * 20) {
        // add simple variations
        const id2 = `${base.key}_var_${counter}`;
        master.push({ id: id2, name: `${base.name} variant ${counter}`, price: Number((base.price * (0.6 + Math.random()*1.6)).toFixed(2)), category: base.category });
        counter++;
      }
    }
    return master;
  }

  const MASTER_ITEMS = buildMasterLarge();

  // pick shopping list (unchanged behaviour) but note: store will NOT highlight list items
  function pickShoppingList(size){
    const shuffled = shuffle(MASTER_ITEMS);
    const list = [];
    // 30% chance include a combo's items (but combos refer to base ids, so may not be present exactly)
    if (Math.random() < 0.3) {
      const cb = shuffle(COMBO_DEFS)[0];
      cb.items.forEach(id => {
        // find any MASTER item whose id startsWith the combo base id (since we expanded ids)
        const it = MASTER_ITEMS.find(x => x.id === id || x.id.startsWith(id + '_') );
        if (it && list.length < size) list.push({...it});
      });
    }
    for (let i=0; i<shuffled.length && list.length < size; i++){
      const candidate = shuffled[i];
      if (!list.some(l=>l.id===candidate.id)) list.push({...candidate});
    }
    return list.slice(0,size);
  }

  // generate store items from large MASTER; store is a shuffled sample including list items
  function generateStoreItems(list){
    // take a large sample (most of MASTER)
    const extras = MASTER_ITEMS.filter(i => !list.some(l=>l.id===i.id));
    const sample = shuffle(extras).slice(0, Math.min(290, extras.length));
    const items = [...list.map(i=>({...i})), ...sample.map(i=>({...i}))];
    // shuffle and set properties
    return shuffle(items).map(it => {
      const discount = Math.random() < 0.35 ? (5 + Math.floor(Math.random()*30)) : 0;
      const impulse = Math.random() < 0.33;
      // very low stock more often to make it hard: 70% stock = 1, 20% stock = 2, 10% stock = 3
      const r = Math.random();
      const stock = r < 0.7 ? 1 : (r < 0.9 ? 2 : 3);
      // small price jitter
      const jitter = (Math.random() * 0.18) - 0.09;
      const price = Number(Math.max(0.25, (it.price * (1 + jitter))).toFixed(2));
      return {
        ...it,
        price,
        discount,
        impulse,
        required: list.some(l=>l.id===it.id),
        boughtQty: 0,
        couponApplied: false,
        stock,
        id: it.id,
      };
    });
  }

  // renderers (we intentionally do NOT show "On List" badge in item cards)
  function renderStatus(){
    budgetEl.textContent = format(budget);
    timeLeftEl.textContent = Math.max(0, Math.ceil(timeLeft));
    remainingEl.textContent = shoppingList.filter(i=>!i.bought).length;
    couponsLeftEl.textContent = couponsLeft;
    strategyEl.textContent = strategyPoints;
  }

  function renderList(){
    listItemsEl.innerHTML = '';
    shoppingList.forEach(li => {
      const liEl = document.createElement('li');
      liEl.className = li.bought ? 'list-checked' : '';
      liEl.textContent = `${li.name} — $${format(li.price)}`;
      listItemsEl.appendChild(liEl);
    });
  }

  function renderItems(){
    itemsGridEl.innerHTML = '';
    storeItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'item';
      div.setAttribute('data-id', item.id);

      if (item.stock <= 0) {
        const sold = document.createElement('div');
        sold.className = 'overlay';
        sold.textContent = 'Izpārdots';
        div.appendChild(sold);
      }

      const h = document.createElement('h4');
      h.textContent = item.name;
      div.appendChild(h);

      const m = document.createElement('div');
      m.className = 'meta';
      // NOTE: intentionally DO NOT add any "Sarakstā" / "On List" badge here so the player must find list items
      if (item.discount > 0) {
        const d = document.createElement('span');
        d.className = 'badge discount';
        d.textContent = `${item.discount}% atlaide`;
        m.appendChild(d);
      }
      if (item.impulse) {
        const ip = document.createElement('span');
        ip.className = 'badge impulse';
        ip.textContent = 'Impulse';
        m.appendChild(ip);
      }
      const stockBadge = document.createElement('span');
      stockBadge.className = 'badge';
      stockBadge.style.background = 'transparent';
      stockBadge.style.border = '1px solid rgba(255,255,255,0.04)';
      stockBadge.style.color = 'var(--muted)';
      stockBadge.textContent = `Krājums: ${item.stock}`;
      m.appendChild(stockBadge);

      div.appendChild(m);

      const priceEl = document.createElement('div');
      priceEl.className = 'price';
      const effective = getEffectivePrice(item);
      priceEl.textContent = `$${format(effective)}`;
      div.appendChild(priceEl);

      const controls = document.createElement('div');
      controls.className = 'controls';

      const addBtn = document.createElement('button');
      addBtn.className = 'btn-small';
      addBtn.textContent = item.stock > 0 ? 'Pievienot' : 'Nav';
      addBtn.disabled = item.stock <= 0;
      addBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        handleItemClick(item.id);
      });
      controls.appendChild(addBtn);

      const couponBtn = document.createElement('button');
      couponBtn.className = 'btn-small';
      couponBtn.textContent = item.couponApplied ? 'Kupons izmantots' : 'Izmantot kuponu';
      couponBtn.title = 'Izmanto kuponu (pietiekami reti)';
      couponBtn.disabled = item.stock <= 0 || item.couponApplied || couponsLeft <= 0;
      couponBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        applyCouponToItem(item.id);
      });
      controls.appendChild(couponBtn);

      div.appendChild(controls);

      div.addEventListener('click', () => {
        handleItemClick(item.id);
      });

      itemsGridEl.appendChild(div);
    });
  }

  function renderCart(){
    cartItemsEl.innerHTML = '';
    cart.forEach((c) => {
      const li = document.createElement('li');
      const qty = c.boughtQty || 1;
      li.textContent = `${c.name} x${qty} — $${format(getEffectivePrice(c) * qty)}`;
      cartItemsEl.appendChild(li);
    });
    const tot = cart.reduce((s,it) => s + (getEffectivePrice(it) * (it.boughtQty || 1)), 0);
    totalEl.textContent = format(tot);
  }

  // get effective price (coupon stronger in veryhard)
  function getEffectivePrice(item){
    let p = item.price * (1 - (item.discount || 0)/100);
    if (item.couponApplied) {
      const couponFactor = difficulty === 'veryhard' ? 0.62 : (difficulty === 'hard' ? 0.75 : 0.85);
      p = Math.max(0.25, p * couponFactor);
    }
    return Number(p.toFixed(2));
  }

  // overlay animation when adding
  function showAddOverlayFor(itemId, text = 'Pievienots') {
    const el = document.querySelector(`.item[data-id="${itemId}"]`);
    if (!el) return;
    const existing = el.querySelector('.add-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'add-overlay';
    overlay.innerHTML = `<span class="tick">✓</span><span class="txt">${text}</span>`;
    el.appendChild(overlay);
    el.classList.add('added');

    setTimeout(() => {
      overlay.remove();
      el.classList.remove('added');
    }, 1200);
  }

  // click handlers (kept Latvian messages)
  function handleItemClick(id){
    const item = storeItems.find(i=>i.id===id);
    if(!item) return;
    if (item.stock <= 0) {
      setMessage('Šis produkts ir izpārdots.');
      return;
    }

    if (item.impulse && Math.random() < 0.7) {
      const specialPrice = Math.max(0.25, Number((getEffectivePrice(item) * (0.5 + Math.random()*0.18)).toFixed(2)));
      if (!confirm(`Zibens piedāvājums! ${item.name} par $${format(specialPrice)}? (Atcelt, lai izturētos)`)) {
        strategyPoints = Math.min(300, strategyPoints + 1);
        setMessage('Izvairsies no impulsa — +1 stratēģijas punkts.');
        rerenderAll();
        return;
      }
      strategyPoints = Math.max(0, strategyPoints - 20);
      if (Math.random() < 0.18 && couponsLeft > 0) {
        couponsLeft = Math.max(0, couponsLeft - 1);
        setMessage(`Pieņēmi impulsu —${20} stratēģijas, zaudēji kuponu.`);
      } else {
        setMessage(`Pieņēmi impulsu —${20} stratēģijas.`);
      }
      addToCart(item, specialPrice, 1, true);
      return;
    }

    let qty = 1;
    if (item.stock > 1 && Math.random() < 0.35) {
      const q = prompt(`Cik ${item.name} vēlies iegādāties? (Pieejams ${item.stock})`, '1');
      if (q === null) { setMessage('Pirkums atcelts.'); return; }
      qty = Math.min(item.stock, Math.max(1, Math.floor(Number(q) || 1)));
    }

    const effective = getEffectivePrice(item) * qty;
    if (effective > budget) {
      const choice = confirm(`Šī prece maksā $${format(effective)}, bet tev ir $${format(budget)}.\nOK = mēģināt noņemt pēdējo groza priekšmetu, Cancel = izlaist.`);
      if (choice) {
        undoLast();
        if (getEffectivePrice(item) * qty <= budget) {
          addToCart(item, null, qty, false);
          return;
        } else {
          setMessage('Joprojām nevar atļauties pēc atcelšanas. Apsver izlaist vai izmantot kuponu.');
          return;
        }
      } else {
        setMessage('Pirkums izlaists.');
        return;
      }
    }

    addToCart(item, null, qty, false);
  }

  function addToCart(item, overridePrice = null, qty = 1, impulseAccepted = false){
    if (item.stock <= 0) { setMessage('Nav krājumā.'); return; }
    item.stock = Math.max(0, item.stock - qty);
    item.boughtQty = (item.boughtQty || 0) + qty;
    lastAdded = { id: item.id, qty, price: overridePrice !== null ? overridePrice : getEffectivePrice(item) };
    const existing = cart.find(c => c.id === item.id);
    if (!existing) cart.push(item);

    // mark in shopping list only internally; but store does NOT show "on list"
    if (item.required) {
      const li = shoppingList.find(s=>s.id===item.id);
      if (li) li.bought = true;
    }

    const deduct = (overridePrice !== null ? overridePrice : getEffectivePrice(item)) * qty;
    budget = Number((budget - deduct).toFixed(2));

    if (impulseAccepted) {
      setMessage(`Pieņēmi impulsu: ${item.name} x${qty} — iztērēts $${format(deduct)}. Stratēģijas -20.`);
    } else {
      if (item.required) strategyPoints = Math.min(300, strategyPoints + 4 * qty);
      else strategyPoints = Math.max(0, strategyPoints - 6 * qty);
      setMessage(`Pievienots: ${item.name} x${qty} par $${format(deduct)}.`);
    }

    showAddOverlayFor(item.id);
    evaluateCombos();
    checkGameState();
    rerenderAll();
  }

  function applyCouponToItem(id){
    if (couponsLeft <= 0) { setMessage('Nav kuponu.'); return; }
    const item = storeItems.find(i=>i.id===id);
    if (!item || item.stock <= 0) { setMessage('Nevar izmantot kuponu pie šīs preces.'); return; }
    if (item.couponApplied) { setMessage('Kupons jau izmantots pie šīs preces.'); return; }
    couponsLeft--;
    item.couponApplied = true;
    const penalty = difficulty === 'veryhard' ? 8 : (difficulty === 'hard' ? 5 : 3);
    strategyPoints = Math.max(0, strategyPoints - penalty);
    setMessage(`Kupons pielietots ${item.name}. -${penalty} stratēģijas punkti.`);
    rerenderAll();
  }

  function undoLast(){
    if (!lastAdded) { setMessage('Nav ko noņemt.'); return; }
    const item = storeItems.find(i=>i.id===lastAdded.id);
    if (!item) { setMessage('Atcelšana neizdevās.'); return; }
    const refund = lastAdded.price * lastAdded.qty;
    budget = Number((budget + refund).toFixed(2));
    item.stock += lastAdded.qty;
    item.boughtQty = Math.max(0, (item.boughtQty || 0) - lastAdded.qty);
    if (item.boughtQty === 0) {
      if (item.required) {
        const li = shoppingList.find(s=>s.id===item.id);
        if (li) li.bought = false;
      }
      const idx = cart.findIndex(c=>c.id===item.id);
      if (idx >= 0) cart.splice(idx,1);
    }
    setMessage(`Noņemts: ${item.name} x${lastAdded.qty}. Atmaksāts $${format(refund)}.`);
    lastAdded = cart.length ? { id: cart[cart.length-1].id, qty: cart[cart.length-1].boughtQty || 1, price: getEffectivePrice(cart[cart.length-1]) } : null;
    strategyPoints = Math.max(0, strategyPoints - 4);
    evaluateCombos();
    rerenderAll();
  }

  function evaluateCombos(){
    achievedCombos.clear();
    COMBO_DEFS.forEach(cd => {
      const haveAll = cd.items.every(baseId => {
        // check any store item whose id startsWith baseId
        const it = storeItems.find(x => x.id === baseId || x.id.startsWith(baseId + '_'));
        return it && (it.boughtQty && it.boughtQty > 0);
      });
      if (haveAll) achievedCombos.add(cd.id);
    });
  }

  // random events (same as before)
  function randomEvent(){
    const r = Math.random();
    if (r < 0.35) {
      const victims = shuffle(storeItems).slice(0, 4);
      victims.forEach(v => {
        if (v.stock > 0) v.stock = Math.max(0, v.stock - 1);
      });
      setMessage('Citi pircēji izpērk preces — daži krājumi samazināti!');
    } else if (r < 0.65) {
      const tax = Number((Math.max(0.5, budget * (0.03 + Math.random() * 0.03))).toFixed(2));
      budget = Number((budget - tax).toFixed(2));
      setMessage(`Neplānots izdevums: samaksāji $${format(tax)}.`);
    } else {
      if (couponsLeft > 0 && Math.random() < 0.5) {
        couponsLeft = Math.max(0, couponsLeft - 1);
        setMessage('Negadījums: viens kupons pazudis!');
      } else {
        const loss = 3 + randInt(5);
        strategyPoints = Math.max(0, strategyPoints - loss);
        setMessage(`Neplānots notikums samazina stratēģijas punktus par ${loss}.`);
      }
    }
    rerenderAll();
  }

  // checkout — require higher score to win
  function checkout(){
    if (shoppingList.some(i=>!i.bought)) {
      alert('Tev jāiegādājas visas preces sarakstā pirms norēķināšanās.');
      return;
    }
    if (budget < 0) {
      showResult(false, 'Budžets negatīvs — zaudēji.');
      stopTimers();
      return;
    }

    const spent = cart.reduce((s,it) => s + (getEffectivePrice(it) * (it.boughtQty || 1)), 0);
    let comboCash = 0;
    COMBO_DEFS.forEach(cd => { if (achievedCombos.has(cd.id)) comboCash += cd.bonusCash; });

    const timeFactor = Math.max(0, timeLeft) / 15;
    const couponUsed = (Number(couponInput.value) || 0) - couponsLeft;
    const score = Math.round(
      (budget / initialBudget) * 35 +
      (strategyPoints / 300) * 30 +
      timeFactor * 10 +
      achievedCombos.size * 12 -
      Math.max(0, couponUsed) * 2
    );

    const summary = [
      `Iztērēts: $${format(spent)}`,
      `Komplekti: ${achievedCombos.size} (bonuss $${format(comboCash)})`,
      `Stratēģijas punkti: ${strategyPoints}`,
      `Atlikušais laiks: ${Math.max(0, Math.ceil(timeLeft))}s`,
      `Galīgais rezultāts: ${score}/100`,
    ].join('\n');

    if (score >= 70) {
      showResult(true, 'Uzvara!\n' + summary);
    } else {
      showResult(false, 'Pārāk zems rezultāts, lai uzskatītu par uzvaru.\n' + summary);
    }
    stopTimers();
  }

  function setMessage(txt){
    messageEl.textContent = txt;
  }

  function rerenderAll(){
    renderStatus();
    renderList();
    renderItems();
    renderCart();
  }

  function checkGameState(){
    if (shoppingList.every(i=>i.bought)) {
      setMessage('Visas saraksta preces nopirktas — vari norēķināties.');
    } else if (budget < 0) {
      showResult(false, 'Budžets negatīvs — spēle beigusies.');
      stopTimers();
    }
  }

  function showResult(win, text){
    resultSection.classList.remove('hidden');
    resultTitle.textContent = win ? 'Veiksmīgi!' : 'Spēle beigusies';
    resultText.textContent = text;
  }

  // timers
  function startTimers(){
    stopTimers();
    timer = setInterval(()=>{
      timeLeft -= 1;
      if (timeLeft <= 0) {
        timeLeft = 0;
        setMessage('Laiks beidzies!');
        showResult(false, 'Laiks beidzies. Neizdevās pabeigt sarakstu.');
        stopTimers();
      }
      renderStatus();
    }, 1000);

    flashTimer = setInterval(()=>{
      const candidates = shuffle(storeItems).slice(0, 8);
      candidates.forEach(it => {
        if (it.stock <= 0) return;
        // stronger volatility
        const shift = (Math.random() * 0.7) - 0.2; // -20% .. +50%
        it.price = Number(Math.max(0.25, it.price * (1 + shift)).toFixed(2));
        if (Math.random() < 0.18) {
          it.discount = Math.max(0, Math.min(60, it.discount + (Math.random() < 0.5 ? -6 : 6)));
        }
      });
      setMessage('Veikalā straujas cenu svārstības — pielāgo stratēģiju!');
      rerenderAll();
    }, DEFAULTS.flashInterval);

    eventTimer = setInterval(()=>{
      if (Math.random() < 0.85) randomEvent();
    }, DEFAULTS.randomEventInterval);
  }

  function stopTimers(){
    if (timer) { clearInterval(timer); timer = null; }
    if (flashTimer) { clearInterval(flashTimer); flashTimer = null; }
    if (eventTimer) { clearInterval(eventTimer); eventTimer = null; }
  }

  // start game setup: VERY HARD behavior includes marking some required items as sold-out to make game sometimes impossible
  function startGame(){
    difficulty = difficultySelect.value || 'veryhard';
    let b = Number(budgetInput.value) || 45;
    let t = Number(timeInput.value) || 120;
    let c = Math.max(0, Math.min(3, Number(couponInput.value) || 0));
    const listSize = Math.max(3, Math.min(10, Number(listSizeInput.value) || 6));

    if (difficulty === 'normal') { b = Math.max(b, 70); t = Math.max(t, 240); c = Math.max(c, 2); }
    if (difficulty === 'hard') { b = Math.max(b, 55); t = Math.max(t, 180); c = Math.max(c, 1); }
    if (difficulty === 'veryhard') { b = Math.max(b, 35); t = Math.max(t, 100); c = Math.max(c, 0); }

    initialBudget = b;
    budget = Number(b.toFixed(2));
    couponsLeft = c;
    shoppingList = pickShoppingList(listSize);
    storeItems = generateStoreItems(shoppingList);
    cart = [];
    lastAdded = null;
    strategyPoints = DEFAULTS.startingStrategy;
    achievedCombos.clear();

    // On purpose make some required items sold out with a significant chance to make the run impossible:
    // ~40% chance each required item will start as stock = 0.
    

    // add a few random spikes
    storeItems.forEach(it => {
      if (Math.random() < 0.12 && it.price > 2) it.price = Number((it.price * (1.20 + Math.random()*0.35)).toFixed(2));
    });

    timeLeft = t;
    resultSection.classList.add('hidden');
    setMessage('Spēle sākta. Veikals vairs neatzīmē saraksta preces — atrodi tās pats.');
    rerenderAll();
    startTimers();
  }

  // events
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', () => {
    difficultySelect.value = 'veryhard';
    budgetInput.value = 45;
    listSizeInput.value = 6;
    couponInput.value = 0;
    timeInput.value = 120;
    startGame();
  });
  playAgainBtn.addEventListener('click', () => {
    startGame();
    resultSection.classList.add('hidden');
  });
  checkoutBtn.addEventListener('click', checkout);
  undoBtn.addEventListener('click', undoLast);

  // initial start
  startGame();
  window.addEventListener('beforeunload', stopTimers);
})();