import { WORKER_URL } from "./config.js";
import { t, loc, inglese } from "./i18n.js";
/* titoli delle webcam: sono nomi di luoghi, si traduce solo "Tutte le webcam …" */
const tc = x => inglese() ? String(x || "").replace(/^Tutte le webcam /, "All webcams: ").replace(/^Webcam /, "Webcam ") : x;
import { esc, state } from "./state.js";

/* =========================================================
   WEBCAM — immagini mostrate nel sito
   Senza Worker: l'immagine viene caricata direttamente dal fornitore.
   Con Worker: passa da /api/webcam (cache 5 min, niente blocchi hotlink/CORS).
   ========================================================= */
export const CAM_REFRESH_MIN = 5;

export function camSrc(url){
  const bust = Math.floor(Date.now() / (CAM_REFRESH_MIN * 60e3));
  if(WORKER_URL) return `${WORKER_URL}/api/webcam?url=${encodeURIComponent(url)}&t=${bust}`;
  return url + (url.includes("?") ? "&" : "?") + "_=" + bust;
}

/* esito dell'ultimo controllo fatto da GitHub Actions (null = non controllata) */
const esito = url => state.camCheck && state.camCheck.cams ? state.camCheck.cams[url] || null : null;
const giorno = iso => new Date(iso).toLocaleDateString(loc(), {day: "numeric", month: "short"});

export function camCard(c){
  if(c.img){
    const e = esito(c.img);
    return `<div class="cam">
      <img src="${esc(camSrc(c.img))}" alt="${esc(tc(c.t))}" loading="lazy" referrerpolicy="no-referrer" data-zoom
        onerror="this.outerHTML='<div class=&quot;fail&quot;>${t("Immagine non disponibile in questo momento")}</div>'">
      <div class="cap"><span>${esc(tc(c.t))}${e && e.ferma ? ` <span class="ferma">${t("ferma dal {g}", {g: giorno(e.ferma)})}</span>` : ""}</span><span class="small">${esc(c.src || "")}</span></div></div>`;
  }
  if(c.embed){
    const e = esito(c.embed);
    const bottone = e && e.noFrame
      ? `<a class="play" href="${esc(c.embed)}" target="_blank" rel="noopener">▶ ${t("Apri panorama 360°")} ↗</a>`
      : `<button class="play" data-embed="${esc(c.embed)}">▶ ${t("Apri panorama 360°")}</button>`;
    return `<div class="cam">${bottone}
      <div class="cap"><span>${esc(tc(c.t))}</span><a href="${esc(c.embed)}" target="_blank" rel="noopener">${esc(c.src || t("apri"))} ↗</a></div></div>`;
  }
  return "";
}
export function camsHTML(spot){
  const tutte = spot.cams.filter(c => c.img || c.embed);
  // nascondiamo quelle che all'ultimo controllo non rispondevano
  const visual = tutte.filter(c => { const e = esito(c.img || c.embed); return !e || e.ok; });
  const spente = tutte.length - visual.length;
  const links = [...spot.cams.filter(c => c.u),
    {t: t("Cerca altre webcam: {spot}", {spot: spot.name}), u:`https://www.google.com/search?q=${encodeURIComponent("webcam " + spot.name)}`}];
  return `${visual.length ? `<div class="cams">${visual.map(camCard).join("")}</div>` : `<p class="note" style="margin:0 0 8px">${spente ? t("Le webcam di questo spot al momento non rispondono: usa i link qui sotto.") : t("Nessuna immagine diretta configurata per questo spot.")}</p>`}
    ${spente && visual.length ? `<p class="small" style="margin:6px 0 0">${spente === 1 ? t("Una webcam è nascosta perché al momento non risponde.") : t("{n} webcam sono nascoste perché al momento non rispondono.", {n: spente})}</p>` : ""}
    <div class="links" style="margin-top:10px">${links.map(l => `<a class="lnk" href="${esc(l.u)}" target="_blank" rel="noopener">${esc(tc(l.t))}</a>`).join("")}</div>`;
}

/* tocco su "Apri panorama" → carica l'iframe solo quando serve */
if(typeof document !== "undefined"){
document.addEventListener("click", e => {
  const b = e.target.closest("[data-embed]");
  if(b){ const f = document.createElement("iframe"); f.src = b.dataset.embed; f.loading = "lazy"; f.allowFullscreen = true; f.title = t("Panorama webcam"); b.replaceWith(f); return; }
  const z = e.target.closest("img[data-zoom]");
  if(z){ const lb = document.getElementById("lightbox"); lb.querySelector("img").src = z.src; lb.classList.add("on"); return; }
  if(e.target.closest("#lightbox")) document.getElementById("lightbox").classList.remove("on");
});

document.addEventListener("keydown", e => {
  if(e.key === "Escape") document.getElementById("lightbox")?.classList.remove("on");
});
}
