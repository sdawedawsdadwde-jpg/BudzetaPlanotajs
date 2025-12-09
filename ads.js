import { onSettings } from "./common.js";

//
// Add your own ads here: title/line/img/url
//
const CREATIVES = [
  { title: "YouTube", line: "Ienāc un skaties, šeit noteikti būs kaut kas priekš tevis!", img: "https://media.giphy.com/media/13Nc3xlO1kGg3S/giphy.gif", url: "https://www.youtube.com/" },
  { title: "Spotify", line: "Atklāj jaunu mūziku un aplādes katrai noskaņai!", img: "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXlnZzIzN2YxajV0ejN3Y3VidmVrdWIzNDc0N293bms2M2pvNzU4eiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/EFGXDUBXcUd131C0CR/giphy.gif", url: "https://www.spotify.com/" },
  { title: "Netflix", line: "Filmas un seriāli, ko var skatīties bez pārtraukuma.", img: "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNGE5ZXN5dHF6bHlibzA3N2Z4ZThudGd4aHJvZmx4aHhoMDFscTJjMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JnvHE3lTHPr3WrSsrl/giphy.gif", url: "https://www.netflix.com/" },
  { title: "HBO Max", line: "Premieres, oriģinālseriāli un kino klasika vienuviet.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOXphMXk5Z2NtdHRwcjN1bXhqYTJlb2xubG90dGF0d2Z2NDdzMGxqZyZlcD12MV9naWZzX3NlYXJjaCZjdT1n/cFetUtXX9ZUlzCuXBh/giphy.gif", url: "https://www.max.com/" },
  { title: "Disney+", line: "Disney, Marvel, Star Wars un Pixar pasaules vienā vietā.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExc28yMDZ0YnR5NWloMHR3aWltYWoxNHJxODVlNjlldWV1Z2g4cmd2eiZlcD12MV9naWZzX3NlYXJjaCZjdT1n/fmGal3W3PNhHa/giphy.gif", url: "https://www.disneyplus.com/" },
  { title: "Twitch", line: "Skaties tiešraides, spēļu turnīrus un čato ar straumētājiem.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZjQ2eXRsMmtxbTc1MmtqaDBwMTNhZThheWk4azBvemRlZXk5dTg1eSZlcD12MV9naWZzX3NlYXJjaCZjdT1n/fWAC87fMPC04h5shaE/giphy.gif", url: "https://www.twitch.tv/" },
  { title: "TikTok", line: "Īsi video, milzīgs humors un trendi katru dienu.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbWQ0M21nN3gxdWQzZ3c5dTkzNmwyaXhxaWg1aW8yeG40MHo2cXMycyZlcD12MV9naWZzX3NlYXJjaCZjdT1n/U3rive8V39QioDjmNF/giphy.gif", url: "https://www.tiktok.com/" },
  { title: "Instagram", line: "Iedvesma, stāsti un foto no visas pasaules.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHUwaHZhbGM4dDBhaHNrdG91M3VocWRzenRjcXVwcTdmbTJ2eGt3byZlcD12MV9naWZzX3NlYXJjaCZjdT1n/QZOxRp5tZTemNQzpgc/giphy.gif", url: "https://www.instagram.com/" },
  { title: "LinkedIn", line: "Veido profesionālus kontaktus un atrodi jaunas iespējas.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExN3lzdHBwMTFwZDJlZWJsd3d0NW10bnpnNTNpOXVtZTF1ejBpMzMxOCZlcD12MV9naWZzX3NlYXJjaCZjdT1n/8r2AZ0fEAFVto15uS4/giphy.gif", url: "https://www.linkedin.com/" },
  { title: "Twitter (X)", line: "Reāllaika sarunas un jaunākās ziņas.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXVsYngzd2RxbXZpOHM0cTU2YTcyNnFnNmpleGR6aGdtM3JhcG04dyZlcD12MV9naWZzX3NlYXJjaCZjdT1n/SMKiEh9WDO6ze/giphy.gif", url: "https://twitter.com/" },
  { title: "Facebook", line: "Sazinies ar draugiem un kopienām visā pasaulē.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdnFhMjhscDR5a2N6NzQwdGxjamx5NzVnZ3J4Njk2OXNnOGV4bzB5NSZlcD12MV9naWZzX3NlYXJjaCZjdT1n/ijEiXYEo9DBxm/giphy.gif", url: "https://www.facebook.com/" },
  { title: "Reddit", line: "Forumos atrodi atbildes, memītes un jaunākās ziņas.", img: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTk3aGN2cTJmcHVlM3IxaDFrNm5zNWd1Yzl4MGgwMXlta2s3ampudSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ZtDnSN82QjH0b4zIVQ/giphy.gif", url: "https://www.reddit.com/" },
  { title: "Pinterest", line: "Idejas un iedvesma projektam, stilam un receptēm.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHUxNzhpYXV5dmo1M2E5dXF3cGdxbXQ4Ymt0bHIwdXR4bnFzZ3V3MSZlcD12MV9naWZzX3NlYXJjaCZjdT1n/Y1OjNo2ULbw9BYvyuP/giphy.gif", url: "https://www.pinterest.com/" },
  { title: "Snapchat", line: "Dalies mirkļos un filtri kļūst par mākslu.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTM0ZmM0Y2dycWJnd2V6cWI2NXp1bDJtNGhkNjRkdWxkY3I2Ynd2ZiZlcD12MV9naWZzX3NlYXJjaCZjdT1n/RlqsZ0HbW9q9w8jfLW/giphy.gif", url: "https://www.snapchat.com/" },
  { title: "GitHub", line: "Hostē kodu, sadarbojies un laižam ci!", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExamJpMmp2M3gyZ2szdDQyamdubTQ4ZGFiMHVhNThzdjFsYmU0bmQ4biZlcD12MV9naWZzX3NlYXJjaCZjdT1n/du3J3cXyzhj75IOgvA/giphy.gif", url: "https://github.com/" }
];

let plan = "free";
let overlayTimer = null;
let rotationTimer = null;

const ROTATION_MIN = 90 * 1000;
const OVERLAY_INTERVAL = 10 * 60 * 1000;

onSettings(s => {
  const sub = s?.subscription;
  applyPlan(sub?.plan || "free");
});

document.addEventListener("subscription:updated", (e) => {
  applyPlan(e.detail?.plan || "free");
});

function applyPlan(p) {
  plan = p || "free";
  if (plan !== "free") {
    removeAds();
    return;
  }
  refreshAds();
}

function refreshAds() {
  removeAds();
  if (plan !== "free") return;
  mountRails();
  showOverlay(true);
  scheduleOverlay();
  scheduleRotation();
}

function removeAds() {
  document.querySelectorAll(".ad-rail").forEach(el => el.remove());
  document.querySelectorAll(".ad-overlay").forEach(el => el.remove());
  if (overlayTimer) clearTimeout(overlayTimer);
  if (rotationTimer) clearInterval(rotationTimer);
}

function pickCreative() { return CREATIVES[Math.floor(Math.random() * CREATIVES.length)]; }

function mountRails() {
  document.querySelectorAll(".ad-rail").forEach(el => el.remove());
  const c = [pickCreative(), pickCreative(), pickCreative(), pickCreative()];
  const left = document.createElement("div");
  left.className = "ad-rail left";
  left.innerHTML = c.slice(0,2).map(x=>box(x)).join("");
  const right = document.createElement("div");
  right.className = "ad-rail right";
  right.innerHTML = c.slice(2,4).map(x=>box(x)).join("");
  document.body.appendChild(left);
  document.body.appendChild(right);
  wireClicks(left);
  wireClicks(right);
}
function box(c){return `
  <div class="ad-box" data-url="${c.url}">
    <div class="ad-bg" style="background-image:url('${c.img}')"></div>
    <div class="ad-glow"></div>
    <div class="ad-content">Reklāma • ${c.title}<br><small>${c.line}</small></div>
  </div>
`; }

function wireClicks(root) {
  root.querySelectorAll(".ad-box").forEach(box => {
    box.addEventListener("click", () => openCreative(box.dataset.url));
  });
}

function openCreative(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener");
}

function scheduleRotation() {
  if (rotationTimer) clearInterval(rotationTimer);
  rotationTimer = setInterval(() => {
    if (plan !== "free") return;
    mountRails();
  }, ROTATION_MIN);
}

function scheduleOverlay() {
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => showOverlay(false), OVERLAY_INTERVAL);
}

function showOverlay(isImmediate) {
  if (plan !== "free") return;

  const c = pickCreative();
  const overlay = document.createElement("div");
  overlay.className = "ad-overlay";
  overlay.innerHTML = `
    <div class="ad-modal">
      <img src="${c.img}" alt="Reklāma">
      <h3>${c.title}</h3>
      <p class="muted small">${c.line}</p>
      <div class="row" style="gap:8px; flex-wrap:wrap;">
        <button class="btn primary small visit-btn">Atvērt</button>
        <button class="btn outline small close-btn">Aizvērt</button>
      </div>
    </div>
  `;

  overlay.querySelector(".visit-btn").addEventListener("click", () => {
    openCreative(c.url);
    overlay.remove();
    if (!isImmediate) scheduleOverlay();
  });
  overlay.querySelector(".close-btn").addEventListener("click", () => {
    overlay.remove();
    if (!isImmediate) scheduleOverlay();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (!isImmediate) scheduleOverlay();
    }
  });
  document.body.appendChild(overlay);
}

// Optional debug helpers
window.adsDebug = {
  refresh: refreshAds,
  remove: removeAds,
  overlay: () => showOverlay(true)
};