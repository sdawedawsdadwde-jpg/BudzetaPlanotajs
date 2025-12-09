import { onSettings } from "./common.js";

let plan = "free";

function applyPlan(newPlan) {
  plan = newPlan || "free";
  document.documentElement.dataset.plan = plan;
  document.body.dataset.plan = plan;
  const evt = new CustomEvent("subscription:updated", { detail: { plan } });
  document.dispatchEvent(evt);
}

onSettings(s => {
  const sub = s?.subscription || { plan: "free" };
  applyPlan(sub.plan);
});