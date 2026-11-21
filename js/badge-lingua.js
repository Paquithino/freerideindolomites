/* =========================================================
   BADGE LINGUA — piccolo interruttore IT | EN nella testata
   Porta alla stessa pagina nell'altra lingua e ricorda la scelta:
   se la prossima volta arrivi da fuori (Google, un link) su una pagina italiana
   avendo scelto l'inglese, ti porta alla versione inglese (e viceversa).
   ========================================================= */
import { lingua, url } from "./i18n.js";

const RICORDA = "fr_lingua";
const leggi = () => { try{ return JSON.parse(localStorage.getItem(RICORDA)); }catch(e){ return null; } };

/* percorso italiano della pagina → html del badge */
export function badgeLingua(percorso = "", extra = ""){
  const l = lingua();
  const voce = (lg, testo, nome) => `<a href="${url(percorso, lg) || "./"}${extra}" hreflang="${lg}" lang="${lg}" data-lingua="${lg}" class="${l === lg ? "on" : ""}"${l === lg ? ' aria-current="true"' : ""} title="${nome}">${testo}</a>`;
  return `<span class="lang-b" role="group" aria-label="${l === "en" ? "Language" : "Lingua"}">${voce("it", "IT", "Italiano")}${voce("en", "EN", "English")}</span>`;
}

/* da chiamare una volta per pagina: riempie i badge e ricorda la scelta */
export function avviaBadgeLingua(percorso){
  if(typeof document === "undefined") return;
  const extra = location.search || "";
  if(percorso != null) document.querySelectorAll("[data-lingua-badge]").forEach(b => b.innerHTML = badgeLingua(percorso, extra));
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-lingua]");
    if(a) try{ localStorage.setItem(RICORDA, JSON.stringify(a.dataset.lingua)); }catch(x){}
  });
  // scelta già fatta e arrivo da fuori: pagina nella lingua scelta
  const scelta = leggi(), daFuori = !document.referrer || !document.referrer.startsWith(location.origin);
  if(scelta && scelta !== lingua() && daFuori && percorso != null){
    const dest = new URL((url(percorso, scelta) || "./") + extra, document.baseURI);
    if(dest.href !== location.href) location.replace(dest.href);
  }
}
