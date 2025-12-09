import { saveSettings, onSettings } from "./common.js";

const buttons = document.querySelectorAll(".select-plan");
const statusEl = document.getElementById("currentPlan");
const proDownloads = document.getElementById("proDownloads");

onSettings(s => {
  const sub = s?.subscription;
  const plan = sub?.plan || "Free";
  const expires = sub?.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : "";
  statusEl.textContent = `${plan} ${expires ? "• derīgs līdz " + expires : ""}`;
  proDownloads.style.display = plan === "Pro" ? "flex" : "none";
  document.dispatchEvent(new CustomEvent("subscription:updated", { detail:{ plan } }));
});

buttons.forEach(btn => {
  btn.addEventListener("click", async () => {
    const plan = btn.dataset.plan;
    if (!plan) return;

    if (plan === "Free") {
      await saveSettings({ subscription: { plan: "Free" } });
      alert("Pārgāji uz Free!");
      return;
    }

    const ok = confirm(`Apstiprini ${plan} plāna iegādi?`);
    if (!ok) return;
    const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await saveSettings({ subscription: { plan, startedAt: Date.now(), expiresAt: expires } });
    alert(`Aktivizēts ${plan}. Reklāmas izslēgtas un priekšrocības ieslēgtas.`);
  });
});