import { avviaBadgeLingua } from "./badge-lingua.js";
/* Menu a scomparsa per le pagine senza l'app (la guida). */
const m = document.getElementById("menu"), b = document.getElementById("menuBtn");
function menu(apri){
  m.hidden = !apri; b.setAttribute("aria-expanded", String(apri));
  document.body.classList.toggle("menu-aperto", apri);
  if(apri) m.querySelector(".mlinks a")?.focus(); else b.focus({preventScroll: true});
}
if(m && b){
  b.addEventListener("click", () => menu(true));
  document.addEventListener("click", e => { if(e.target.closest("[data-menuclose]")) menu(false); });
  document.addEventListener("keydown", e => { if(e.key === "Escape" && !m.hidden) menu(false); });
}
/* ancore interne (#calibrazione): con il tag <base> vanno gestite a mano */
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="#"]'); if(!a) return;
  const t = document.getElementById(a.getAttribute("href").slice(1)); if(!t) return;
  e.preventDefault(); t.scrollIntoView(); history.replaceState(null, "", "#" + t.id);
});

/* badge lingua: la pagina dice qual è il suo percorso italiano (data-percorso sul body) */
avviaBadgeLingua(document.body.dataset.percorso || "");
