import { SPOTS, FORECAST_DAYS, WORKER_URL } from "./config.js";
import { state, LS, fetchRetry } from "./state.js";
import { correctHourly, ensembleFor, dayRegime } from "./modelli.js";

/* =========================================================
   METEO — Open-Meteo (oppure il Worker, se WORKER_URL è impostato)
   ========================================================= */
export const WMO = {0:["☀️","Sereno"],1:["🌤","Poco nuvoloso"],2:["⛅","Parz. nuvoloso"],3:["☁️","Coperto"],45:["🌫","Nebbia"],48:["🌫","Nebbia con brina"],
 51:["🌦","Pioviggine"],53:["🌦","Pioviggine"],55:["🌧","Pioviggine forte"],56:["🌧","Pioviggine gelata"],57:["🌧","Pioviggine gelata"],
 61:["🌧","Pioggia debole"],63:["🌧","Pioggia"],65:["🌧","Pioggia forte"],66:["🌧","Pioggia gelata"],67:["🌧","Pioggia gelata"],
 71:["🌨","Neve debole"],73:["🌨","Neve"],75:["❄️","Neve forte"],77:["🌨","Granuli di neve"],80:["🌦","Rovesci"],81:["🌧","Rovesci"],82:["⛈","Rovesci forti"],
 85:["🌨","Rovesci di neve"],86:["❄️","Rovesci di neve forti"],95:["⛈","Temporale"],96:["⛈","Temporale"],99:["⛈","Temporale"]};
export const wmo = c => WMO[c] || ["·", "—"];
export const DIRS = ["N","NE","E","SE","S","SO","O","NO"];
export const dirName = d => d == null ? "" : DIRS[Math.round((d % 360) / 45) % 8];

export function wxQuery(){
  return new URLSearchParams({
    latitude: SPOTS.map(s => s.lat).join(","),
    longitude: SPOTS.map(s => s.lon).join(","),
    elevation: SPOTS.map(s => s.elev).join(","),
    current: "temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover",
    hourly: "temperature_2m,snowfall,precipitation,snow_depth,freezing_level_height,cloud_cover,weather_code,wind_speed_10m,wind_gusts_10m,wind_speed_700hPa,wind_direction_700hPa",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,wind_gusts_10m_max,wind_direction_10m_dominant,sunshine_duration",
    past_days: 3, forecast_days: FORECAST_DAYS, timezone: "Europe/Rome", wind_speed_unit: "kmh"
  }).toString();
}
export async function loadWeather(){
  const url = WORKER_URL ? `${WORKER_URL}/api/meteo?${wxQuery()}` : `https://api.open-meteo.com/v1/forecast?${wxQuery()}`;
  const res = await fetchRetry(url);
  if(!res.ok) throw new Error("Meteo HTTP " + res.status);
  let data = await res.json();
  if(!Array.isArray(data)) data = [data];
  SPOTS.forEach((s, i) => { state.wx[s.id] = data[i]; if(data[i]) correctHourly(data[i].hourly); });
  LS.set("fr_wx_cache", {t: Date.now(), wx: state.wx});
}

export const sum = (a, i0, i1) => { let t = 0; for(let i = Math.max(0, i0); i <= Math.min(a.length - 1, i1); i++) t += a[i] || 0; return t; };
export const maxOf = (a, i0, i1) => { let m = -Infinity; for(let i = Math.max(0, i0); i <= Math.min(a.length - 1, i1); i++) if(a[i] != null && a[i] > m) m = a[i]; return m === -Infinity ? null : m; };
export const avg = (a, i0, i1) => { let t = 0, n = 0; for(let i = Math.max(0, i0); i <= Math.min(a.length - 1, i1); i++) if(a[i] != null){ t += a[i]; n++; } return n ? t / n : null; };

