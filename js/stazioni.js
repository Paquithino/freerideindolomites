/* =========================================================
   NEVE MISURATA — stazioni automatiche
   Fonti: rete stazioni Euregio pubblicata da avalanche.report (CC BY 4.0) per Alto Adige e Trentino,
          stazioni nivometriche ARPAV (CC BY 4.0) per il Veneto — vedi stazioni-arpav.js
   Campi usati: HS = altezza neve (cm), HSD24/48/72 = variazione altezza neve (cm),
                LT = temperatura aria (°C), LWD-Region = zona del bollettino valanghe
   ========================================================= */
import { WORKER_URL, STATIONS_MAX_KM, STATIONS_PER_SPOT, SPOTS } from "./config.js";
import { loadArpav } from "./stazioni-arpav.js";
import { state, esc, r0 } from "./state.js";

export const BASE = "https://static.avalanche.report/weather_stations/";
/* file orario della rete Euregio (orario UTC nel nome) */
export function urlOraEuregio(ms){
  const d = new Date(ms), p = n => String(n).padStart(2, "0");
  return `${BASE}${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}-00_stations.geojson`;
}

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

export function normalize(geo){
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
      lt: num(p.LT), region: p["LWD-Region"] || "", operator: p.operator || "", date: p.date || null,
      // vento (dove la stazione lo misura): VW = medio, VW_MAX = massimo/raffica in km/h, DW = direzione in gradi
      vw: num(p.VW), vwmax: num(p.VW_MAX), dw: num(p.DW)
    });
  }
  return out;
}

async function loadEuregio(){
  for(const u of candidateUrls()){
    try{
      const r = await fetch(u);
      if(!r.ok) continue;
      const list = normalize(await r.json());
      if(list.length) return list;
    }catch(e){}
  }
  return [];
}

export async function loadStations(){
  if(WORKER_URL){
    try{
      const r = await fetch(`${WORKER_URL}/api/stazioni`);
      if(r.ok){ const j = await r.json(); state.stations = j.stations || []; state.stationsDate = j.updated || null; return; }
    }catch(e){}
  }
  // le due reti in parallelo: se una non risponde, teniamo l'altra
  const [eu, ve] = await Promise.allSettled([loadEuregio(), loadArpav(SPOTS, STATIONS_MAX_KM, distKm)]);
  state.stationsNet = {
    euregio: eu.status === "fulfilled" ? eu.value.length : 0,
    arpav: ve.status === "fulfilled" ? ve.value.length : 0,
    arpavErr: ve.status === "rejected" ? String(ve.reason && ve.reason.message || ve.reason) : null
  };
  state.stations = [...(eu.status === "fulfilled" ? eu.value : []), ...(ve.status === "fulfilled" ? ve.value : [])];
  state.stationsDate = state.stations.length ? new Date().toISOString() : null;
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

function credits(st){
  const c = [];
  if(st.some(s => s.operator !== "ARPAV")) c.push("Meteo Alto Adige e Meteotrentino via avalanche.report");
  if(st.some(s => s.operator === "ARPAV")) c.push("ARPAV Veneto (dati in tempo reale non validati, CC BY 4.0)");
  return c.join("; ");
}

export function stationsHTML(spot){
  const st = stationsFor(spot);
  if(!st.length){
    return `<p class="note" style="margin:0">${state.stations && state.stations.length
      ? (spot.area === "Friuli VG"
        ? `Nessuna stazione con dati aperti entro ${STATIONS_MAX_KM} km. Le stazioni del Friuli Venezia Giulia verranno aggiunte appena disponibili.`
        : `Nessuna stazione nivometrica entro ${STATIONS_MAX_KM} km.`)
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
    <p class="small" style="margin:8px 0 0">Misure delle stazioni automatiche: ${credits(st)}. Δ = variazione dell'altezza neve: con nevicate in corso è la neve nuova, dopo può calare per assestamento.</p>`;
}
