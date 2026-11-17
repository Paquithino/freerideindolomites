/* =========================================================
   NEVE MISURATA — stazioni automatiche Alto Adige e Trentino
   Fonte: rete stazioni Euregio pubblicata da avalanche.report (CC BY 4.0)
   Campi usati: HS = altezza neve (cm), HSD24/48/72 = variazione altezza neve (cm),
                LT = temperatura aria (°C), LWD-Region = zona del bollettino valanghe
   ========================================================= */
import { WORKER_URL, STATIONS_MAX_KM, STATIONS_PER_SPOT } from "./config.js";
import { state, esc, r0 } from "./state.js";

const BASE = "https://static.avalanche.report/weather_stations/";

/* nomi file: prima quello "ultimo", poi quelli orari delle ultime 3 ore (in UTC) */
function candidateUrls(){
  const urls = [BASE + "stations.geojson"];
  for(let h = 0; h < 3; h++){
    const d = new Date(Date.now() - h * 3600e3);
    const p = n => String(n).padStart(2, "0");
    urls.push(`${BASE}${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}-00_stations.geojson`);
  }
  return urls;
}

const num = v => (v === null || v === undefined || v === "" || isNaN(+v)) ? null : +v;

function normalize(geo){
  const out = [];
  for(const f of (geo && geo.features) || []){
    const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
    const hs = num(p.HS);
    if(hs === null || c.length < 2) continue;
    const lon = +c[0], lat = +c[1];
    // solo l'area che ci interessa (Dolomiti e dintorni)
    if(lat < 45.9 || lat > 47.0 || lon < 10.5 || lon > 13.3) continue;
    out.push({
      id: p["LWD-Nummer"] || p.name, name: p.name || p["LWD-Nummer"] || "Stazione",
      lat, lon, elev: num(c[2]) ?? num(p.altitude),
      hs, d24: num(p.HSD24), d48: num(p.HSD48), d72: num(p.HSD72),
      lt: num(p.LT), region: p["LWD-Region"] || "", operator: p.operator || "", date: p.date || null
    });
  }
  return out;
}

export async function loadStations(){
  if(WORKER_URL){
    try{
      const r = await fetch(`${WORKER_URL}/api/stazioni`);
      if(r.ok){ const j = await r.json(); state.stations = j.stations || []; state.stationsDate = j.updated || null; return; }
    }catch(e){}
  }
  for(const u of candidateUrls()){
    try{
      const r = await fetch(u);
      if(!r.ok) continue;
      const list = normalize(await r.json());
      if(list.length){ state.stations = list; state.stationsDate = new Date().toISOString(); return; }
    }catch(e){}
  }
  state.stations = [];
}

function distKm(a, b, c, d){
  const R = 6371, t = x => x * Math.PI / 180;
  const dl = t(c - a), dg = t(d - b);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dg / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Stazioni più rappresentative per uno spot: vicine e a quota simile (100 m di dislivello "pesano" come 1 km) */
export function stationsFor(spot){
  const list = (state.stations || []).map(s => {
    const km = distKm(spot.lat, spot.lon, s.lat, s.lon);
    const dz = s.elev != null ? s.elev - spot.elev : 0;
    return {...s, km, dz, rank: km + Math.abs(dz) / 100};
  }).filter(s => s.km <= STATIONS_MAX_KM);
  return list.sort((a, b) => a.rank - b.rank).slice(0, STATIONS_PER_SPOT);
}

/* Valore sintetico per lista/tabella: la stazione migliore */
export function bestStation(spot){ return stationsFor(spot)[0] || null; }

const delta = v => v == null ? "–" : (v >= 0.5 ? "+" + r0(v) : v <= -0.5 ? r0(v) : "0");
const ago = iso => {
  if(!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 90 ? `${Math.max(min, 0)} min fa` : `${Math.round(min / 60)} h fa`;
};

export function stationsHTML(spot){
  const st = stationsFor(spot);
  if(!st.length){
    return `<p class="note" style="margin:0">${state.stations && state.stations.length
      ? `Nessuna stazione nivometrica Euregio entro ${STATIONS_MAX_KM} km. Per Veneto e Friuli le stazioni ARPAV e FVG verranno aggiunte più avanti.`
      : "Dati delle stazioni non disponibili al momento."}</p>`;
  }
  return `<div class="st-wrap"><table class="st">
    <thead><tr><th class="l">Stazione</th><th>Neve al suolo</th><th>Δ 24h</th><th>Δ 48h</th><th>Δ 72h</th><th class="t">Temp.</th></tr></thead>
    <tbody>${st.map(s => `<tr>
      <td class="l"><b>${esc(s.name)}</b><span>${s.elev != null ? r0(s.elev).toLocaleString("it-IT") + " m" : ""} · ${r0(s.km)} km${s.date ? " · " + ago(s.date) : ""}</span></td>
      <td class="hs">${r0(s.hs)} cm</td>
      <td class="${(s.d24 || 0) >= 1 ? "up" : ""}">${delta(s.d24)}</td>
      <td class="${(s.d48 || 0) >= 1 ? "up" : ""}">${delta(s.d48)}</td>
      <td class="${(s.d72 || 0) >= 1 ? "up" : ""}">${delta(s.d72)}</td>
      <td class="t">${s.lt != null ? r0(s.lt) + "°" : "–"}</td></tr>`).join("")}</tbody></table></div>
    <p class="small" style="margin:8px 0 0">Misure delle stazioni automatiche (Meteo Alto Adige, Meteotrentino) via avalanche.report. Δ = variazione dell'altezza neve: con nevicate in corso è la neve nuova, dopo può calare per assestamento.</p>`;
}
