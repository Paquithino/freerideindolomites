/* =========================================================
   FreeRide in Dolomites — aggiornamento dati
   Gira ogni ora su GitHub Actions (e a mano con: npm run dati).
   1. scarica meteo, modelli (neve + vento), stazioni e bollettini valanghe
      usando lo stesso codice del sito (cartella js/)
   2. scrive public/dati/ultimo.json, che il sito legge all'apertura
   3. scrive archivio/AAAA-MM-GG.json (una volta al giorno): previsioni dei
      modelli e neve misurata, per calibrare la "Previsione FreeRide"
   Opzioni:  --demo  usa dati dimostrativi (per provare senza internet)
   ========================================================= */
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SPOTS, MODELS } from "../js/config.js";
import { state, unpackTimes } from "../js/state.js";
import { loadWeather, demoWeather, romeNowISO, dailyPlan } from "../js/meteo.js";
import { loadModels, demoModels, ensembleFor } from "../js/modelli.js";
import { loadAvalanche, avForSpot } from "../js/valanghe.js";
import { loadStations, stationsFor } from "../js/stazioni.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = process.argv.includes("--demo");
const OUT = resolve(ROOT, "public/dati/ultimo.json");
const ARCH_DIR = resolve(ROOT, process.env.ARCHIVIO_DIR || "archivio");

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* File più leggero da scaricare dal telefono:
   - numeri arrotondati a un decimale
   - le liste di orari ("time") diventano {"@h": primo orario, n} o {"@d": primo giorno, n};
     il sito le ricostruisce (js/state.js, funzione unpackTimes) */
function packTimes(arr){
  if(!Array.isArray(arr) || arr.length < 3 || typeof arr[0] !== "string") return arr;
  const hourly = arr[0].length === 16, step = hourly ? 3600e3 : 864e5;
  const toMs = s => Date.parse(s + (hourly ? ":00Z" : "T00:00:00Z"));
  const t0 = toMs(arr[0]);
  for(let i = 1; i < arr.length; i++) if(toMs(arr[i]) - t0 !== i * step) return arr;   // non regolare: lascio così
  return hourly ? {"@h": arr[0], n: arr.length} : {"@d": arr[0], n: arr.length};
}
function round(obj){
  return JSON.parse(JSON.stringify(obj, (k, v) => k === "time" ? packTimes(v) : typeof v === "number" ? Math.round(v * 10) / 10 : v));
}
/* tiene solo le variabili che il sito usa davvero */
function slimWx(d){
  if(!d) return d;
  const keep = ["time", "temperature_2m", "snow_c", "precipitation", "snow_depth", "freezing_level_height", "cloud_cover",
                "weather_code", "wind_speed_10m", "wind_gusts_10m", "wind_speed_700hPa", "wind_direction_700hPa"];
  const H = {}; keep.forEach(k => { if(d.hourly && d.hourly[k]) H[k] = d.hourly[k]; });
  return {current: d.current, hourly: H, daily: d.daily};
}

const roundOnly = obj => JSON.parse(JSON.stringify(obj, (k, v) => typeof v === "number" ? Math.round(v * 10) / 10 : v));

/* Piano B: se Open-Meteo non risponde, riprendiamo meteo e modelli dall'ultimo file
   pubblicato sul sito (stazioni e bollettini restano freschi). Il campo "generated"
   resta quello del meteo riusato: dopo 3 ore il sito scarica i dati da solo. */
async function ultimoPubblicato(){
  const base = process.env.SITO_URL;
  if(!base) return null;
  try{
    const r = await fetch(base.replace(/\/?$/, "/") + "dati/ultimo.json", {cache: "no-store"});
    if(!r.ok) return null;
    const j = unpackTimes(await r.json());
    return j && j.wx && !j.demo ? j : null;
  }catch(e){ return null; }
}

/* calibrazione dei modelli (scritta da scripts/calibra.mjs nel ramo "dati"): fattori e pesi */
async function caricaCalibrazione(){
  try{
    const c = JSON.parse(await readFile(resolve(ARCH_DIR, "calibrazione.json"), "utf8"));
    const models = {};
    for(const id in c.models){ const m = c.models[id]; models[id] = {ok: m.ok, n: m.n, factor: m.factor, weight: m.weight}; }
    const v = c.verifica && c.verifica[1];
    state.cal = {generated: c.generated, stagioni: c.stagioni, stazioni: (c.stazioni || []).length, models,
      verifica: v ? {n: v.calibrato.n, prima: v.grezzo.mae, dopo: v.calibrato.mae} : null};
    log("calibrazione:", Object.entries(models).map(([k, m]) => `${k} ×${m.factor} peso ${m.weight.toFixed(2)}${m.ok ? "" : " (neutro)"}`).join(", "));
  }catch(e){ log("calibrazione: non presente, modelli non corretti"); }
}

let riuso = null;   // orario del meteo riusato, se Open-Meteo non ha risposto

