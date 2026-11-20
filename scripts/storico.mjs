/* =========================================================
   STORICO 14 GIORNI — raccolta oraria (gira dentro scripts/aggiorna-dati.mjs)
   A ogni giro:
   1. riprende lo storico già pubblicato (cartella locale, se c'è, altrimenti dal sito:
      il sito pubblicato fa da "magazzino", così il repository non cresce ogni ora)
   2. spot: aggiunge le ore passate dell'ultimo meteo (le ultime 72 ore, così un giro saltato si ricuce da solo);
      se mancano molte ore (primo avvio) chiede a Open-Meteo gli ultimi 14 giorni in una richiesta sola
   3. stazioni: aggiunge l'ultima misura; ARPAV dà le ultime ~60 ore; per la rete Euregio
      (Alto Adige, Trentino) recupera i file orari mancanti, al massimo MAX_FILE_EUREGIO per giro
   4. taglia tutto a 14 giorni e scrive public/dati/storico/…  (il sito li pubblica)
   Le ore mai ricevute restano vuote: niente dati inventati o interpolati.
   ========================================================= */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { CAMPI_SPOT, CAMPI_STAZIONE, ORA, ORE_STORICO, GIORNI_STORICO, daColonne, aColonne, taglia, inserisci, oreMancanti, oreDaMeteo, oraPiena, fileStazione } from "../js/storico.js";
import { normalize, urlOraEuregio } from "../js/stazioni.js";

export const MAX_FILE_EUREGIO = 48;
const VARIABILI = "temperature_2m,snowfall,snow_depth,wind_speed_700hPa,wind_direction_700hPa,wind_gusts_10m";

async function pool(items, n, fn){
  const out = [];
  for(let i = 0; i < items.length; i += n) out.push(...await Promise.allSettled(items.slice(i, i + n).map(fn)));
  return out;
}

/* riempimento iniziale dello spot: Open-Meteo, ultimi 14 giorni, tutti gli spot in una richiesta */
export async function meteoUltimi14(spots, fetchFn = fetch){
  const q = new URLSearchParams({
    latitude: spots.map(s => s.lat).join(","), longitude: spots.map(s => s.lon).join(","), elevation: spots.map(s => s.elev).join(","),
    hourly: VARIABILI, past_days: GIORNI_STORICO, forecast_days: 1, timezone: "Europe/Rome", wind_speed_unit: "kmh"
  });
  const r = await fetchFn(`https://api.open-meteo.com/v1/forecast?${q}`);
  if(!r.ok) throw new Error("Open-Meteo HTTP " + r.status);
  let d = await r.json();
  if(!Array.isArray(d)) d = [d];
  return Object.fromEntries(spots.map((s, i) => [s.id, d[i] && d[i].hourly]));
}

/* opz: {spots, wx, stazioni, perSpot(spot) → stazioni vicine, dir (cartella di uscita: …/dati), sitoUrl,
         fetchFn, adesso, log, correggi(hourly) → applica la stessa correzione neve del sito} */
