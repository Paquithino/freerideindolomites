import { PROVIDERS, PROV_NAME, AINEVA_URL, WORKER_URL } from "./config.js";
import { state, esc } from "./state.js";
import { romeNowISO, addDaysISO } from "./meteo.js";

/* =========================================================
   VALANGHE — bollettini ufficiali AINEVA / servizi provinciali
   Formato EAWS CAAMLv6 da static.avalanche.report (o via Worker)
   ========================================================= */
export const DLEV = {low:1, moderate:2, considerable:3, high:4, very_high:5};
export const DNAME = {1:"Debole", 2:"Moderato", 3:"Marcato", 4:"Forte", 5:"Molto forte"};
export const PROB = {new_snow:"Neve fresca", wind_slab:"Neve ventata", persistent_weak_layers:"Strati deboli persistenti", wet_snow:"Neve bagnata",
  gliding_snow:"Valanghe di slittamento", favourable_situation:"Situazione favorevole", no_distinct_avalanche_problem:"Nessun problema distinto", cornices:"Cornici"};
export const TEND = {increasing:"in aumento ↗", decreasing:"in diminuzione ↘", steady:"stabile →"};

export function avDates(){
  const now = romeNowISO(), today = now.slice(0, 10), hour = +now.slice(11, 13);
  // il bollettino per domani esce verso le 17
  return hour >= 17 ? [addDaysISO(today, 1), today] : [today, addDaysISO(today, -1)];
}
export async function fetchProvider(p){
  if(WORKER_URL){
    try{
      const r = await fetch(`${WORKER_URL}/api/valanghe?prov=${encodeURIComponent(p)}`);
      if(r.ok){ const j = await r.json(); if(j && j.bulletins && j.bulletins.length){ state.avDate[p] = j.date; return j.bulletins; } }
    }catch(e){}
    return null;
  }
  for(const d of avDates()){
    try{
      const r = await fetch(`https://static.avalanche.report/eaws_bulletins/${d}/${d}-${p}.json`);
      if(!r.ok) continue;
      const j = await r.json();
      if(j && Array.isArray(j.bulletins) && j.bulletins.length){ state.avDate[p] = d; return j.bulletins; }
    }catch(e){}
  }
  return null;
}
export async function loadAvalanche(){
  const res = await Promise.all(PROVIDERS.map(fetchProvider));
  let any = false;
  PROVIDERS.forEach((p, i) => { if(res[i]){ state.av[p] = res[i]; any = true; } });
  state.avErr = !any && !state.avOff;
}

export const bMax = b => Math.max(0, ...(b.dangerRatings || []).map(r => DLEV[r.mainValue] || 0));
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/* Bollettino per uno spot: prima la micro-regione esatta, altrimenti il massimo del servizio (dichiarato) */
export function avForSpot(spot){
  const matched = [], all = [], names = new Set(), provs = [];
  for(const p of spot.av.p){
    const bs = state.av[p]; if(!bs) continue;
    provs.push(p);
    for(const b of bs){
      all.push(b);
      const hit = (b.regions || []).filter(r =>
        spot.av.ids.some(id => (r.regionID || "").startsWith(id)) ||
        spot.av.kw.some(k => norm(r.name).includes(norm(k))));
      if(hit.length){ matched.push(b); hit.forEach(r => names.add(r.name)); }
    }
  }
  if(!all.length) return null;
  const exact = matched.length > 0, pool = exact ? matched : all;
  const best = pool.reduce((a, b) => bMax(b) > bMax(a) ? b : a, pool[0]);
  return {b: best, level: bMax(best), exact, names: [...names], provs};
}

