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
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SPOTS, MODELS } from "../js/config.js";
import { state } from "../js/state.js";
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

async function main(){
  const t0 = Date.now();
  if(DEMO){
    log("modalità dimostrativa");
    demoWeather(); demoModels(); state.stations = []; state.av = {};
  }else{
    const res = await Promise.allSettled([loadWeather(), loadModels(), loadAvalanche(), loadStations()]);
    const names = ["meteo", "modelli", "valanghe", "stazioni"];
    res.forEach((r, i) => log(names[i].padEnd(9), r.status === "fulfilled" ? "ok" : "ERRORE " + (r.reason && r.reason.message)));
    if(res[0].status !== "fulfilled") throw new Error("Meteo non disponibile: non aggiorno il file per non pubblicare dati vuoti");
  }
  log("modelli ricevuti:", Object.keys(state.ens || {}).join(", ") || "nessuno",
      "| stazioni:", (state.stations || []).length,
      "| bollettini:", Object.keys(state.av || {}).join(", ") || "nessuno");

  /* ---------- file per il sito ---------- */
  const wx = {}; for(const s of SPOTS) wx[s.id] = slimWx(state.wx[s.id]);
  const snapshot = round({
    generated: new Date().toISOString(), demo: DEMO,
    wx, ens: state.ens, av: state.av, avDate: state.avDate, avErr: state.avErr, stations: state.stations,
    sources: {meteo: "Open-Meteo.com (CC BY 4.0)", stazioni: "Meteo Alto Adige, Meteotrentino via avalanche.report (CC BY 4.0)", valanghe: "Bollettini EAWS/AINEVA"}
  });
  await mkdir(dirname(OUT), {recursive: true});
  const txt = JSON.stringify(snapshot);
  await writeFile(OUT, txt);
  log(`scritto ${OUT.replace(ROOT + "/", "")} (${(txt.length / 1024).toFixed(0)} KB)`);

  /* ---------- archivio giornaliero (una volta al giorno) ---------- */
  const today = romeNowISO().slice(0, 10);
  const archFile = resolve(ARCH_DIR, `${today}.json`);
  const exists = await access(archFile).then(() => true, () => false);
  if(exists && !process.argv.includes("--forza-archivio")){
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
    await writeFile(archFile, JSON.stringify(roundOnly({date: today, generated: new Date().toISOString(), demo: DEMO, models: MODELS.map(m => m.id), spots}), null, 1));
    log("scritto archivio:", archFile.replace(ROOT + "/", ""));
  }
  log(`fatto in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main().catch(e => { console.error("ERRORE:", e.message); process.exit(1); });
