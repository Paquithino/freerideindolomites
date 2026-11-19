/* =========================================================
   CONFRONTO MODELLI e PREVISIONE FREERIDE
   - scarica da Open-Meteo la previsione di più modelli, separatamente
   - corregge la neve con un rapporto neve/acqua che dipende dalla temperatura
   - "Previsione FreeRide" = mediana dei modelli, con forbice min–max
   - regime dei venti in quota (scirocco, nordstau, bora…) ed esposizione degli spot
   ========================================================= */
import { SPOTS, MODELS, FORECAST_DAYS, WORKER_URL, FLOW_EXPOSURE, REGIMES } from "./config.js";
import { state, fetchRetry } from "./state.js";
import { romeNowISO } from "./meteo.js";
import { calOf, weightedMedian } from "./calibrazione.js";

/* ---------- rapporto neve/acqua ----------
   Open-Meteo calcola la neve con un rapporto fisso (0,7 cm per mm d'acqua).
   Qui lo facciamo dipendere dalla temperatura alla quota dello spot:
   neve bagnata vicino a 0 °C rende meno, neve fredda e leggera rende di più. */
export function snowRatio(t){
  if(t == null) return 0.7;
  if(t >= 0.5) return 0.7;
  if(t >= -1) return 0.9;
  if(t >= -4) return 1.1;
  if(t >= -8) return 1.3;
  return 1.5;
}
/* neve corretta (cm) a partire dalla neve Open-Meteo (cm) e dalla temperatura */
export const correctedSnow = (sfCm, t) => sfCm == null ? null : (sfCm / 0.7) * snowRatio(t);

export function correctHourly(H){
  if(!H || !H.snowfall) return;
  H.snow_c = H.snowfall.map((v, i) => correctedSnow(v, H.temperature_2m ? H.temperature_2m[i] : null));
}

/* ---------- download dei modelli ---------- */
function query(model){
  return new URLSearchParams({
    latitude: SPOTS.map(s => s.lat).join(","),
    longitude: SPOTS.map(s => s.lon).join(","),
    elevation: SPOTS.map(s => s.elev).join(","),
    hourly: "snowfall,temperature_2m,wind_speed_700hPa,wind_direction_700hPa,wind_gusts_10m", models: model,
    forecast_days: FORECAST_DAYS, timezone: "Europe/Rome"
  }).toString();
}
async function fetchModel(m){
  for(const name of m.names){
    const q = query(name);
    const url = WORKER_URL ? `${WORKER_URL}/api/meteo?${q}` : `https://api.open-meteo.com/v1/forecast?${q}`;
    try{
      const r = await fetchRetry(url);
      if(!r.ok) continue;
      let data = await r.json();
      if(!Array.isArray(data)) data = [data];
      const out = {};
      SPOTS.forEach((s, i) => {
        const H = data[i] && data[i].hourly; if(!H) return;
        correctHourly(H);
        // fattore di correzione della calibrazione per la zona dello spot (1 se non c'è ancora)
        const k = calOf(state.cal, m.id, s.id).factor;
        out[s.id] = {time: H.time, snow: k === 1 ? H.snow_c : H.snow_c.map(v => v == null ? null : v * k), w7: H.wind_speed_700hPa || null, d7: H.wind_direction_700hPa || null, g: H.wind_gusts_10m || null};
      });
      if(Object.keys(out).length) return out;
    }catch(e){}
  }
  return null;
}
export async function loadModels(){
  const res = await Promise.all(MODELS.map(fetchModel));
  state.ens = {}; state.ensMemo = {};
  MODELS.forEach((m, i) => { if(res[i]) state.ens[m.id] = res[i]; });
}

/* ---------- calcoli ---------- */
const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

