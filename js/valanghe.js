import { PROVIDERS, PROV_NAME, AINEVA_URL, WORKER_URL } from "./config.js";
import { t, loc, lingua, inglese } from "./i18n.js";
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
export const SIZE = {1:"piccole", 2:"medie", 3:"grandi", 4:"molto grandi", 5:"di dimensioni estreme"};
export const STAB = {good:"buona", fair:"discreta", poor:"debole", very_poor:"molto debole"};
const STAB_EN = {good:"good", fair:"fair", poor:"poor", very_poor:"very poor"};
export const FREQ = {none:"quasi nessun punto pericoloso", few:"pochi punti pericolosi", some:"alcuni punti pericolosi", many:"molti punti pericolosi"};
const LINGUA = {it:"italiano", de:"tedesco", en:"inglese", sl:"sloveno", fr:"francese"};

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
    // per Alto Adige e Trentino il bollettino Euregio esiste in italiano e in inglese
    const lg = inglese() ? "en" : "it";
    const urls = p.startsWith("IT-32")
      ? [`https://static.avalanche.report/bulletins/${d}/${d}_${p}_${lg}_CAAMLv6.json`, `https://avalanche.report/bulletins/${d}/${d}_${p}_${lg}_CAAMLv6.json`]
      : [];
    urls.push(`https://static.avalanche.report/eaws_bulletins/${d}/${d}-${p}.json`);
    for(const u of urls){
      try{
        const r = await fetch(u);
        state.avReached = true;                    // il server ha risposto (anche se il bollettino non c'è)
        if(!r.ok) continue;
        const j = await r.json();
        if(j && Array.isArray(j.bulletins) && j.bulletins.length){ state.avDate[p] = d; return j.bulletins; }
      }catch(e){}
    }
  }
  return null;
}
export async function loadAvalanche(){
  const res = await Promise.all(PROVIDERS.map(fetchProvider));
  let any = false;
  PROVIDERS.forEach((p, i) => { if(res[i]){ state.av[p] = res[i]; any = true; } });
  // errore solo se non abbiamo raggiunto il server; se risponde ma non ci sono bollettini è fuori stagione
  state.avErr = !any && !state.avReached && !state.avOff;
}

/* sito in inglese: i bollettini Euregio (Alto Adige, Trentino) del robot sono in italiano,
   li sostituiamo con la versione inglese dello stesso giorno (se non risponde restano in italiano) */