export async function aggiornaStorico(opz){
  const {spots, wx, stazioni = [], perSpot, dir, sitoUrl, fetchFn = fetch, adesso = Date.now(), log = () => {}, correggi} = opz;
  const leggi = async rel => {
    try{ return JSON.parse(await readFile(resolve(dir, rel), "utf8")); }catch(e){}
    if(!sitoUrl) return null;
    try{ const r = await fetchFn(sitoUrl.replace(/\/?$/, "/") + "dati/" + rel, {cache: "no-store"}); return r.ok ? await r.json() : null; }catch(e){ return null; }
  };
  const scrivi = async (rel, obj) => { const p = resolve(dir, rel); await mkdir(dirname(p), {recursive: true}); await writeFile(p, JSON.stringify(obj)); };
  const fine = oraPiena(adesso);
  const indicePrima = (await leggi("storico/indice.json")) || {};

  /* ---------- spot ---------- */
  const serieSpot = {};
  await pool(spots, 8, async s => { serieSpot[s.id] = daColonne(await leggi(`storico/spot/${s.id}.json`)); });
  for(const s of spots){
    const m = serieSpot[s.id], H = wx[s.id] && wx[s.id].hourly;
    for(const [t, r] of oreDaMeteo(H, fine)) inserisci(m, t, r, true);
    taglia(m, adesso);
  }
  const daRiempire = spots.filter(s => oreMancanti(serieSpot[s.id], adesso).length > 24);
  if(daRiempire.length){
    try{
      const vecchi = await meteoUltimi14(daRiempire, fetchFn);
      let ore = 0;
      for(const s of daRiempire){
        const H = vecchi[s.id]; if(!H) continue;
        if(correggi) correggi(H);
        for(const [t, r] of oreDaMeteo(H, fine)){ if(!serieSpot[s.id].has(t)) ore++; inserisci(serieSpot[s.id], t, r, false); }
        taglia(serieSpot[s.id], adesso);
      }
      log(`storico spot: riempite ${ore} ore mancanti di ${daRiempire.length} spot (Open-Meteo, ultimi ${GIORNI_STORICO} giorni)`);
    }catch(e){ log("storico spot: riempimento iniziale non riuscito,", e.message, "(riprovo al prossimo giro)"); }
  }

  /* ---------- stazioni: solo quelle mostrate negli spot ---------- */
  const utili = new Map();
  for(const s of spots) for(const st of perSpot(s)) utili.set(st.id, st);
  const serieSt = {};
  await pool([...utili.keys()], 8, async id => { serieSt[id] = daColonne(await leggi(`storico/stazioni/${fileStazione(id)}.json`)); });
  for(const st of utili.values()){
    const m = serieSt[st.id];
    if(st.ore) for(const [t, r] of st.ore) inserisci(m, t, r, true);   // ARPAV: ultime ~60 ore
    if(st.date && st.hs != null){
      inserisci(m, oraPiena(Date.parse(st.date)), {hs: st.hs, t: st.lt, w: st.vw, wx: st.vwmax, d: st.dw}, true);
    }
  }
  // Euregio: file orari mancanti (dal più recente), saltando quelli già risultati assenti
  const euregio = [...utili.values()].filter(st => st.operator !== "ARPAV");
  const assenti = new Set((indicePrima.euregioAssenti || []).filter(t => t > fine - ORE_STORICO * ORA));
  if(euregio.length){
    const mancanti = new Set();
    for(const st of euregio) for(const t of oreMancanti(serieSt[st.id], adesso - ORA)) if(!assenti.has(t)) mancanti.add(t);
    const daPrendere = [...mancanti].sort((a, b) => b - a).slice(0, MAX_FILE_EUREGIO);
    let presi = 0;
    await pool(daPrendere, 6, async t => {
      try{
        const r = await fetchFn(urlOraEuregio(t));
        if(r.status === 404){ assenti.add(t); return; }
        if(!r.ok) return;
        const lista = normalize(await r.json()), perId = new Map(lista.map(x => [x.id, x]));
        for(const st of euregio){ const x = perId.get(st.id); if(x) inserisci(serieSt[st.id], t, {hs: x.hs, t: x.lt, w: x.vw, wx: x.vwmax, d: x.dw}, false); }
        presi++;
      }catch(e){}
    });
    if(daPrendere.length) log(`storico stazioni Euregio: ${presi}/${daPrendere.length} file orari recuperati${mancanti.size > daPrendere.length ? `, ne restano ${mancanti.size - daPrendere.length} per i prossimi giri` : ""}`);
  }
  for(const id in serieSt) taglia(serieSt[id], adesso);

  /* ---------- scrittura ---------- */
  const agg = new Date(adesso).toISOString();
  for(const s of spots) await scrivi(`storico/spot/${s.id}.json`, aColonne(serieSpot[s.id], CAMPI_SPOT, {id: s.id, aggiornato: agg, tipo: "stima oraria registrata"}));
  const indice = {aggiornato: agg, giorni: GIORNI_STORICO, stazioni: {}, euregioAssenti: [...assenti].sort((a, b) => a - b)};
  for(const st of utili.values()){
    await scrivi(`storico/stazioni/${fileStazione(st.id)}.json`, aColonne(serieSt[st.id], CAMPI_STAZIONE, {id: st.id, aggiornato: agg, nome: st.name}));
    indice.stazioni[st.id] = {name: st.name, elev: st.elev, lat: st.lat, lon: st.lon, operator: st.operator};
  }
  await scrivi("storico/indice.json", indice);
  const ore = Object.values(serieSpot).reduce((a, m) => a + m.size, 0) / Math.max(1, spots.length);
  log(`storico: ${spots.length} spot (in media ${Math.round(ore)}/${ORE_STORICO} ore), ${utili.size} stazioni`);
  return {spot: serieSpot, stazioni: serieSt, indice};
}
