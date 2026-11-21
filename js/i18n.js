/* =========================================================
   LINGUA — italiano (predefinito) e inglese
   - la lingua la decide l'indirizzo: /en/… = inglese, tutto il resto = italiano
     (così Google indicizza le due versioni e un link condiviso apre sempre la lingua giusta)
   - t("testo italiano") restituisce la traduzione inglese se la pagina è in inglese;
     se manca una traduzione resta l'italiano (niente buchi)
   - gli indirizzi nel codice sono sempre quelli italiani ("previsione/", "spot/cortina/"):
     url() li trasforma in quelli della lingua attuale ("en/forecast/", "en/spot/cortina/")
   Niente DOM obbligatorio: lo usano anche il generatore delle pagine e i test.
   ========================================================= */
import EN from "./lingua-en.js";

export const LINGUE = ["it", "en"];
/* sezioni con nome tradotto nell'indirizzo inglese */
const SLUG_EN = {previsione: "forecast", valanghe: "avalanches", webcam: "webcams", guida: "guide", contatti: "contact", precipitazioni: "precipitation"};
const SLUG_IT = Object.fromEntries(Object.entries(SLUG_EN).map(([a, b]) => [b, a]));

/* lingua dall'indirizzo, relativo alla radice del sito */
export function linguaDaPercorso(p){
  return /^\/?en(\/|$)/.test(String(p || "")) ? "en" : "it";
}
let attuale = "it";
if(typeof document !== "undefined" && typeof location !== "undefined"){
  try{
    const base = new URL(document.baseURI).pathname;
    const rel = location.pathname.startsWith(base) ? location.pathname.slice(base.length) : location.pathname.replace(/^\//, "");
    attuale = linguaDaPercorso(rel);
  }catch(e){}
}
export const lingua = () => attuale;
export const inglese = () => attuale === "en";
export function impostaLingua(l){ attuale = l === "en" ? "en" : "it"; }
export const loc = () => attuale === "en" ? "en-GB" : "it-IT";

/* traduzione: chiave = testo italiano; {nome} = valori da inserire */
export function t(testo, valori){
  let s = attuale === "en" && EN[testo] != null ? EN[testo] : testo;
  if(valori) s = s.replace(/\{(\w+)\}/g, (m, k) => valori[k] != null ? valori[k] : m);
  return s;
}
/* numero con i separatori della lingua (1.450 / 1,450) */
export const num = (n, dec = 0) => n == null || !isFinite(n) ? "–" : Number(n).toLocaleString(loc(), {maximumFractionDigits: dec, minimumFractionDigits: 0});

/* indirizzo italiano → indirizzo nella lingua l ("previsione/" → "en/forecast/") */
export function url(p = "", l = attuale){
  p = String(p || "");
  const [via, resto = ""] = p.split(/(?=[?#])/);
  if(l !== "en") return p;
  const parti = via.split("/");
  if(parti[0] && SLUG_EN[parti[0]]) parti[0] = SLUG_EN[parti[0]];
  const tradotto = parti.join("/");
  return "en/" + tradotto + resto;
}
/* indirizzo in una lingua qualsiasi → {lingua, percorso italiano} */
export function percorsoLogico(p = ""){
  p = String(p || "").replace(/^\/+/, "");
  const l = linguaDaPercorso(p);
  if(l === "en"){
    p = p.replace(/^en\/?/, "");
    const parti = p.split("/");
    if(parti[0] && SLUG_IT[parti[0]]) parti[0] = SLUG_IT[parti[0]];
    p = parti.join("/");
  }
  return {lingua: l, percorso: p};
}

/* traduce i testi fissi di una pagina HTML (menu, footer, pulsanti) — stringa, per il generatore */
const ATTR = /(\s(?:aria-label|title|alt|placeholder|content)=")([^"]*)(")/g;
export function traduciHTML(html){
  if(attuale !== "en") return html;
  return html
    .replace(/>([^<>]+)</g, (m, testo) => { const k = testo.trim(); return k && EN[k] != null ? ">" + testo.replace(k, EN[k]) + "<" : m; })
    .replace(ATTR, (m, a, v, b) => EN[v] != null ? a + EN[v] + b : m);
}
/* stessa cosa sul DOM già caricato (anteprima con npm run dev) */
export function traduciDOM(root){
  if(attuale !== "en" || !root) return;
  const w = root.ownerDocument.createTreeWalker(root, 4);
  const nodi = []; while(w.nextNode()) nodi.push(w.currentNode);
  for(const n of nodi){ const k = n.nodeValue.trim(); if(k && EN[k] != null) n.nodeValue = n.nodeValue.replace(k, EN[k]); }
  root.querySelectorAll("[aria-label],[title],[alt],[placeholder]").forEach(el => {
    for(const a of ["aria-label", "title", "alt", "placeholder"]){ const v = el.getAttribute(a); if(v && EN[v] != null) el.setAttribute(a, EN[v]); }
  });
}
/* link interni scritti in italiano nell'HTML (href="previsione/") → indirizzi inglesi */
export function traduciLink(root){
  if(attuale !== "en" || !root) return;
  root.querySelectorAll("a[href]").forEach(a => {
    const h = a.getAttribute("href");
    if(!h || /^(https?:|mailto:|#|\.\.\/|\/|en\/)/.test(h) || /\.(png|jpg|svg|json|xml|txt|webmanifest)$/.test(h)) return;
    a.setAttribute("href", url(h === "./" ? "" : h) || "en/");
  });
}
