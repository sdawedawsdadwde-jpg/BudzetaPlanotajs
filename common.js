import { db, auth } from "./firebase.js";
import { ref, onValue, update, set, remove } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

export let uid = null;
export let transactions = [];
export let budgets = [];
export let settings = {
  theme: "theme-dark",
  currency: "€",
  language: "lv",
  advancedCharts: true,
  accentColor: "#00e5ff",
  categories: {},
  plannerCategories: {},
  subscription: { plan: "free", startedAt: null, expiresAt: null },
  autoPurge: null // avoid undefined writes
};

const txListeners = [];
const budgetListeners = [];
const settingsListeners = [];

export function onTransactions(cb){ txListeners.push(cb); if (transactions.length) cb(transactions); }
export function onBudgets(cb){ budgetListeners.push(cb); if (budgets.length) cb(budgets); }
export function onSettings(cb){ settingsListeners.push(cb); cb(settings); }

onAuthStateChanged(auth, user => {
  if (!user){ uid=null; return; }
  uid = user.uid;
  const txRef = ref(db, `users/${uid}/transactions`);
  onValue(txRef, snap => {
    const data = snap.val() || {};
    transactions = Object.entries(data).map(([id,v]) => ({ id, ...v }));
    txListeners.forEach(fn=>fn(transactions));
  });
  const bRef = ref(db, `users/${uid}/budgets`);
  onValue(bRef, snap => {
    const data = snap.val() || {};
    budgets = Object.entries(data).map(([id,v]) => ({ id, ...v }));
    budgetListeners.forEach(fn=>fn(budgets));
  });
  loadUserSettingsApply();
});

export async function loadUserSettingsApply(){
  if (!uid) return;
  const sRef = ref(db, `users/${uid}/settings`);
  onValue(sRef, snap => {
    const data = snap.val();
    const defaultCats = {
      alga: { name:"Alga", color:"#00d68f", createdAt: Date.now() },
      premija: { name:"Prēmija", color:"#42f59e", createdAt: Date.now() },
      ediens: { name:"Ēdiens", color:"#ff8ba7", createdAt: Date.now() },
      majoklis: { name:"Mājoklis", color:"#8a7dff", createdAt: Date.now() },
      transports: { name:"Transports", color:"#ffc971", createdAt: Date.now() },
      izklaide: { name:"Izklaide", color:"#ff5470", createdAt: Date.now() },
      veseliba: { name:"Veselība", color:"#7ad7f0", createdAt: Date.now() },
      cits: { name:"Cits", color:"#c77dff", createdAt: Date.now() }
    };

    if (data){
      settings = {
        ...settings,
        ...data,
        categories: data.categories || settings.categories,
        plannerCategories: data.plannerCategories || settings.plannerCategories,
        subscription: data.subscription || settings.subscription,
        autoPurge: data.autoPurge ?? settings.autoPurge
      };
    } else {
      settings = {
        ...settings,
        categories: defaultCats,
        plannerCategories: settings.plannerCategories,
        subscription: settings.subscription || { plan: "free", startedAt: null, expiresAt: null },
        autoPurge: settings.autoPurge ?? null
      };
      set(sRef, settings);
    }

    applyTheme(settings.theme);
    applyAccent(settings.accentColor);
    settingsListeners.forEach(fn=>fn(settings));
    hydrateDynamicSelects();
    applyI18n();

    try { runAutoPurgeIfNeeded(); } catch(e){ console.warn("Auto purge check failed:", e); }
  });
}

export function applyTheme(theme){
  const body = document.body;
  body.classList.remove("theme-dark","theme-dusk","theme-aurora","theme-mono");
  body.classList.add(theme);
}

export function applyAccent(color){
  document.documentElement.style.setProperty("--accent-user", color);
}

export function saveSettings(partial){
  if (!uid) return;
  // strip undefined to avoid validation errors
  const clean = Object.fromEntries(Object.entries(partial).filter(([,v]) => v !== undefined));
  settings = { ...settings, ...clean };
  if (Object.keys(clean).length) update(ref(db, `users/${uid}/settings`), clean);
  settingsListeners.forEach(fn=>fn(settings));
  if (clean.theme) applyTheme(clean.theme);
  if (clean.accentColor) applyAccent(clean.accentColor);
  if (clean.language) applyI18n();
}