export function romeNowISO(){
  const p = new Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Rome", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false}).format(new Date());
  return p.replace(" ", "T");
}
export function addDaysISO(iso, n){ const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const dayName = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", {weekday:"short", timeZone:"UTC"});
export const dayNum = iso => +iso.slice(8, 10);
export const isWeekend = iso => [0, 6].includes(new Date(iso + "T12:00:00Z").getUTCDay());

/* Metriche per uno spot: neve passata/futura, vento in quota, indice Powder, bandierine */
export function metrics(spot){
  const d = state.wx[spot.id]; if(!d || !d.hourly) return null;
  const H = d.hourly, T = H.time, cur = d.current || {};
  let idx = cur.time ? T.indexOf(cur.time.slice(0, 13) + ":00") : -1;
  if(idx < 0){ const nowS = romeNowISO(); idx = T.findIndex(t => t > nowS) - 1; if(idx < 0) idx = 72; }
  const sf = H.snow_c || H.snowfall;
  const m = {
    idx,
    temp: cur.temperature_2m ?? H.temperature_2m[idx],
    code: cur.weather_code ?? H.weather_code[idx],
    gust: cur.wind_gusts_10m ?? H.wind_gusts_10m[idx],
    cloud: cur.cloud_cover ?? H.cloud_cover[idx],
    p24: sum(sf, idx - 23, idx), p48: sum(sf, idx - 47, idx), p72: sum(sf, idx - 71, idx),
    n24: sum(sf, idx + 1, idx + 24), n48: sum(sf, idx + 1, idx + 48), n72: sum(sf, idx + 1, idx + 72),
    n7d: sum(sf, idx + 1, idx + 168),
    depth: H.snow_depth && H.snow_depth[idx] != null ? H.snow_depth[idx] * 100 : null,
    fz: H.freezing_level_height ? H.freezing_level_height[idx] : null,
    w7: H.wind_speed_700hPa ? H.wind_speed_700hPa[idx] : null,
    w7dir: H.wind_direction_700hPa ? H.wind_direction_700hPa[idx] : null,
    w7max48: H.wind_speed_700hPa ? maxOf(H.wind_speed_700hPa, idx - 47, idx) : null
  };
  // neve in arrivo: se ci sono più modelli si usa la Previsione FreeRide (mediana)
  const ens = ensembleFor(spot);
  m.base = {n24: m.n24, n72: m.n72, n7d: m.n7d};
  if(ens){
    if(ens.n24) m.n24 = ens.n24.med;
    if(ens.n72){ m.n72 = ens.n72.med; m.n72r = ens.n72; }
    if(ens.n7d){ m.n7d = ens.n7d.med; m.n7dr = ens.n7d; }
    m.ens = ens;
  }
  const tomorrow = addDaysISO(T[idx].slice(0, 10), 1);
  const i8 = T.indexOf(tomorrow + "T08:00");
  m.cloudTomorrow = i8 >= 0 ? avg(H.cloud_cover, i8, i8 + 5) : null;

  let s = Math.min(m.p48 / 30, 1) * 5 + Math.min(m.n24 / 20, 1) * 2 + Math.min((m.depth || 0) / 100, 1) * 1.5;
  if(m.cloudTomorrow != null && m.cloudTomorrow < 40) s += (m.p48 + m.n24) >= 5 ? 1.5 : 0.5;
  if(m.w7 != null){ if(m.w7 >= 50) s -= 2; else if(m.w7 >= 30) s -= 1; }
  if(m.temp > 2) s -= 1.5; else if(m.temp > 0) s -= 0.5;
  if(m.fz != null && m.fz > spot.elev + 100) s -= 1;
  m.score = Math.max(0, Math.min(10, Math.round(s * 10) / 10));

  m.flags = [];
  if(m.p72 >= 10 && (m.w7max48 || 0) >= 40) m.flags.push(["w", "💨 Accumuli da vento"]);
  if(m.temp > 0 || (m.fz != null && m.fz > spot.elev)) m.flags.push(["w", "🌡 Neve umida"]);
  if(m.p48 >= 20) m.flags.push(["p", "❄️ Powder alert"]);
  if(m.n48 >= 15) m.flags.push(["p", "🌨 Nevicata in arrivo"]);
  if(m.cloudTomorrow != null && m.cloudTomorrow < 30 && (m.p48 + m.n24) >= 5) m.flags.push(["p", "☀️ Bluebird domani"]);
  return m;
}

/* Previsione giornaliera futura per la pianificazione: [{date, snow, code, tmax, tmin, gust, sun, conf}] */
export function dailyPlan(spot){
  const d = state.wx[spot.id]; if(!d || !d.daily) return [];
  const D = d.daily, today = romeNowISO().slice(0, 10);
  let s = D.time.indexOf(today); if(s < 0) s = 3;
  const H = d.hourly, hsnow = H && (H.snow_c || H.snowfall), byDay = {};
  if(hsnow) H.time.forEach((t, i) => { const k = t.slice(0, 10); byDay[k] = (byDay[k] || 0) + (hsnow[i] || 0); });
  const ens = ensembleFor(spot);
  const out = [];
  for(let i = s, k = 0; i < D.time.length; i++, k++){
    const date = D.time[i], base = byDay[date] ?? (D.snowfall_sum[i] || 0), e = ens && ens.days[date];
        const br = dayRegime(spot, date);
    // regime: consenso tra i modelli se disponibile, altrimenti quello del modello principale
    const regime = e && e.regime ? {key: e.regime.key, count: e.regime.count, n: e.regime.n, wet: br ? br.wet : (e.med || 0) >= 1} : br;
    out.push({date, snow: e && e.med != null ? e.med : base, base, ens: e && e.n ? e : null, regime,
      code: D.weather_code[i], tmax: D.temperature_2m_max[i], tmin: D.temperature_2m_min[i],
      gust: D.wind_gusts_10m_max[i], sun: D.sunshine_duration ? (D.sunshine_duration[i] || 0) / 3600 : null,
      conf: k <= 2 ? "alta" : k <= 5 ? "media" : "bassa"});
  }
  return out;
}

/* Miglior giornata freeride nei prossimi giorni: giorno sereno dopo nevicata */
export function bestDay(spot){
  const p = dailyPlan(spot); let best = null;
  for(let i = 1; i < p.length; i++){
    const fresh = p[i - 1].snow + (i > 1 ? p[i - 2].snow * 0.6 : 0) + p[i].snow * 0.5;
    const sunny = p[i].sun != null ? Math.min(p[i].sun / 7, 1) : ([0, 1, 2].includes(p[i].code) ? 1 : 0.3);
    const score = fresh * (0.4 + 0.6 * sunny) - Math.max(0, (p[i].gust || 0) - 50) * 0.2;
    if(fresh >= 10 && (!best || score > best.score)) best = {date: p[i].date, fresh, sunny, score, conf: p[i].conf};
  }
  return best;
}

/* Dati dimostrativi: SOLO per l'anteprima quando le API non sono raggiungibili */
export function demoWeather(){
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const now = romeNowISO().slice(0, 13) + ":00";
  const day0 = addDaysISO(now.slice(0, 10), -3), nd = 3 + FORECAST_DAYS, nh = nd * 24;
  SPOTS.forEach(s => {
    const times = [], sf = [], pr = [], tt = [], cc = [], wc = [], w7 = [], wd = [], sd = [], fz = [], g = [], ws = [];
    const storms = [60 + Math.floor(rnd() * 20), 140 + Math.floor(rnd() * 30), 230 + Math.floor(rnd() * 30)];
    let depth = 0.6 + rnd() * 0.8;
    for(let h = 0; h < nh; h++){
      times.push(`${addDaysISO(day0, Math.floor(h / 24))}T${String(h % 24).padStart(2, "0")}:00`);
      const inStorm = storms.some(st => h > st && h < st + 16);
      const snow = inStorm ? +(rnd() * 2.2 * (s.elev / 2400)).toFixed(1) : 0;
      depth += snow / 100; sf.push(snow); pr.push(+(snow / 0.7).toFixed(1)); sd.push(+depth.toFixed(2));
      tt.push(+(-4 - (s.elev - 2000) / 160 + 4 * Math.sin((h % 24 - 9) / 24 * 2 * Math.PI) + rnd()).toFixed(1));
      cc.push(inStorm ? 95 : Math.round(rnd() * 50)); wc.push(inStorm ? 73 : (cc[h] > 40 ? 2 : 0));
      w7.push(Math.round((inStorm ? 35 : 12) + rnd() * 25)); wd.push(inStorm ? Math.round(130 + rnd() * 50) : Math.round(260 + rnd() * 120));
      ws.push(Math.round(5 + rnd() * 20)); g.push(ws[h] + Math.round(rnd() * 20)); fz.push(Math.round(1200 + rnd() * 900));
    }
    const D = {time:[], weather_code:[], temperature_2m_max:[], temperature_2m_min:[], snowfall_sum:[], wind_gusts_10m_max:[], wind_direction_10m_dominant:[], sunshine_duration:[]};
    for(let i = 0; i < nd; i++){
      const sl = sf.slice(i * 24, i * 24 + 24), tl = tt.slice(i * 24, i * 24 + 24), cl = cc.slice(i * 24, i * 24 + 24);
      const tot = +sl.reduce((a, b) => a + b, 0).toFixed(1);
      D.time.push(addDaysISO(day0, i)); D.snowfall_sum.push(tot);
      D.temperature_2m_max.push(Math.max(...tl)); D.temperature_2m_min.push(Math.min(...tl));
      D.weather_code.push(tot > 5 ? 73 : tot > 0 ? 71 : 1); D.wind_gusts_10m_max.push(Math.max(...g.slice(i * 24, i * 24 + 24)));
      D.wind_direction_10m_dominant.push(250); D.sunshine_duration.push(Math.round((1 - cl.reduce((a, b) => a + b, 0) / 2400) * 9 * 3600));
    }
    const ix = times.indexOf(now);
    state.wx[s.id] = {demo:true,
      current:{time: now, temperature_2m: tt[ix], weather_code: wc[ix], wind_speed_10m: ws[ix], wind_gusts_10m: g[ix], wind_direction_10m: wd[ix], cloud_cover: cc[ix]},
      hourly:{time: times, temperature_2m: tt, snowfall: sf, precipitation: pr, snow_depth: sd, freezing_level_height: fz, cloud_cover: cc, weather_code: wc, wind_speed_10m: ws, wind_gusts_10m: g, wind_speed_700hPa: w7, wind_direction_700hPa: wd},
      daily: D};
    correctHourly(state.wx[s.id].hourly);
  });
}
