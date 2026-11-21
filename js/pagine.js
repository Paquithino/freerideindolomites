/* =========================================================
   PAGINE — indirizzi veri per ogni sezione e ogni spot
   (servono a Google: ogni pagina ha il suo titolo, la sua descrizione e il suo testo)

     /                        home: in breve + spot
     /spot/                   tutti gli spot
     /spot/veneto/ …          spot di una zona
     /spot/cortina/ …         una pagina per spot
     /previsione/  /valanghe/  /webcam/   sezioni
     /guida/                  info e guida (pagina a parte)

   Usato dal sito (navigazione) e da scripts/genera-pagine.mjs (pagine statiche): niente DOM qui.
   Tutti gli indirizzi sono RELATIVI alla radice del sito (il tag <base> nelle pagine).
   ========================================================= */
import { SPOTS } from "./config.js";
import { esc } from "./state.js";
import { t, url as u, loc, percorsoLogico, inglese } from "./i18n.js";

export const SITO_NOME = "FreeRide in Dolomites";
export const COPERTINA = "copertina.jpg";
export const COPERTINA_MOBILE = "copertina-mobile.jpg";
/* foto della copertina: ritaglio stretto sullo sciatore per il telefono, largo per il desktop */
export const fotoCopertina = () => `<picture class="cv-img" aria-hidden="true"><source media="(max-width:699px)" srcset="${COPERTINA_MOBILE}"><img src="${COPERTINA}" alt="" decoding="async" fetchpriority="high"></picture>`;

export const AREE = [
  {slug: "alto-adige", area: "Alto Adige", nome: "Alto Adige"},
  {slug: "veneto", area: "Veneto", nome: "Veneto"},
  {slug: "trentino", area: "Trentino", nome: "Trentino"},
  {slug: "friuli", area: "Friuli VG", nome: "Friuli Venezia Giulia"}
];
/* nome della zona nella lingua della pagina */
export const nomeArea = a => t((AREE.find(x => x.area === a) || {}).nome || a);
export const areaDaSlug = s => AREE.find(a => a.slug === s) || null;
export const slugDaArea = a => (AREE.find(x => x.area === a) || {}).slug || null;
export const percorsoSpot = id => `spot/${id}/`;
export const percorsoArea = area => { const s = slugDaArea(area); return s ? `spot/${s}/` : "spot/"; };

/* sezioni principali (menu in alto, pillole nella copertina, menu del telefono) */
export const SEZIONI = [
  {path: "", nome: "Spot", tab: "spot"},
  {path: "previsione/", nome: "Previsione", tab: "previsione"},
  {path: "valanghe/", nome: "Valanghe", tab: "valanghe"},
  {path: "webcam/", nome: "Webcam", tab: "webcam"}
];
/* indirizzo da usare nei link della lingua attuale ("" → "./" in italiano, "en/" in inglese) */
export const href = p => u(p) || "./";