/**
 * Purge transactions from the current user's DB.
 * - type: "income" | "expense" | "both"
 * - olderThanDays: optional number; if provided, only delete tx older than that many days
 * Returns: { deleted: number }
 */
export async function purgeTransactions({ type = "both", olderThanDays = null } = {}) {
  if (!uid) throw new Error("No user");
  const toRemove = [];
  const now = Date.now();
  for (const t of transactions){
    const isIncome = t.type === "income";
    const isExpense = t.type === "expense";
    if (type === "income" && !isIncome) continue;
    if (type === "expense" && !isExpense) continue;
    if (type === "both" && !(isIncome || isExpense)) continue;
    if (olderThanDays && t.date){
      const txTime = new Date(t.date).getTime();
      if (isNaN(txTime)) continue;
      if (now - txTime < olderThanDays * 24*60*60*1000) continue;
    }
    if (t.id) toRemove.push(t.id);
  }

  const promises = toRemove.map(id => remove(ref(db, `users/${uid}/transactions/${id}`)).catch(e=>{
    console.warn("Failed to remove tx", id, e);
  }));
  await Promise.all(promises);
  return { deleted: toRemove.length };
}

/**
 * Check settings.autoPurge and run purge if a scheduled run is due.
 * autoPurge expected shape:
 * { enabled: boolean, type: "income"|"expense"|"both", interval: "monthly", lastRun: timestamp }
 */
export async function runAutoPurgeIfNeeded(){
  try {
    const ap = settings.autoPurge;
    if (!ap || !ap.enabled) return;
    const interval = ap.interval || "monthly";
    if (interval !== "monthly") return;

    const lastRun = Number(ap.lastRun || 0);
    const now = Date.now();
    const THIRTY_DAYS = 1000*60*60*24*30;

    if (!lastRun || (now - lastRun >= THIRTY_DAYS)) {
      const purgetype = ap.type || "both";
      const result = await purgeTransactions({ type: purgetype });
      const newAuto = { ...ap, lastRun: now };
      saveSettings({ autoPurge: newAuto });
      console.info("Auto purge ran:", purgetype, result.deleted, "transactions removed.");
    }
  } catch (e) {
    console.warn("runAutoPurgeIfNeeded error:", e);
  }
}

export function addCategory(name, color){
  if (!uid) return;
  const id = name.toLowerCase().replace(/[^a-zāčēģīķļņšūž0-9]+/gi,"_")+"_"+Date.now();
  settings.categories[id] = { name, color, createdAt: Date.now() };
  saveSettings({ categories: settings.categories });
}

export function deleteCategory(catId){
  if (!uid || !settings.categories[catId]) return;
  delete settings.categories[catId];
  saveSettings({ categories: settings.categories });
}

export function addPlannerCategory(name, color){
  if (!uid) return;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/gi,"_")+"_"+Date.now();
  settings.plannerCategories[id] = { name, color, createdAt: Date.now() };
  saveSettings({ plannerCategories: settings.plannerCategories });
}

export function deletePlannerCategory(catId){
  if (!uid || !settings.plannerCategories[catId]) return;
  delete settings.plannerCategories[catId];
  saveSettings({ plannerCategories: settings.plannerCategories });
}

export function getCategoryList(){
  return Object.entries(settings.categories).map(([id,obj])=>({ id, ...obj })).sort((a,b)=> a.name.localeCompare(b.name));
}
export function getPlannerCatList(){
  return Object.entries(settings.plannerCategories).map(([id,obj])=>({ id, ...obj })).sort((a,b)=> a.name.localeCompare(b.name));
}

export function hydrateDynamicSelects(){
  const catSelects = document.querySelectorAll("select#category, select#bCategory, select#filterCategory");
  const list = getCategoryList();
  catSelects.forEach(sel=>{
    const isFilter = sel.id === "filterCategory";
    const current = sel.value;
    sel.innerHTML = "";
    if (isFilter){
      const optAll = document.createElement("option");
      optAll.value="all";
      optAll.setAttribute("data-i18n","option_all");
      optAll.textContent = translate("option_all");
      sel.appendChild(optAll);
    }
    list.forEach(c=>{
      const o = document.createElement("option");
      o.value = c.name;
      o.textContent = c.name;
      sel.appendChild(o);
    });
    if (sel.id==="category"){
      const oAdd = document.createElement("option");
      oAdd.value="__new__";
      oAdd.textContent="+ Jauna kategorija…";
      sel.appendChild(oAdd);
    }
    if (current) sel.value = current;
  });
  const plannerCatSelect = document.querySelector("#planCatSelect");
  if (plannerCatSelect){
    const current = plannerCatSelect.value;
    plannerCatSelect.innerHTML = "";
    getPlannerCatList().forEach(pc=>{
      const o = document.createElement("option");
      o.value = pc.name;
      o.textContent = pc.name;
      plannerCatSelect.appendChild(o);
    });
    if (current) plannerCatSelect.value=current;
  }
}

