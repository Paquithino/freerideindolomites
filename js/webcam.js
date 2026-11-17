import { WORKER_URL } from "./config.js";
import { esc } from "./state.js";

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

export function camCard(c){
  if(c.img){
    return `<div class="cam">
      <img src="${esc(camSrc(c.img))}" alt="${esc(c.t)}" loading="lazy" data-zoom
        onerror="this.outerHTML='<div class=&quot;fail&quot;>Immagine non disponibile<br>(il fornitore può bloccare il caricamento da altri siti: attiva il Worker)</div>'">
      <div class="cap"><span>${esc(c.t)}</span><span class="small">${esc(c.src || "")}</span></div></div>`;
  }
  if(c.embed){
    return `<div class="cam"><button class="play" data-embed="${esc(c.embed)}">▶ Apri panorama 360°</button>
      <div class="cap"><span>${esc(c.t)}</span><a href="${esc(c.embed)}" target="_blank" rel="noopener">${esc(c.src || "apri")} ↗</a></div></div>`;
  }
  return "";
}
export function camsHTML(spot){
  const visual = spot.cams.filter(c => c.img || c.embed);
  const links = [...spot.cams.filter(c => c.u),
    {t:`Cerca altre webcam: ${spot.name}`, u:`https://www.google.com/search?q=${encodeURIComponent("webcam " + spot.name)}`}];
  return `${visual.length ? `<div class="cams">${visual.map(camCard).join("")}</div>` : `<p class="note" style="margin:0 0 8px">Nessuna immagine diretta configurata per questo spot.</p>`}
    <div class="links" style="margin-top:10px">${links.map(l => `<a class="lnk" href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.t)}</a>`).join("")}</div>`;
}

/* tocco su "Apri panorama" → carica l'iframe solo quando serve */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-embed]");
  if(b){ const f = document.createElement("iframe"); f.src = b.dataset.embed; f.loading = "lazy"; f.allowFullscreen = true; f.title = "Panorama webcam"; b.replaceWith(f); return; }
  const z = e.target.closest("img[data-zoom]");
  if(z){ const lb = document.getElementById("lightbox"); lb.querySelector("img").src = z.src; lb.classList.add("on"); return; }
  if(e.target.closest("#lightbox")) document.getElementById("lightbox").classList.remove("on");
});

document.addEventListener("keydown", e => {
  if(e.key === "Escape") document.getElementById("lightbox")?.classList.remove("on");
});
