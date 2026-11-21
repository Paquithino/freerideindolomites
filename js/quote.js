/* =========================================================
   NEVE PER QUOTA — Vetta / Metà / Base
   Per ogni spot chiediamo a Open-Meteo la previsione alle tre quote (spot.q):
   Open-Meteo corregge la temperatura per la quota richiesta, la precipitazione
   (l'acqua) resta quella del modello. A ogni quota decidiamo noi, ora per ora,
   se è neve, mista o pioggia e quanti cm rende, in base alla temperatura.
   ========================================================= */
import { SPOTS, WORKER_URL } from "./config.js";
import { t as tr, num } from "./i18n.js";
import { state, esc, r0, fetchRetry, snowColor } from "./state.js";
import { snowRatio } from "./modelli.js";
import { romeNowISO, dayName, dayNum } from "./meteo.js";

export const LIVELLI = [
  {k: "top", nome: "Vetta"},
  {k: "mid", nome: "Metà"},
  {k: "base", nome: "Base"}
];
const QUOTE_DAYS = 7;

/* quota di neve che cade come neve (0..1) in funzione della temperatura:
   tutta neve fino a +0,5 °C, tutta pioggia da +2,5 °C, in mezzo mista */
export function frazioneNeve(t){
  if(t == null) return 0;
  if(t <= 0.5) return 1;
  if(t >= 2.5) return 0;
  return (2.5 - t) / 2;
}

function query(){
  const lat = [], lon = [], ele = [];
  for(const s of SPOTS) for(const l of LIVELLI){ lat.push(s.lat); lon.push(s.lon); ele.push(s.q ? s.q[l.k] : s.elev); }
  return new URLSearchParams({
    latitude: lat.join(","), longitude: lon.join(","), elevation: ele.join(","),
    hourly: "precipitation,temperature_2m,freezing_level_height,wind_speed_10m,wind_gusts_10m",
    forecast_days: QUOTE_DAYS, timezone: "Europe/Rome", wind_speed_unit: "kmh"
  }).toString();
}

/* riassunto giornaliero di una quota */
export function giorni(H){
  const out = {};
  (H.time || []).forEach((t, i) => {
    const d = t.slice(0, 10), p = H.precipitation[i] || 0, T = H.temperature_2m[i];
    const o = out[d] = out[d] || {mm: 0, neveMM: 0, cm: 0, tP: 0, tmin: null, tmax: null, g: null, n: 0};
    const fs = frazioneNeve(T);
    o.mm += p; o.neveMM += p * fs; o.cm += p * fs * snowRatio(T);
    if(p > 0) o.tP += T * p;                           // temperatura media durante la precipitazione
    if(T != null){ o.tmin = Math.min(o.tmin ?? T, T); o.tmax = Math.max(o.tmax ?? T, T); }
    if(H.wind_gusts_10m[i] != null) o.g = Math.max(o.g ?? 0, H.wind_gusts_10m[i]);
    o.n++;
  });
  for(const d in out){
    const o = out[d];
    if(o.n < 20){ delete out[d]; continue; }
    const tP = o.mm > 0 ? o.tP / o.mm : null, f = o.mm > 0 ? o.neveMM / o.mm : 0;
    // tipo di precipitazione del giorno
    o.tipo = o.mm < 0.5 ? null : f <= 0.3 ? "pioggia" : f < 0.9 ? "mista" : tP <= -4 ? "polvere" : tP <= -1 ? "neve" : "bagnata";
    o.pioggia = o.mm - o.neveMM;
    delete o.tP; delete o.neveMM; delete o.n;
  }
  return out;
}

/* zero termico e quota neve del giorno (dalla quota media, durante le ore di precipitazione) */
export function zeroTermico(H){
  const out = {};
  const byDay = {};
  (H.time || []).forEach((t, i) => {
    const d = t.slice(0, 10), z = H.freezing_level_height && H.freezing_level_height[i];
    if(z == null) return;
    const b = byDay[d] = byDay[d] || {all: [], wet: []};
    b.all.push(z); if((H.precipitation[i] || 0) >= 0.2) b.wet.push(z);
  });
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  for(const d in byDay){
    const b = byDay[d];
    const zt = med(b.all);
    // la neve arriva di solito 200–400 m sotto lo zero termico: usiamo 300 m
    const qn = b.wet.length >= 2 ? Math.max(0, Math.round((med(b.wet) - 300) / 50) * 50) : null;
    out[d] = {zt: Math.round(zt / 50) * 50, qn};
  }
  return out;
}

export async function loadQuote(){
  const q = query();
  const url = WORKER_URL ? `${WORKER_URL}/api/meteo?${q}` : `https://api.open-meteo.com/v1/forecast?${q}`;
  const r = await fetchRetry(url);
  if(!r.ok) throw new Error("Quote HTTP " + r.status);
  let data = await r.json();
  if(!Array.isArray(data)) data = [data];
  const out = {};
  SPOTS.forEach((s, i) => {
    const lv = {};
    LIVELLI.forEach((l, j) => {
      const d = data[i * LIVELLI.length + j];
      if(d && d.hourly) lv[l.k] = {elev: s.q ? s.q[l.k] : s.elev, d: giorni(d.hourly)};
    });
    const mid = data[i * LIVELLI.length + 1];
    out[s.id] = {lv, z: mid && mid.hourly ? zeroTermico(mid.hourly) : {}};
  });
  state.quote = out;
}