async function main(){
  const t0 = Date.now();
  await caricaCalibrazione();
  if(DEMO){
    log("modalità dimostrativa");
    demoWeather(); demoModels(); state.stations = []; state.av = {};
  }else{
    const res = await Promise.allSettled([loadWeather(), loadModels(), loadAvalanche(), loadStations()]);
    const names = ["meteo", "modelli", "valanghe", "stazioni"];
    res.forEach((r, i) => log(names[i].padEnd(9), r.status === "fulfilled" ? "ok" : "ERRORE " + (r.reason && r.reason.message)));
    const meteoOk = !!state.wx[SPOTS[0].id], modelliOk = Object.keys(state.ens || {}).length > 0;
    if(!meteoOk || !modelliOk){
      const prev = await ultimoPubblicato();
      const eta = prev ? Math.round((Date.now() - new Date(prev.generated).getTime()) / 60000) : null;
      if(prev && eta < 24 * 60){
        if(!meteoOk){ state.wx = prev.wx; riuso = prev.generated; }
        if(!modelliOk && prev.ens){ state.ens = prev.ens; state.ensMemo = {}; }
        if(!(state.stations || []).length && prev.stations) state.stations = prev.stations;
        log(`Open-Meteo non risponde: riuso ${!meteoOk ? "meteo e " : ""}${!modelliOk ? "modelli" : ""} dell'ultimo giro riuscito (${eta} minuti fa)`);
      }else log("Open-Meteo non risponde e non c'è un giro recente da riusare");
    }
  }
  log("modelli ricevuti:", Object.keys(state.ens || {}).join(", ") || "nessuno",
      "| stazioni:", (state.stations || []).length,
      state.stationsNet ? `(Euregio ${state.stationsNet.euregio}, ARPAV ${state.stationsNet.arpav}${state.stationsNet.arpavErr ? " – errore ARPAV: " + state.stationsNet.arpavErr : ""})` : "",
      "| bollettini:", Object.keys(state.av || {}).join(", ") || "nessuno");
  if(!DEMO && !state.wx[SPOTS[0].id]) throw new Error("Meteo non disponibile: non aggiorno il file per non pubblicare dati vuoti");

  /* ---------- file per il sito ---------- */
  const wx = {}; for(const s of SPOTS) wx[s.id] = slimWx(state.wx[s.id]);
  const snapshot = round({
    generated: riuso || new Date().toISOString(), demo: DEMO, aggiornato: new Date().toISOString(),
    wx, ens: state.ens, av: state.av, avDate: state.avDate, avErr: state.avErr, stations: state.stations,
    sources: {meteo: "Open-Meteo.com (CC BY 4.0)", stazioni: "Meteo Alto Adige, Meteotrentino via avalanche.report (CC BY 4.0); ARPAV Veneto (CC BY 4.0)", valanghe: "Bollettini EAWS/AINEVA"}
  });
  snapshot.cal = state.cal;   // fuori dall'arrotondamento: i fattori servono con due decimali
  await mkdir(dirname(OUT), {recursive: true});
  const txt = JSON.stringify(snapshot);
  await writeFile(OUT, txt);
  log(`scritto ${OUT.replace(ROOT + "/", "")} (${(txt.length / 1024).toFixed(0)} KB)`);
  // copia della calibrazione per il sito quando scarica i dati da solo
  if(state.cal) await writeFile(resolve(dirname(OUT), "calibrazione.json"), JSON.stringify(state.cal));

  /* ---------- archivio giornaliero (una volta al giorno) ---------- */
  const today = romeNowISO().slice(0, 10);
  const archFile = resolve(ARCH_DIR, `${today}.json`);
  const exists = await access(archFile).then(() => true, () => false);
  if(riuso){
    log("archivio: salto oggi questo giro (meteo non aggiornato)");
  }else if(exists && !process.argv.includes("--forza-archivio")){
    log("archivio di oggi già presente:", archFile.replace(ROOT + "/", ""));
  }else{
    const spots = {};
    for(const s of SPOTS){
      const e = ensembleFor(s), plan = dailyPlan(s), av = avForSpot(s);
      spots[s.id] = {
        elev: s.elev,
        // previsione per i prossimi 7 giorni: Previsione FreeRide, modello principale e singoli modelli
        forecast: plan.slice(0, 7).map(d => ({
          date: d.date, freeride: d.snow, base: d.base,
          models: d.ens ? d.ens.models : {},
          wind: d.ens && d.ens.wind ? d.ens.wind.models : {},
          regime: d.regime ? d.regime.key : null, regimes: d.ens && d.ens.wind ? d.ens.wind.regimes : {}
        })),
        // neve misurata dalle stazioni vicine (Δ 24h = neve nuova delle ultime 24 ore)
        stations: stationsFor(s).map(st => ({id: st.id, name: st.name, elev: st.elev, km: st.km, hs: st.hs, d24: st.d24, d48: st.d48, d72: st.d72, date: st.date})),
        avalanche: av ? {level: av.level, exact: av.exact} : null
      };
    }
    await mkdir(ARCH_DIR, {recursive: true});
    await writeFile(archFile, JSON.stringify(roundOnly({date: today, generated: new Date().toISOString(), demo: DEMO, models: MODELS.map(m => m.id),
      // i cm dei modelli sono già moltiplicati per questi fattori (dividere per riavere i valori grezzi)
      calFactors: state.cal ? Object.fromEntries(Object.entries(state.cal.models).map(([k, m]) => [k, m.ok ? m.factor : 1])) : null, spots}), null, 1));
    log("scritto archivio:", archFile.replace(ROOT + "/", ""));
  }
  log(`fatto in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main().catch(e => { console.error("ERRORE:", e.message); process.exit(1); });
