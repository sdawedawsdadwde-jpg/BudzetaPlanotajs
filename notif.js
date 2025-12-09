import { onSettings } from "./common.js";

let enabled = false;
let plan = "free";
let adTimer = null;
const AD_INTERVAL = 60 * 1000; // ~1 minute
const WELCOME_FLAG = "notifWelcomeShown";

const ADS = [
  { title: "YouTube", line: "Ienāc un skaties, šeit noteikti būs kaut kas priekš tevis!", img: "https://media.giphy.com/media/13Nc3xlO1kGg3S/giphy.gif", url: "https://www.youtube.com/" },
  { title: "Spotify", line: "Atklāj jaunu mūziku un aplādes katrai noskaņai!", img: "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXlnZzIzN2YxajV0ejN3Y3VidmVrdWIzNDc0N293bms2M2pvNzU4eiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/EFGXDUBXcUd131C0CR/giphy.gif", url: "https://www.spotify.com/" },
  { title: "Netflix", line: "Filmas un seriāli, ko var skatīties bez pārtraukuma.", img: "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNGE5ZXN5dHF6bHlibzA3N2Z4ZThudGd4aHJvZmx4aHhoMDFscTJjMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JnvHE3lTHPr3WrSsrl/giphy.gif", url: "https://www.netflix.com/" },
  { title: "HBO Max", line: "Premieres, oriģinālseriāli un kino klasika vienuviet.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOXphMXk5Z2NtdHRwcjN1bXhqYTJlb2xubG90dGF0d2Z2NDdzMGxqZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/cFetUtXX9ZUlzCuXBh/giphy.gif", url: "https://www.max.com/" },
  { title: "Disney+", line: "Disney, Marvel, Star Wars un Pixar pasaules vienā vietā.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExc28yMDZ0YnR5NWloMHR3aWltYWoxNHJxODVlNjlldWV1Z2g4cmd2eiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/fmGal3W3PNhHa/giphy.gif", url: "https://www.disneyplus.com/" },
  { title: "Twitch", line: "Skaties tiešraides, spēļu turnīrus un čato ar straumētājiem.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZjQ2eXRsMmtxbTc1MmtqaDBwMTNhZThheWk4azBvemRlZXk5dTg1eSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/fWAC87fMPC04h5shaE/giphy.gif", url: "https://www.twitch.tv/" },
  { title: "TikTok", line: "Īsi video, milzīgs humors un trendi katru dienu.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbWQ0M21nN3gxdWQzZ3c5dTkzNmwyaXhxaWg1aW8yeG40MHo2cXMycyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/U3rive8V39QioDjmNF/giphy.gif", url: "https://www.tiktok.com/" },
  { title: "Instagram", line: "Iedvesma, stāsti un foto no visas pasaules.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHUwaHZhbGM4dDBhaHNrdG91M3VocWRzenRjcXVwcTdmbTJ2eGt3byZlcD12MV9naWZzX3NlYXJjaCZjdD1n/QZOxRp5tZTemNQzpgc/giphy.gif", url: "https://www.instagram.com/" },
  { title: "LinkedIn", line: "Veido profesionālus kontaktus un atrodi jaunas iespējas.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExN3lzdHBwMTFwZDJlZWJsd3d0NW10bnpnNTNpOXVtZTF1ejBpMzMxOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/8r2AZ0fEAFVto15uS4/giphy.gif", url: "https://www.linkedin.com/" },
  { title: "Twitter (X)", line: "Reāllaika sarunas un jaunākās ziņas.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXVsYngzd2RxbXZpOHM0cTU2YTcyNnFnNmpleGR6aGdtM3JhcG04dyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/SMKiEh9WDO6ze/giphy.gif", url: "https://twitter.com/" },
  { title: "Facebook", line: "Sazinies ar draugiem un kopienām visā pasaulē.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdnFhMjhscDR5a2N6NzQwdGxjamx5NzVnZ3J4Njk2OXNnOGV4bzB5NSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ijEiXYEo9DBxm/giphy.gif", url: "https://www.facebook.com/" },
  { title: "Reddit", line: "Forumos atrodi atbildes, memītes un jaunākās ziņas.", img: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTk3aGN2cTJmcHVlM3IxaDFrNm5zNWd1Yzl4MGgwMXlta2s3ampudSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ZtDnSN82QjH0b4zIVQ/giphy.gif", url: "https://www.reddit.com/" },
  { title: "Pinterest", line: "Idejas un iedvesma projektam, stilam un receptēm.", img: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3bzBxanhrOWtuZ3c3YmpqcjRyYzJ6dDFkZTMxOTZheWtzdWY5YWE3cCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Y1OjNo2ULbw9BYvyuP/giphy.gif", url: "https://www.pinterest.com/" },
  { title: "Snapchat", line: "Dalies mirkļos un filtri kļūst par mākslu.", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTM0ZmM0Y2dycWJnd2V6cWI2NXp1bDJtNGhkNjRkdWxkY3I2Ynd2ZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/RlqsZ0HbW9q9w8jfLW/giphy.gif", url: "https://www.snapchat.com/" },
  { title: "GitHub", line: "Hostē kodu, sadarbojies un laižam ci!", img: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExamJpMmp2M3gyZ2szdDQyamdubTQ4ZGFiMHVhNThzdjFsYmU0bmQ4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/du3J3cXyzhj75IOgvA/giphy.gif", url: "https://github.com/" }
];

// Extra reminder/system messages
const REMINDERS = [
  { title: "Jauns abonements", line: "Jaunais plāns ir aktivizēts. Paldies, ka atbalsti!" },
  { title: "Atceries piezīmes", line: "Tev ir piezīmes — pārskati Notes, lai nekas neaizmirstas." },
  { title: "Rēķinu atgādinājums", line: "Pārskati gaidāmos rēķinus šonedēļ." },
  { title: "Mērķi", line: "Atjauno budžeta mērķus, lai redzētu progresu." },
  { title: "Plānotājs", line: "Ievadi nākamo lielo pirkumu Plānotājā." }
];

const POOL = [...ADS, ...REMINDERS];

onSettings(s => {
  const n = s?.notifications || { enabled: true };
  const sub = s?.subscription || { plan: "free" };
  plan = (sub.plan || "free").toLowerCase();
  // Free users: notifications forced ON; Standard/Pro respect toggle
  enabled = plan === "free" ? true : !!n.enabled;
  syncPermission();
  restartAds();
});

document.addEventListener("subscription:updated", e => {
  plan = (e.detail?.plan || "free").toLowerCase();
  if (plan === "free") enabled = true;
  syncPermission();
  restartAds();
});

async function syncPermission() {
  if (!enabled) { stopAds(); return; }
  if (!("Notification" in window)) { stopAds(); return; }
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  if (Notification.permission !== "granted") stopAds();
}

function startAds() {
  stopAds();
  if (!enabled) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  adTimer = setInterval(() => {
    const item = pickRandom(POOL);
    sendNotif(item.title, item.line);
  }, AD_INTERVAL);
}

function stopAds() {
  if (adTimer) clearInterval(adTimer);
  adTimer = null;
}

function restartAds() {
  stopAds();
  startAds();
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function sendNotif(title, body) {
  if (!enabled) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(title, { body });
}

if (document.readyState !== "loading") maybeWelcomeOnce();
else document.addEventListener("DOMContentLoaded", maybeWelcomeOnce);

// Show welcome only once per browser session
function maybeWelcomeOnce() {
  if (!enabled) return;
  try {
    const flag = sessionStorage.getItem(WELCOME_FLAG);
    if (flag) return;
    sessionStorage.setItem(WELCOME_FLAG, "1");
  } catch (e) {}
  // Optional: comment out if you never want the welcome toast
  // sendNotif("Paziņojumi ieslēgti", "Saņemsi reklāmas un atgādinājumus šajā ierīcē.");
  restartAds();
}