/* ---------- tabella nella scheda dello spot ---------- */
const ICONA = {polvere: "❄️", neve: "❄", bagnata: "💧", mista: "🌨", pioggia: "🌧"};
const NOME = {polvere: "neve asciutta", neve: "neve", bagnata: "neve bagnata", mista: "neve e pioggia", pioggia: "pioggia"};

export function quoteHTML(spot){
  const Q = state.quote && state.quote[spot.id];
  if(!Q || !Object.keys(Q.lv || {}).length) return `<p class="note" style="margin:0">${tr("Previsione per quota non disponibile al momento.")}</p>`;
  const today = romeNowISO().slice(0, 10);
  const dates = Object.keys((Q.lv.top || Q.lv.mid || {}).d || {}).filter(d => d >= today).slice(0, 6);
  const cella = x => {
    if(!x) return `<td class="z">${tr("n.d.")}</td>`;
    const t = x.tmax != null ? `${r0(x.tmin)}/${r0(x.tmax)}°` : "";
    if(!x.tipo) return `<td class="z">–<span>${t}</span></td>`;
    if(x.tipo === "pioggia") return `<td class="qr" title="${tr("pioggia")}">${ICONA.pioggia} ${r0(x.pioggia)} mm<span>${t}</span></td>`;
    const cm = x.cm;
    return `<td class="${cm >= 1 ? "s" : "z"}" ${cm >= 1 ? `style="--sc:${snowColor(cm) || "#bae6fd"}"` : ""} title="${tr(NOME[x.tipo])}">${cm >= 0.5 ? r0(cm) : "–"} ${ICONA[x.tipo]}<span>${t}</span></td>`;
  };
  const righe = LIVELLI.filter(l => Q.lv[l.k]).map(l => {
    const L = Q.lv[l.k];
    return `<tr><td class="l"><b>${tr(l.nome)}</b><span>${num(r0(L.elev))} m</span></td>${dates.map(d => cella(L.d[d])).join("")}</tr>`;
  }).join("");
  const zt = `<tr class="zt"><td class="l">${tr("Quota neve")}<span>${tr("zero termico")}</span></td>${dates.map(d => {
    const z = Q.z[d];
    if(!z) return `<td class="z">–</td>`;
    return `<td>${z.qn != null ? `<b>${num(r0(z.qn))}</b>` : "–"}<span>0° ${num(r0(z.zt))}</span></td>`;
  }).join("")}</tr>`;
  return `<div class="st-wrap"><table class="mdl qt">
    <thead><tr><th class="l">${tr("cm di neve")}</th>${dates.map((d, i) => `<th>${i === 0 ? tr("Oggi") : dayName(d)}<br>${dayNum(d)}</th>`).join("")}</tr></thead>
    <tbody>${righe}${zt}</tbody></table></div>
    <p class="small" style="margin:8px 0 0">${tr("❄️ neve asciutta (sotto −4 °C) · ❄ neve · 💧 neve bagnata · 🌨 neve e pioggia · 🌧 pioggia. Sotto ogni valore: temperatura minima/massima del giorno a quella quota.")}
    ${tr("Quote: base in paese, vetta in cima agli impianti")}${spot.q && spot.q.nota ? ` (${tr("qui")} ${esc(spot.q.nota)})` : ""}, ${tr("metà a metà. Quota neve stimata 300 m sotto lo zero termico durante le precipitazioni.")}
    ${tr("La quantità d'acqua è la stessa per le tre quote (i modelli vedono solo in parte l'effetto delle montagne): cambia se cade come neve o pioggia e quanto rende.")}</p>`;
}

/* dati dimostrativi: partono dalla previsione dello spot e spostano la temperatura con la quota (−0,65 °C ogni 100 m) */
export function demoQuote(){
  const out = {};
  for(const s of SPOTS){
    const H = state.wx[s.id] && state.wx[s.id].hourly; if(!H) continue;
    const lv = {};
    for(const l of LIVELLI){
      const elev = s.q ? s.q[l.k] : s.elev, dT = (s.elev - elev) * 0.0065;
      const h = {time: H.time, precipitation: H.precipitation || H.time.map(() => 0),
        temperature_2m: H.temperature_2m.map(t => t == null ? null : t + dT),
        wind_gusts_10m: H.wind_gusts_10m || H.time.map(() => null), freezing_level_height: H.freezing_level_height};
      lv[l.k] = {elev, d: giorni(h)};
    }
    out[s.id] = {lv, z: zeroTermico({time: H.time, precipitation: H.precipitation || [], freezing_level_height: H.freezing_level_height || []})};
  }
  state.quote = out;
}