/* Somma della neve per giorno (null se il modello non copre bene quel giorno) */
function dailySums(series){
  const days = {};
  series.time.forEach((t, i) => {
    const d = t.slice(0, 10), v = series.snow[i];
    days[d] = days[d] || {sum: 0, n: 0, miss: 0};
    if(v == null) days[d].miss++; else { days[d].sum += v; days[d].n++; }
  });
  const out = {};
  for(const d in days) out[d] = days[d].n >= 20 ? days[d].sum : null;
  return out;
}
function windowSum(series, from, hours){
  const i0 = series.time.findIndex(t => t > from);
  if(i0 < 0) return null;
  let s = 0, n = 0;
  for(let i = i0; i < Math.min(series.time.length, i0 + hours); i++){ if(series.snow[i] != null){ s += series.snow[i]; n++; } }
  return n >= hours * 0.85 ? s : null;
}
const stats = vals => { const v = vals.filter(x => x != null); return v.length ? {med: median(v), min: Math.min(...v), max: Math.max(...v), n: v.length} : null; };
/* come stats, ma la mediana è pesata con i pesi della calibrazione (chi sbaglia meno conta di più) */
const wstats = (byModel, spotId) => {
  const st = stats(Object.values(byModel)); if(!st) return null;
  if(state.cal) st.med = weightedMedian(Object.entries(byModel).map(([mid, v]) => ({v, w: calOf(state.cal, mid, spotId).weight})));
  return st;
};

