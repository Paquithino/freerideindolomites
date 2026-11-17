/* =========================================================
   Controllo webcam — gira con l'aggiornamento orario su GitHub Actions.
   Per ogni immagine/panorama configurato verifica che risponda davvero
   (senza referer, come la carica il sito) e che non sia ferma da giorni.
   Il risultato finisce nello snapshot: il sito nasconde le webcam morte
   e apre in una nuova scheda i panorami che non si lasciano incorporare.
   ========================================================= */
import { SPOTS } from "../js/config.js";

const UA = "Mozilla/5.0 (compatible; FreeRideInDolomites/1.0; +https://paquithino.github.io/freerideindolomites/)";
const FERMA_ORE = 48;

async function prova(url, tipo){
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 15000);
  try{
    const r = await fetch(url, {headers: {"User-Agent": UA, "Accept": tipo === "img" ? "image/*" : "text/html"}, redirect: "follow", signal: ctl.signal});
    if(!r.ok) return {ok: false, why: `HTTP ${r.status}`};
    if(tipo === "img"){
      const ct = r.headers.get("content-type") || "";
      const buf = await r.arrayBuffer();
      if(!ct.startsWith("image/")) return {ok: false, why: `non è un'immagine (${ct.split(";")[0] || "?"})`};
      if(buf.byteLength < 3000) return {ok: false, why: `immagine vuota (${buf.byteLength} byte)`};
      const lm = r.headers.get("last-modified");
      const ore = lm ? (Date.now() - new Date(lm).getTime()) / 3600e3 : null;
      if(ore != null && ore > FERMA_ORE) return {ok: true, ferma: new Date(lm).toISOString(), why: `ferma da ${Math.round(ore / 24)} giorni`};
      return {ok: true};
    }
    // panorama: deve rispondere e lasciarsi mettere in un iframe
    await r.arrayBuffer();
    const xfo = (r.headers.get("x-frame-options") || "").toLowerCase();
    const csp = (r.headers.get("content-security-policy") || "").toLowerCase();
    const fa = (csp.match(/frame-ancestors([^;]*)/) || [])[1];
    const bloccato = /deny|sameorigin/.test(xfo) || (fa != null && !/\*|github\.io/.test(fa));
    return bloccato ? {ok: true, noFrame: true, why: "non incorporabile: si apre in una nuova scheda"} : {ok: true};
  }catch(e){
    return {ok: false, why: e.name === "AbortError" ? "nessuna risposta in 15 s" : (e.cause && e.cause.code) || e.message};
  }finally{ clearTimeout(to); }
}

export async function controllaWebcam(log = console.log){
  const lista = new Map();
  for(const s of SPOTS) for(const c of s.cams){
    if(c.img) lista.set(c.img, {tipo: "img", t: c.t, spot: s.name});
    if(c.embed) lista.set(c.embed, {tipo: "embed", t: c.t, spot: s.name});
  }
  const out = {}, voci = [...lista];
  for(let i = 0; i < voci.length; i += 6){
    await Promise.all(voci.slice(i, i + 6).map(async ([url, v]) => { out[url] = await prova(url, v.tipo); }));
  }
  const ko = voci.filter(([u]) => !out[u].ok), avvisi = voci.filter(([u]) => out[u].ok && out[u].why);
  log(`webcam: ${voci.length - ko.length}/${voci.length} raggiungibili`);
  for(const [u, v] of ko) log(`  ✗ ${v.spot} · ${v.t} — ${out[u].why}\n      ${u}`);
  for(const [u, v] of avvisi) log(`  ! ${v.spot} · ${v.t} — ${out[u].why}`);
  return {checked: new Date().toISOString(), cams: out};
}

// uso diretto: node scripts/controlla-webcam.mjs
if(import.meta.url === `file://${process.argv[1]}`) controllaWebcam();