export function formatMoney(n){ return settings.currency + (Number(n)||0).toFixed(2); }

// Shared i18n dictionary (lv/en). Add any new data-i18n keys here.
const dict = {
  lv: {
    // nav / auth
    nav_budget_planning: "Budžeta Plānošana",
    nav_dashboard: "Pārskats",
    nav_goals: "Mērķi",
    nav_reports: "Pārskati",
    nav_planner: "Plānotājs",
    nav_notes: "Piezīmes",
    nav_settings: "Iestatījumi",
    logout_btn: "Izrakstīties",
    // settings
    nav_settings: "Iestatījumi",
    themes_heading: "Tēmas",
    accent_color_label: "Akcenta Krāsa",
    theme_auto_save: "Saglabājas automātiski.",
    basic_settings_heading: "Pamata Iestatījumi",
    currency_label: "Valūta",
    language_label: "Valoda",
    adv_charts_label: "Grafiki",
    enabled: "Ieslēgti",
    disabled: "Izslēgti",
    btn_save_settings: "Saglabāt Iestatījumus",
    transaction_categories_heading: "Transakciju Kategorijas",
    field_category_name: "Nosaukums",
    field_color: "Krāsa",
    btn_add_category: "Pievienot",
    planner_categories_heading: "Plānotāja Kategorijas",
    btn_add_planner_cat: "Pievienot Plāna Kat.",
    data_export_heading: "Datu Eksports",
    btn_download_csv: "Lejupielādēt CSV",
    btn_download_json: "Lejupielādēt JSON",
    export_future: "Drīzumā: PDF, Excel, analītiskie atskaišu komplekti.",
    option_all: "Visas",
    // dashboard / transactions
    stat_income: "Ienākumi",
    stat_expense: "Izdevumi",
    stat_balance: "Bilance",
    stat_month_trend: "Mēneša Tendence",
    add_transaction: "Pievienot Transakciju",
    field_type: "Tips",
    option_income: "Ienākumi",
    option_expense: "Izdevumi",
    field_category: "Kategorija",
    category_custom_hint: "Iestatījumos vari pievienot savas kategorijas.",
    field_amount: "Summa",
    field_date: "Datums",
    field_notes: "Piezīmes",
    btn_save: "Saglabāt",
    btn_clear: "Notīrīt",
    chart_expense_by_category: "Izdevumi pa kategorijām",
    charts_disabled: "Grafiki ir izslēgti",
    chart_daily_trend: "Dienas Tendance",
    chart_cumulative: "Kumulatīvie Ienākumi vs Izdevumi",
    transactions_heading: "Transakcijas",
    filter_type: "Tips",
    filter_category: "Kategorija",
    col_date: "Datums",
    col_type: "Tips",
    col_category: "Kategorija",
    col_notes: "Piezīmes",
    col_amount: "Summa",
    col_actions: "Darbības",
    // budgets
    goals_title: "Budžeta Mērķi",
    new_goal_heading: "Jauns Budžeta Mērķis",
    field_limit_month: "Mēneša Limits",
    btn_add_goal: "Pievienot Mērķi",
    active_goals: "Aktīvie Budžeta Limiti",
    // planner
    new_plan_heading: "Jauns Plāns",
    field_plan_name: "Plāna Nosaukums",
    btn_add_plan: "Izveidot Plānu",
    plans_list_heading: "Mani Plāni",
    plan_items_heading: "Plāna Posteņi",
    field_select_plan: "Plāns",
    field_item_title: "Posteņa Nosaukums",
    field_item_category: "Kategorija",
    planner_cat_hint: "Plāna kategorijas vari pievienot Iestatījumos (Plānotāja kategorijas).",
    field_item_cost: "Summa",
    btn_add_item: "Pievienot Posteni",
    // notes
    new_note_heading: "Jauna Piezīme",
    field_note_title: "Nosaukums",
    field_note_body: "Saturs",
    btn_add_note: "Saglabāt Piezīmi",
    notes_list_heading: "Manas Piezīmes",
    // reports
    // (only charts_disabled used here and already above)
    // misc
    option_all: "Visi / Visas"
  },
  en: {
    // nav / auth
    nav_budget_planning: "Budget Planning",
    nav_dashboard: "Dashboard",
    nav_goals: "Goals",
    nav_reports: "Reports",
    nav_planner: "Planner",
    nav_notes: "Notes",
    nav_settings: "Settings",
    logout_btn: "Log out",
    // settings
    themes_heading: "Themes",
    accent_color_label: "Accent color",
    theme_auto_save: "Auto-saves.",
    basic_settings_heading: "Basic Settings",
    currency_label: "Currency",
    language_label: "Language",
    adv_charts_label: "Charts",
    enabled: "Enabled",
    disabled: "Disabled",
    btn_save_settings: "Save Settings",
    transaction_categories_heading: "Transaction Categories",
    field_category_name: "Name",
    field_color: "Color",
    btn_add_category: "Add",
    planner_categories_heading: "Planner Categories",
    btn_add_planner_cat: "Add Planner Cat.",
    data_export_heading: "Data Export",
    btn_download_csv: "Download CSV",
    btn_download_json: "Download JSON",
    export_future: "Coming soon: PDF, Excel, analytic report bundles.",
    option_all: "All",
    // dashboard / transactions
    stat_income: "Income",
    stat_expense: "Expenses",
    stat_balance: "Balance",
    stat_month_trend: "Monthly Trend",
    add_transaction: "Add Transaction",
    field_type: "Type",
    option_income: "Income",
    option_expense: "Expense",
    field_category: "Category",
    category_custom_hint: "You can add your own categories in Settings.",
    field_amount: "Amount",
    field_date: "Date",
    field_notes: "Notes",
    btn_save: "Save",
    btn_clear: "Clear",
    chart_expense_by_category: "Expenses by Category",
    charts_disabled: "Charts are disabled",
    chart_daily_trend: "Daily Trend",
    chart_cumulative: "Cumulative Income vs Expenses",
    transactions_heading: "Transactions",
    filter_type: "Type",
    filter_category: "Category",
    col_date: "Date",
    col_type: "Type",
    col_category: "Category",
    col_notes: "Notes",
    col_amount: "Amount",
    col_actions: "Actions",
    // budgets
    goals_title: "Budget Goals",
    new_goal_heading: "New Budget Goal",
    field_limit_month: "Monthly Limit",
    btn_add_goal: "Add Goal",
    active_goals: "Active Budget Limits",
    // planner
    new_plan_heading: "New Plan",
    field_plan_name: "Plan Name",
    btn_add_plan: "Create Plan",
    plans_list_heading: "My Plans",
    plan_items_heading: "Plan Items",
    field_select_plan: "Plan",
    field_item_title: "Item Title",
    field_item_category: "Category",
    planner_cat_hint: "You can add planner categories in Settings.",
    field_item_cost: "Amount",
    btn_add_item: "Add Item",
    // notes
    new_note_heading: "New Note",
    field_note_title: "Title",
    field_note_body: "Content",
    btn_add_note: "Save Note",
    notes_list_heading: "My Notes",
    // reports
    // (charts_disabled reused)
    // misc
    option_all: "All"
  }
};

export function translate(key){
  const lang = settings.language || "lv";
  return dict[lang]?.[key] || key;
}

export function applyI18n(){
  const lang = settings.language || "lv";
  document.documentElement.setAttribute("lang", lang);
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key = el.getAttribute("data-i18n");
    const t = translate(key);
    if (el.tagName === "INPUT" && el.placeholder) return; // keep placeholder unless we add data-i18n-placeholder logic
    el.textContent = t;
  });
}

export function groupByMonth(arr){
  const map = {};
  for (const t of arr){
    const m = (t.date||"").slice(0,7);
    if (!m) continue;
    map[m] = map[m] || [];
    map[m].push(t);
  }
  return map;
}
export function monthOrder(a,b){ return a > b ? 1 : -1; }
export function monthName(ym){
  const [y,m] = ym.split("-");
  const date = new Date(Number(y), Number(m)-1, 1);
  return date.toLocaleDateString(settings.language==="lv"?"lv-LV":"en-US",{ month:"long", year:"numeric" });
}