/* "spot/cortina/" → {vista: "spot", id: "cortina", path} ; percorso relativo alla radice del sito */
export function leggiPercorso(p){
  p = percorsoLogico(String(p || "").replace(/^\/+/, "").replace(/index\.html$/, "").split(/[?#]/)[0]).percorso;
  const parti = p.split("/").filter(Boolean);
  if(!parti.length) return {vista: "home", path: ""};
  const [a, b] = parti;
  if(a === "spot"){
    if(!b) return {vista: "lista", path: "spot/"};
    const z = areaDaSlug(b);
    if(z) return {vista: "lista", area: z.area, path: `spot/${z.slug}/`};
    const s = SPOTS.find(x => x.id === b);
    if(s) return {vista: "spot", id: s.id, path: percorsoSpot(s.id)};
    return {vista: "home", path: "", sconosciuto: true};
  }
  if(a === "previsione" || a === "pianifica") return {vista: "previsione", path: "previsione/"};
  if(a === "valanghe") return {vista: "valanghe", path: "valanghe/"};
  if(a === "webcam") return {vista: "webcam", path: "webcam/"};
  return {vista: "home", path: "", sconosciuto: true};
}
/* vecchi indirizzi con # (link già condivisi): #spot-cortina → spot/cortina/ */
export function daHash(h){
  h = String(h || "").replace(/^#/, "");
  if(!h) return null;
  if(h.startsWith("spot-")) return SPOTS.some(s => s.id === h.slice(5)) ? percorsoSpot(h.slice(5)) : "";
  if(h === "spot") return "";
  if(h === "previsione" || h === "pianifica") return "previsione/";
  if(h === "valanghe" || h === "webcam") return h + "/";
  return null;
}
export function tutteLeRotte(){
  return [
    {vista: "home", path: ""}, {vista: "lista", path: "spot/"},
    ...AREE.map(a => ({vista: "lista", area: a.area, path: `spot/${a.slug}/`})),
    ...SPOTS.map(s => ({vista: "spot", id: s.id, path: percorsoSpot(s.id)})),
    {vista: "previsione", path: "previsione/"}, {vista: "valanghe", path: "valanghe/"}, {vista: "webcam", path: "webcam/"}
  ];
}

const mil = n => Number(n).toLocaleString(loc());
/* titolo, descrizione e titolo principale (h1) di ogni pagina */
export function metaPer(r){
  const sito = ` | ${SITO_NOME}`;
  switch(r.vista){
    case "spot": {
      const s = SPOTS.find(x => x.id === r.id);
      const nome = s.name.split(" · ")[0];
      return {tab: "spot",
        title: t("{nome}: neve, meteo e valanghe per il freeride", {nome}) + sito,
        h1: s.name,
        description: t("Neve fresca, previsione a 10 giorni, neve per quota (vetta {top} m, base {base} m), bollettino valanghe, webcam e montagna in 3D per il fuoripista a {nome}: {zone}.", {top: mil(s.q.top), base: mil(s.q.base), nome, zone: s.zones})};
    }
    case "lista": {
      const z = r.area ? AREE.find(a => a.area === r.area) : null;
      const n = z ? SPOTS.filter(s => s.area === r.area).length : SPOTS.length;
      return {tab: "spot",
        title: (z ? t("Spot freeride in {zona}: neve e meteo", {zona: t(z.nome)}) : t("Spot freeride delle Dolomiti: neve e meteo")) + sito,
        h1: z ? t("Spot freeride · {zona}", {zona: t(z.nome)}) : t("Spot freeride"),
        description: z ? t("Neve fresca, neve in arrivo e pericolo valanghe dei {n} spot freeride in {zona}, aggiornati ogni ora.", {n, zona: t(z.nome)})
                       : t("Neve fresca, neve in arrivo e pericolo valanghe di {n} spot freeride tra Dolomiti e Friuli, aggiornati ogni ora.", {n})};
    }
    case "previsione": return {tab: "previsione", title: t("Previsione neve sulle Dolomiti, giorno per giorno") + sito, h1: t("Previsione neve"),
      description: t("Previsione della neve fresca per i prossimi 10 giorni su tutti gli spot freeride delle Dolomiti: confronto di 5 modelli meteo calibrati sulle stazioni nivometriche.")};
    case "valanghe": return {tab: "valanghe", title: t("Bollettino valanghe Dolomiti oggi") + sito, h1: t("Pericolo valanghe"),
      description: t("Bollettini valanghe ufficiali di Veneto, Alto Adige, Trentino e Friuli letti per intero: grado di pericolo per quota, problemi valanghivi, manto nevoso e tendenza.")};
    case "webcam": return {tab: "webcam", title: t("Webcam in quota sulle Dolomiti") + sito, h1: t("Webcam"),
      description: t("Le webcam in quota degli spot freeride delle Dolomiti, per controllare neve, visibilità e vento prima di partire.")};
    default: return {tab: "spot", title: `${SITO_NOME}: ` + t("neve, meteo e valanghe per il freeride sulle Dolomiti"), h1: t("Neve, meteo e valanghe per il freeride sulle Dolomiti"),
      description: t("Neve fresca, previsione calibrata su 5 modelli, neve per quota, bollettini valanghe completi e webcam di 28 spot freeride tra Dolomiti e Friuli. Aggiornato ogni ora.")};
  }
}

/* Pagina spot: 5 sezioni, 10 tabelle (vedi struttura-pagina-spot.md)
   1 Dati raccolti: Adesso, Neve fresca, Neve misurata
   2 Previsioni: prossimi 10 giorni, Neve per quota, Confronto modelli, Ora per ora
   3 Valanghe: Pericolo valanghe · 4 3D: Montagna in 3D · 5 Webcam: Webcam */
/* etichette brevi inglesi per le pillole (le parole lunghe non ci stanno sul telefono) */
const CORTO_EN = {Dati: "Data", Previsioni: "Forecast", Valanghe: "Avalanche", "3D": "3D", Webcam: "Cams"};
export const GRUPPI_SPOT = [
  {id: "s-dati", nome: "Dati raccolti", corto: "Dati"},
  {id: "s-prev", nome: "Previsioni", corto: "Previsioni"},
  {id: "s-av", nome: "Valanghe", corto: "Valanghe"},
  {id: "s-3d", nome: "3D", corto: "3D"},
  {id: "s-cam", nome: "Webcam", corto: "Webcam"}
];
/* una sezione numerata (h2) che contiene le sue tabelle; vuota = non mostrata */
export function gruppoHTML(i, corpo){
  if(!corpo) return "";
  const g = GRUPPI_SPOT[i];
  return `<section class="grp ${g.id}" id="${g.id}" aria-labelledby="${g.id}-t"><h2 class="gh" id="${g.id}-t"><span class="gn" aria-hidden="true">${i + 1}</span>${esc(t(g.nome))}</h2><div class="grp-b">${corpo}</div></section>`;
}
/* una tabella dentro la sezione (h3) */
export const tabellaHTML = (cls, titolo, corpo, extra = "") => `<section class="sec ${cls}${extra ? " " + extra : ""}" id="${cls}"><h3 class="sh">${titolo}</h3>${corpo}</section>`;

const ICO_INDIETRO = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`;
/* fascia di copertina con la foto: data, titolo e pillole (sezioni, oppure parti della pagina spot) */
export function coverHTML(r, quando, opz = {}){
  const meta = metaPer(r);
  const data = quando ? `<span class="cv-date">${esc(quando)}</span>` : "";
  if(r.vista === "spot"){
    const s = SPOTS.find(x => x.id === r.id);
    const parti = GRUPPI_SPOT.map(g => [g.id, inglese() ? (CORTO_EN[g.corto] || g.corto) : g.corto]);
    return `${fotoCopertina()}<div class="cover-in wrap">
      <div class="cv-top"><a class="cv-back" href="${href(percorsoArea(s.area))}" data-back>${ICO_INDIETRO}<span>${t("Spot")}</span></a>
        ${opz.fav != null ? `<button class="cv-fav ${opz.fav ? "on" : ""}" data-fav="${s.id}" aria-label="${opz.fav ? t("Togli dai preferiti") : t("Aggiungi ai preferiti")}">${opz.fav ? "★" : "☆"}</button>` : ""}</div>
      <div class="cv-title"><h1>${esc(s.name)}</h1><p>${esc(nomeArea(s.area))} · ${mil(s.q.base)} – ${mil(s.q.top)} m</p></div>
      <nav class="pills" aria-label="${t("Parti della pagina")}">${parti.map(([id, n], i) => `<button class="${i ? "" : "on"}" data-goto="${id}">${n}</button>`).join("")}</nav>
    </div>`;
  }
  const pills = `<nav class="pills" aria-label="${t("Sezioni")}">${SEZIONI.map(x => `<a href="${href(x.path)}" class="${x.tab === meta.tab ? "on" : ""}"${x.tab === meta.tab ? ' aria-current="page"' : ""}>${t(x.nome)}</a>`).join("")}</nav>`;
  if(r.vista === "home"){
    return `${fotoCopertina()}<div class="cover-in wrap"><div class="cv-top">${data}</div><h1 class="sr">${esc(meta.h1)}</h1>${pills}</div>`;
  }
  return `${fotoCopertina()}<div class="cover-in wrap"><div class="cv-top">${data}</div><div class="cv-title"><h1>${esc(meta.h1)}</h1></div>${pills}</div>`;
}