/* Vento per giorno per un modello: massimo in quota, raffica massima, regime (pesato sulle ore con neve) */
function dailyWind(series){
  const out = {};
  if(!series.w7) return out;
  series.time.forEach((t, i) => {
    const d = t.slice(0, 10), sp = series.w7[i], dr = series.d7 ? series.d7[i] : null;
    const o = out[d] = out[d] || {w7: null, g: null, u: 0, v: 0, wt: 0, wet: 0};
    if(sp != null) o.w7 = Math.max(o.w7 ?? 0, sp);
    if(series.g && series.g[i] != null) o.g = Math.max(o.g ?? 0, series.g[i]);
    if(sp != null && dr != null){
      const p = series.snow[i] || 0, wt = 0.05 + p, rad = dr * Math.PI / 180;
      o.u += -sp * Math.sin(rad) * wt; o.v += -sp * Math.cos(rad) * wt; o.wt += wt; o.wet += p;
    }
  });
  for(const d in out){
    const o = out[d];
    if(o.wt){ const u = o.u / o.wt, v = o.v / o.wt; o.regime = classify((Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360, Math.hypot(u, v)); }
    delete o.u; delete o.v; delete o.wt;
  }
  return out;
}

/* Previsione combinata per uno spot */
export function ensembleFor(spot){
  if(!state.ens || !Object.keys(state.ens).length) return null;
  if(state.ensMemo[spot.id]) return state.ensMemo[spot.id];
  const now = romeNowISO().slice(0, 13) + ":00";
  const per = {}, wind = {}, sums = {n24: {}, n72: {}, n7d: {}};
  for(const mid in state.ens){
    const s = state.ens[mid][spot.id]; if(!s) continue;
    per[mid] = dailySums(s);
    wind[mid] = dailyWind(s);
    sums.n24[mid] = windowSum(s, now, 24); sums.n72[mid] = windowSum(s, now, 72); sums.n7d[mid] = windowSum(s, now, 168);
  }
  const dates = [...new Set(Object.values(per).flatMap(o => Object.keys(o)))].sort();
  const days = {};
  for(const d of dates){
    const models = {}; for(const mid in per) models[mid] = per[mid][d] ?? null;
    const w = {}, g = {}, reg = {};
    for(const mid in wind){ const x = wind[mid][d]; if(!x || per[mid][d] == null) continue; w[mid] = x.w7; g[mid] = x.g; reg[mid] = x.regime; }
    // regime per consenso: quello indicato dal maggior numero di modelli
    const cnt = {}; Object.values(reg).forEach(k => { if(k) cnt[k] = (cnt[k] || 0) + 1; });
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    days[d] = {...(wstats(models, spot.id) || {}), models,
      wind: {w7: stats(Object.values(w)), g: stats(Object.values(g)), models: w, regimes: reg},
      regime: top ? {key: top, count: cnt[top], n: Object.values(reg).filter(Boolean).length} : null};
  }
  const res = {days, n24: wstats(sums.n24, spot.id), n72: wstats(sums.n72, spot.id), n7d: wstats(sums.n7d, spot.id), models: Object.keys(per)};
  state.ensMemo[spot.id] = res;
  return res;
}

/* Quanto sono d'accordo i modelli: forbice stretta = previsione più affidabile */
export function agreement(st){
  if(!st || st.n < 2) return null;
  const spread = st.max - st.min;
  if(st.max < 2) return {lvl: "alta", txt: "modelli d'accordo: niente neve"};
  if(spread <= Math.max(4, st.med * 0.4)) return {lvl: "alta", txt: "modelli d'accordo"};
  if(spread <= Math.max(10, st.med * 1.0)) return {lvl: "media", txt: "modelli in parte discordi"};
  return {lvl: "bassa", txt: "modelli molto discordi"};
}

/* ---------- regime dei venti ----------
   Direzione del vento a 700 hPa (~3.000 m), pesata sulle ore con precipitazione:
   è il flusso che "spinge" l'umidità contro le montagne. */
export function classify(dir, speed){
  if(dir == null || speed == null || speed < 15) return "CALM";
  const d = (dir % 360 + 360) % 360;
  if(d >= 100 && d < 170) return "SE";
  if(d >= 170 && d < 250) return "SW";
  if(d >= 250 && d < 300) return "W";
  if(d >= 300 || d < 30) return "N";
  return "NE";
}
export function dayRegime(spot, date){
  const H = state.wx[spot.id] && state.wx[spot.id].hourly; if(!H || !H.wind_direction_700hPa) return null;
  let u = 0, v = 0, w = 0, pr = 0;
  H.time.forEach((t, i) => {
    if(!t.startsWith(date)) return;
    const sp = H.wind_speed_700hPa[i], dr = H.wind_direction_700hPa[i]; if(sp == null || dr == null) return;
    const p = H.precipitation ? (H.precipitation[i] || 0) : 0;
    pr += p;
    const wt = 0.05 + p;      // le ore con precipitazione contano di più
    const rad = dr * Math.PI / 180;
    u += -sp * Math.sin(rad) * wt; v += -sp * Math.cos(rad) * wt; w += wt;
  });
  if(!w) return null;
  u /= w; v /= w;
  const speed = Math.hypot(u, v), dir = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
  return {key: classify(dir, speed), dir, speed, wet: pr >= 1};
}
/* Regime "dominante" della regione per un giorno (il più frequente tra gli spot) */
export function regionRegime(date){
  const c = {};
  SPOTS.forEach(s => { const r = dayRegime(s, date); if(r) c[r.key] = (c[r.key] || 0) + 1 + (r.wet ? 1 : 0); });
  const k = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  return k || null;
}
/* Effetto atteso del regime sullo spot (ipotesi da letteratura, da verificare con i dati) */
export function flowEffect(spot, key){
  const ex = FLOW_EXPOSURE[spot.flow] || {};
  const v = ex[key] ?? 0;
  if(v >= 2) return {cls: "g", txt: "flusso favorevole (stau)"};
  if(v === 1) return {cls: "", txt: "flusso a volte favorevole"};
  if(v < 0) return {cls: "w", txt: "sottovento: föhn, poca neve"};
  return null;
}
export const regimeLabel = k => REGIMES[k] || REGIMES.CALM;

/* Dati dimostrativi per l'anteprima (mai usati con dati reali disponibili) */
export function demoModels(){
  state.ens = {}; state.ensMemo = {};
  let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  MODELS.forEach((m, k) => {
    const out = {};
    SPOTS.forEach(s => {
      const H = state.wx[s.id] && state.wx[s.id].hourly; if(!H) return;
      const f = 0.6 + rnd() * 0.8, shift = Math.round((rnd() - 0.5) * 6);
      const snow = H.snow_c.map((_, i) => { const j = Math.min(H.snow_c.length - 1, Math.max(0, i + shift)); return H.snow_c[j] * f; });
      const short = m.id === "icon2i" ? 72 + 72 : null;   // ICON-2I copre pochi giorni
      const w7 = H.wind_speed_700hPa.map(v => v == null ? null : Math.round(v * (0.8 + rnd() * 0.4)));
      const d7 = H.wind_direction_700hPa.map(v => v == null ? null : (v + (rnd() - 0.5) * 60 + 360) % 360);
      const g = H.wind_gusts_10m.map(v => v == null ? null : Math.round(v * (0.8 + rnd() * 0.4)));
      const cut = a => short ? a.map((v, i) => i < short ? v : null) : a;
      out[s.id] = {time: H.time, snow: cut(snow), w7: cut(w7), d7: cut(d7), g: cut(g)};
    });
    state.ens[m.id] = out;
  });
}