export async function bollettiniInInglese(){
  if(!inglese()) return false;
  let cambiati = false;
  await Promise.all(PROVIDERS.filter(p => p.startsWith("IT-32") && state.avDate[p]).map(async p => {
    const d = state.avDate[p];
    try{
      const r = await fetch(`https://static.avalanche.report/bulletins/${d}/${d}_${p}_en_CAAMLv6.json`);
      if(!r.ok) return;
      const j = await r.json();
      if(j && Array.isArray(j.bulletins) && j.bulletins.length){ state.av[p] = j.bulletins.map(b => ({...b, lang: b.lang || "en"})); cambiati = true; }
    }catch(e){}
  }));
  return cambiati;
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
    p += `<path d="M${c},${c} L${c + R * Math.cos(a0)},${c + R * Math.sin(a0)} A${R},${R} 0 0 1 ${c + R * Math.cos(a1)},${c + R * Math.sin(a1)} Z" class="${set.has(a) ? "ro-on" : "ro-off"}" style="fill:${set.has(a) ? "var(--ro-on,#0369a1)" : "var(--ro-off,#d8e0e8)"};stroke:var(--card,#fff)" stroke-width="1.5"/>`;
  });
  return `<svg viewBox="0 0 54 54" role="img" aria-label="${t("Esposizioni")}: ${[...set].join(", ") || t("nessuna")}">${p}<text x="27" y="8" font-size="7" text-anchor="middle" style="fill:var(--tx,#0f2235)" font-weight="700">N</text></svg>`;
}
export function elevText(e){
  if(!e) return t("tutte le quote");
  const f = v => v === "treeline" ? t("limite del bosco") : v + " m";
  if(e.lowerBound && e.upperBound) return `${f(e.lowerBound)} – ${f(e.upperBound)}`;
  if(e.lowerBound) return `${t("sopra")} ${f(e.lowerBound)}`;
  if(e.upperBound) return `${t("sotto")} ${f(e.upperBound)}`;
  return t("tutte le quote");
}
/* testo del bollettino: i <br/> diventano paragrafi, il resto viene ripulito */
export function paragrafi(t){
  const parts = String(t || "").split(/<br\s*\/?>\s*(?:<br\s*\/?>)?/i).map(x => x.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  return parts.map(x => `<p>${esc(x)}</p>`).join("");
}
export const stripTags = s => String(s || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
export const dsq = l => `<span class="dsq d${l || 0}">${l || "?"}</span>`;
export const aspIt = a => inglese() ? a : a.replace(/W/g, "O");

const ora = iso => iso ? new Date(iso).toLocaleString(loc(), {weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"}) : "";

/* grado di pericolo: righe per quota e per mattino/pomeriggio */
export function gradiHTML(b){
  return `<div class="av-rows">${(b.dangerRatings || []).map(r => {
    const l = DLEV[r.mainValue] || 0;
    const per = r.validTimePeriod === "earlier" ? " · " + t("mattino") : r.validTimePeriod === "later" ? " · " + t("pomeriggio") : "";
    return `<div class="av-row">${dsq(l)}<div><b>${t(DNAME[l]) || esc(r.mainValue)}</b> <span class="note">${elevText(r.elevation)}${per}</span></div></div>`;
  }).join("")}</div>`;
}
/* problemi valanghivi con rosa delle esposizioni, quote, dimensione, stabilità, frequenza */
export function problemiHTML(b){
  return (b.avalancheProblems || []).map(p => {
    const extra = [p.avalancheSize ? t("valanghe {d}", {d: t(SIZE[p.avalancheSize] || String(p.avalancheSize))}) : "", STAB[p.snowpackStability] ? t("stabilità {s}", {s: inglese() ? STAB_EN[p.snowpackStability] : STAB[p.snowpackStability]}) : "", FREQ[p.frequency] ? t(FREQ[p.frequency]) : "",
      p.validTimePeriod === "earlier" ? t("mattino") : p.validTimePeriod === "later" ? t("pomeriggio") : ""].filter(Boolean).join(" · ");
    return `<div class="prob">${aspectRose(p.aspects)}<div><div class="pt">${esc(t(PROB[p.problemType] || p.problemType))}</div>
      <div class="pe">${elevText(p.elevation)}${p.aspects && p.aspects.length ? " · " + t("esposizioni") + " " + esc(aspIt(p.aspects.join(", "))) : ""}</div>
      ${extra ? `<div class="pe">${esc(extra)}</div>` : ""}${p.comment ? `<div class="pe">${esc(stripTags(p.comment))}</div>` : ""}</div></div>`;
  }).join("");
}
/* testo completo del bollettino, a sezioni */
export function testiHTML(b){
  const sez = [];
  const add = (titolo, o) => { if(o && (o.highlights || o.comment)) sez.push(`<div class="avt"><h5>${t(titolo)}</h5>${o.highlights ? `<p class="hl2">${esc(stripTags(o.highlights))}</p>` : ""}${paragrafi(o.comment)}</div>`); };
  add("Situazione valanghe", b.avalancheActivity);
  add("Manto nevoso", b.snowpackStructure);
  add("Consigli per chi va in montagna", b.travelAdvisory);
  add("Meteo", b.weatherForecast);
  add("Meteo dei giorni scorsi", b.weatherReview);
  for(const td of (b.tendency || [])){
    if(!td.tendencyType && !td.highlights && !td.comment) continue;
    sez.push(`<div class="avt"><h5>${t("Tendenza")}${td.validTime && td.validTime.endTime ? " " + t("fino a") + " " + esc(ora(td.validTime.endTime)) : ""}${TEND[td.tendencyType] ? ` · ${t(TEND[td.tendencyType])}` : ""}</h5>${td.highlights ? `<p class="hl2">${esc(stripTags(td.highlights))}</p>` : ""}${paragrafi(td.comment)}</div>`);
  }
  return sez.join("");
}
export function intestazione(b, prov){
  const v = b.validTime || {};
  const lt = b.lang || "it";
  const nota = lt !== lingua() ? " · " + t("testo originale in {l}", {l: t(LINGUA[lt] || lt)}) : "";
  return `<p class="small avmeta">${b.unscheduled ? `<b>${t("Aggiornamento straordinario")}</b> · ` : ""}${t("Valido da {da} a {a}", {da: esc(ora(v.startTime)), a: esc(ora(v.endTime))})}${b.publicationTime ? ` · ${t("emesso")} ${esc(ora(b.publicationTime))}` : ""} · ${esc(b.source?.provider?.name || t(PROV_NAME[prov] || "") || prov || "")}${nota}</p>`;
}

/* bollettini raggruppati per servizio, con gli spot che ricadono in ciascuno */
export function bollettiniPerServizio(spots){
  const out = [];
  for(const p of PROVIDERS){
    const bs = state.av[p]; if(!bs || !bs.length) continue;
    const items = bs.map(b => {
      const sp = spots.filter(s => { const a = avForSpot(s); return a && a.exact && a.b === b; });
      return {b, level: bMax(b), spots: sp};
    }).sort((x, y) => y.level - x.level || y.spots.length - x.spots.length);
    out.push({p, nome: PROV_NAME[p] || p, date: state.avDate[p], items});
  }
  return out;
}

export function avBlockHTML(spot){
  const av = avForSpot(spot);
  if(!av){
    return `<div class="note">${state.avErr ? t("Bollettino non raggiungibile da qui.") : t("Nessun bollettino attivo: fuori stagione o non ancora emesso (i servizi valanghe li pubblicano di solito da dicembre).")} ${t("Bollettino ufficiale:")}</div>
      <div class="links" style="margin-top:8px"><a class="lnk" href="${AINEVA_URL}" target="_blank" rel="noopener">${t("Bollettino AINEVA")}</a></div>`;
  }
  const b = av.b;
  const hl = stripTags(b.avalancheActivity && b.avalancheActivity.highlights);
  const tend = (b.tendency || []).map(x => TEND[x.tendencyType]).filter(Boolean).map(x => t(x))[0];
  const prov = av.provs.map(p => t(PROV_NAME[p])).join(" / ");
  const testi = testiHTML(b);
  return `${gradiHTML(b)}
    ${hl ? `<p class="hl">${esc(hl)}</p>` : ""}
    ${tend ? `<p class="note" style="margin-top:6px">${t("Tendenza")}: <b>${tend}</b></p>` : ""}
    ${problemiHTML(b) ? `<div style="margin-top:10px"><div class="note" style="margin-bottom:2px">${t("Problemi valanghivi")}</div>${problemiHTML(b)}</div>` : ""}
    ${testi ? `<details class="avfull"><summary>${t("Leggi il bollettino completo")}</summary>${testi}</details>` : ""}
    <p class="small" style="margin-top:10px">${av.exact ? t("Zona") + ": " + esc(av.names.slice(0, 4).join(", ")) : t("Zona non individuata: mostrato il grado più alto del bollettino") + " " + esc(prov)}</p>
    ${intestazione(b, av.provs[0])}
    <div class="links" style="margin-top:8px"><a class="lnk" href="${AINEVA_URL}" target="_blank" rel="noopener">${t("Bollettino ufficiale AINEVA")}</a></div>`;
}