export function aspectRose(aspects){
  const order = ["N","NE","E","SE","S","SW","W","NW"], set = new Set(aspects || []);
  let p = "";
  order.forEach((a, i) => {
    const a0 = (i * 45 - 22.5 - 90) * Math.PI / 180, a1 = (i * 45 + 22.5 - 90) * Math.PI / 180, R = 24, c = 27;
    p += `<path d="M${c},${c} L${c + R * Math.cos(a0)},${c + R * Math.sin(a0)} A${R},${R} 0 0 1 ${c + R * Math.cos(a1)},${c + R * Math.sin(a1)} Z" fill="${set.has(a) ? "#38bdf8" : "#1e293b"}" stroke="#0b1220" stroke-width="1.5"/>`;
  });
  return `<svg viewBox="0 0 54 54">${p}<text x="27" y="8" font-size="7" text-anchor="middle" fill="#e2e8f0" font-weight="700">N</text></svg>`;
}
export function elevText(e){
  if(!e) return "tutte le quote";
  const f = v => v === "treeline" ? "limite del bosco" : v + " m";
  if(e.lowerBound && e.upperBound) return `${f(e.lowerBound)} – ${f(e.upperBound)}`;
  if(e.lowerBound) return `sopra ${f(e.lowerBound)}`;
  if(e.upperBound) return `sotto ${f(e.upperBound)}`;
  return "tutte le quote";
}
export const stripTags = s => String(s || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
export const dsq = l => `<span class="dsq d${l || 0}">${l || "?"}</span>`;
export const aspIt = a => a.replace(/W/g, "O");

export function avBlockHTML(spot){
  const av = avForSpot(spot);
  if(!av){
    return `<div class="note">${state.avErr ? "Bollettino non raggiungibile da qui." : "Nessun bollettino attivo (fuori stagione o non ancora emesso)."} Consulta il bollettino ufficiale:</div>
      <div class="links" style="margin-top:8px"><a class="lnk" href="${AINEVA_URL}" target="_blank" rel="noopener">Bollettino AINEVA</a></div>`;
  }
  const b = av.b;
  const rows = (b.dangerRatings || []).map(r => {
    const l = DLEV[r.mainValue] || 0;
    const per = r.validTimePeriod === "earlier" ? " · mattino" : r.validTimePeriod === "later" ? " · pomeriggio" : "";
    return `<div class="av-row">${dsq(l)}<div><b>${DNAME[l] || esc(r.mainValue)}</b> <span class="note">${elevText(r.elevation)}${per}</span></div></div>`;
  }).join("");
  const probs = (b.avalancheProblems || []).map(p => `<div class="prob">${aspectRose(p.aspects)}<div><div class="pt">${esc(PROB[p.problemType] || p.problemType)}</div>
    <div class="pe">${elevText(p.elevation)}${p.aspects && p.aspects.length ? " · esposizioni " + esc(aspIt(p.aspects.join(", "))) : ""}</div></div></div>`).join("");
  const hl = stripTags(b.avalancheActivity && b.avalancheActivity.highlights);
  const tend = (b.tendency || []).map(t => TEND[t.tendencyType]).filter(Boolean)[0];
  const prov = av.provs.map(p => PROV_NAME[p]).join(" / ");
  const date = av.provs.map(p => state.avDate[p]).filter(Boolean)[0];
  return `<div class="av-rows">${rows}</div>
    ${hl ? `<p class="hl">${esc(hl)}</p>` : ""}
    ${tend ? `<p class="note" style="margin-top:6px">Tendenza per domani: <b>${tend}</b></p>` : ""}
    ${probs ? `<div style="margin-top:10px"><div class="note" style="margin-bottom:2px">Problemi valanghivi</div>${probs}</div>` : ""}
    <p class="small" style="margin-top:10px">${av.exact ? "Zona: " + esc(av.names.slice(0, 4).join(", ")) : "Zona non individuata: mostrato il grado più alto del bollettino " + esc(prov)}${date ? " · valido " + new Date(date + "T12:00:00Z").toLocaleDateString("it-IT", {day:"numeric", month:"short", timeZone:"UTC"}) : ""} · emesso da ${esc(b.source?.provider?.name || prov)}</p>
    <div class="links" style="margin-top:8px"><a class="lnk" href="${AINEVA_URL}" target="_blank" rel="noopener">Leggi il bollettino ufficiale completo</a></div>`;
}
