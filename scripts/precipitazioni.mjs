/* =========================================================
   ANIMAZIONE PRECIPITAZIONI — download della griglia (gira dentro scripts/aggiorna-dati.mjs)
   Griglia 0,1° su Dolomiti e Friuli (lat 45,9–47,1 · lon 10,9–13,9) = 403 punti.
   Variabili: precipitazione, neve fresca, zero termico (3 < 10 variabili, 96 ore < 2 settimane
   → ogni punto conta 1 chiamata per Open-Meteo).
   Si riscarica ogni 3 ore, e solo se c'è una corsa nuova del modello (controllo leggero sui metadati);
   negli altri giri si ripubblica il file già online.
     al massimo 8 × 403 = 3.224 chiamate al giorno; con il controllo della corsa di solito 2–4 × 403
   Limiti gratuiti Open-Meteo: 10.000 chiamate al giorno, 5.000 l'ora, 600 al minuto.
   Modelli in ordine: ICON-2I (ItaliaMeteo-ARPAE, 2 km, 72 h) → ICON-D2 (DWD, 2 km, 48 h) → ECMWF IFS.
   ========================================================= */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { griglia, quotaParte, ORE_AVANTI, ORE_INDIETRO, datiFinti } from "../js/precip-dati.js";

export const OGNI_ORE = 3;
export const BLOCCO = 100;                 // punti per richiesta (indirizzi corti)
export const MODELLI = [
  {id: "italia_meteo_arpae_icon_2i", nome: "ICON-2I · ItaliaMeteo-ARPAE (2 km)"},
  {id: "icon_d2", nome: "ICON-D2 · DWD (2 km)"},
  {id: "ecmwf_ifs025", nome: "ECMWF IFS (25 km)"}
];
const META = id => `https://api.open-meteo.com/data/${id}/static/meta.json`;
const REL = "precipitazioni/ultimo.json";

/* ora dell'ultima corsa del modello (metadati pubblici di Open-Meteo); null se non disponibile */
export async function ultimaCorsa(id, fetchFn = fetch){
  try{
    const r = await fetchFn(META(id));
    if(!r.ok) return null;
    const j = await r.json(), t = j.last_run_initialisation_time;
    return t ? new Date(t * 1000).toISOString() : null;
  }catch(e){ return null; }
}

/* scarica la griglia con un modello; null se il modello non copre almeno 48 ore avanti */
export async function scaricaGriglia(modello, fetchFn = fetch, adesso = Date.now()){
  const g = griglia(), righe = [];
  for(let i = 0; i < g.punti.length; i += BLOCCO){
    const blocco = g.punti.slice(i, i + BLOCCO);
    const q = new URLSearchParams({
      latitude: blocco.map(p => p.lat).join(","), longitude: blocco.map(p => p.lon).join(","),
      hourly: "precipitation,snowfall,freezing_level_height", models: modello.id,
      past_hours: ORE_INDIETRO, forecast_hours: ORE_AVANTI, timezone: "GMT"
    });
    const r = await fetchFn(`https://api.open-meteo.com/v1/forecast?${q}`);
    if(!r.ok) throw new Error(`${modello.id} HTTP ${r.status}`);
    let j = await r.json();
    if(!Array.isArray(j)) j = [j];
    if(j.length !== blocco.length) throw new Error(`${modello.id}: ${j.length} punti invece di ${blocco.length}`);
    righe.push(...j);
  }
  const tempi = righe[0].hourly.time;
  // ore con almeno un valore: il modello finisce dove tutto diventa null
  let ultima = -1;
  tempi.forEach((t, k) => { if(righe.some(x => x.hourly.precipitation[k] != null)) ultima = k; });
  const ore = tempi.slice(0, ultima + 1).map(t => t + "Z");
  const avanti = ore.filter(t => Date.parse(t) > adesso).length;
  if(avanti < 48) return null;
  const out = {v: 1, modello: modello.id, etichetta: modello.nome,
    griglia: {lat0: g.lat0, lon0: g.lon0, passo: g.passo, nLat: g.nLat, nLon: g.nLon},
    quote: righe.map(x => Math.round(x.elevation)), ore, p: [], s: [], f: []};
  ore.forEach((_, k) => {
    out.p.push(righe.map(x => { const v = x.hourly.precipitation[k]; return v == null ? null : Math.round(v * 10); }));
    out.s.push(righe.map(x => quotaParte(x.hourly.precipitation[k], x.hourly.snowfall[k] || 0)));
    out.f.push(righe.map(x => { const v = x.hourly.freezing_level_height[k]; return v == null ? null : Math.round(v / 100); }));
  });
  return out;
}

/* opz: {dir (…/dati), sitoUrl, fetchFn, adesso, log, forza, demo} */
export async function aggiornaPrecipitazioni(opz){
  const {dir, sitoUrl, fetchFn = fetch, adesso = Date.now(), log = () => {}, forza = false, demo = false} = opz;
  const file = resolve(dir, REL);
  const scrivi = async d => { await mkdir(dirname(file), {recursive: true}); await writeFile(file, JSON.stringify(d)); };
  if(demo){ await scrivi(datiFinti(adesso)); log("precipitazioni: dati dimostrativi"); return {stato: "demo"}; }

  let prima = null;
  try{ prima = JSON.parse(await readFile(file, "utf8")); }catch(e){}
  if(!prima && sitoUrl){
    try{ const r = await fetchFn(sitoUrl.replace(/\/?$/, "/") + "dati/" + REL, {cache: "no-store"}); if(r.ok) prima = await r.json(); }catch(e){}
  }
  const eta = prima ? (adesso - Date.parse(prima.generato)) / 3600e3 : Infinity;
  const tieni = async (motivo) => { await scrivi(prima); log(`precipitazioni: ${motivo} (file di ${Math.round(eta * 10) / 10} h fa)`); return {stato: "riuso", dati: prima}; };

  if(!forza && prima && eta < OGNI_ORE - 0.2) return tieni("non è ancora ora di riscaricare");
  // corsa nuova? se i metadati dicono che è la stessa già scaricata, non spendiamo 403 chiamate
  const corsa = await ultimaCorsa(MODELLI[0].id, fetchFn);
  if(!forza && prima && corsa && prima.corsa === corsa && prima.modello === MODELLI[0].id && eta < 12) return tieni(`corsa ICON-2I delle ${corsa.slice(11, 13)} UTC già scaricata`);

  for(const m of MODELLI){
    try{
      const d = await scaricaGriglia(m, fetchFn, adesso);
      if(!d){ log(`precipitazioni: ${m.id} copre meno di 48 ore, provo il successivo`); continue; }
      d.generato = new Date(adesso).toISOString();
      d.corsa = m.id === MODELLI[0].id ? corsa : await ultimaCorsa(m.id, fetchFn);
      await scrivi(d);
      log(`precipitazioni: ${m.id}, ${d.ore.length} ore, ${d.quote.length} punti (${Math.ceil(d.quote.length / BLOCCO)} richieste, ${d.quote.length} chiamate)${d.corsa ? `, corsa delle ${d.corsa.slice(11, 13)} UTC` : ""}`);
      return {stato: "nuovo", dati: d};
    }catch(e){ log(`precipitazioni: ${m.id} non risponde (${e.message})`); }
  }
  if(prima) return tieni("modelli non raggiungibili, ripubblico il file precedente");
  log("precipitazioni: nessun dato (la pagina mostrerà un messaggio)");
  return {stato: "vuoto"};
}
