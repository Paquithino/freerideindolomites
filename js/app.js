import { SPOTS, AREAS, AV_LINKS, PROV_NAME, FORECAST_DAYS, SF_HOME } from "./config.js";
import { $, esc, LS, r0, r1, scoreColor, snowColor, state, unpackTimes } from "./state.js";
import { wmo, dirName, metrics, dailyPlan, bestDay, dayName, dayNum, isWeekend, loadWeather, demoWeather, romeNowISO } from "./meteo.js";
import { DNAME, avForSpot, avBlockHTML, dsq, loadAvalanche } from "./valanghe.js";
import { camsHTML } from "./webcam.js";
import { loadStations, stationsHTML, bestStation } from "./stazioni.js";
import { loadModels, demoModels, ensembleFor, agreement, regionRegime, regimeLabel, flowEffect, correctHourly } from "./modelli.js";
import { MODELS, LAVORI_IN_CORSO } from "./config.js";
import { loadQuote, quoteHTML, demoQuote } from "./quote.js";

/* =========================================================
   APP — rendering delle viste e navigazione
   ========================================================= */
const DESKTOP_MQ = window.matchMedia("(min-width: 960px)");
const isDesktop = () => DESKTOP_MQ.matches;

/* larghezza del grafico orario ≈ larghezza reale della colonna, così testo e linee restano alla dimensione giusta */
function chartWidth(){
  if(!isDesktop()) return 420;
  const side = innerWidth >= 1700 ? 260 : 232, pad = innerWidth >= 1700 ? 88 : 64;
  const col = (innerWidth - side - pad - 24) * 1.5 / 2.5 - 36;
  return Math.max(560, Math.round(col));
}

const rangeTxt = st => st && st.n >= 2 && st.max - st.min >= 1 ? `${r0(st.min)}–${r0(st.max)}` : "";

/* ---------- banner / lista ---------- */
function renderBanner(){
  let h = "";
  if(LAVORI_IN_CORSO) h += `<div class="banner wip">🚧 <b>Sito in costruzione</b> — dati e funzioni in fase di test: non usarlo ancora per decidere un'uscita.</div>`;
  if(state.demo) h += `<div class="banner demo"><b>Anteprima con dati dimostrativi.</b> Le fonti meteo non sono raggiungibili da questo ambiente: una volta pubblicato il sito mostra i dati reali. Il pericolo valanghe non viene mai simulato.</div>`;
  else if(state.wxErr) h += `<div class="banner err">Meteo non disponibile al momento. Riprova tra poco.</div>`;
  $("#banner").innerHTML = h;
}
function renderHero(){
  const ms = SPOTS.map(s => [s, metrics(s)]).filter(x => x[1]);
  if(!ms.length){ $("#hero").innerHTML = ""; return; }
  const top = ms.reduce((a, b) => b[1].p48 > a[1].p48 ? b : a);
  const nxt = ms.reduce((a, b) => b[1].n72 > a[1].n72 ? b : a);
  const best = ms.reduce((a, b) => b[1].score > a[1].score ? b : a);
  $("#hero").innerHTML = `
    <div class="k"><span>Più neve 48h</span><b>${r0(top[1].p48)} cm</b><em>${esc(top[0].name)}</em></div>
    <div class="k"><span>In arrivo 72h</span><b>${r0(nxt[1].n72)} cm</b><em>${esc(nxt[0].name)}</em></div>
    <div class="k"><span>Indice Powder</span><b>${r1(best[1].score)}</b><em>${esc(best[0].name)}</em></div>`;
}
const chipsHTML = (list, cur, attr) => list.map(a => `<button class="chip ${a === cur ? "on" : ""}" ${attr}="${esc(a)}">${esc(a)}</button>`).join("");
function filterArea(arr, area){
  if(area === "★ Preferiti") return arr.filter(s => state.fav.has(s.id));
  if(area !== "Tutti") return arr.filter(s => s.area === area);
  return arr;
}
function cardHTML(s){
  const m = metrics(s), av = avForSpot(s), fav = state.fav.has(s.id);
  if(!m) return `<div class="card" data-spot="${s.id}"><div class="t"><div><h3>${esc(s.name)}</h3><div class="sub">${esc(s.area)} · ${s.elev} m</div></div></div><div class="note" style="margin-top:8px">Dati non disponibili</div></div>`;
  return `<div class="card" data-spot="${s.id}">
    <div class="t">
      <button class="star ${fav ? "on" : ""}" data-fav="${s.id}" aria-label="Preferito">${fav ? "★" : "☆"}</button>
      <div style="min-width:0"><h3>${esc(s.name)}</h3>
        <div class="sub">${esc(s.area)}${s.group ? " · " + esc(s.group) : ""} · quota rif. ${s.elev.toLocaleString("it-IT")} m · ${wmo(m.code)[0]} ${wmo(m.code)[1]}</div></div>
      <div class="score" style="border-color:${scoreColor(m.score)}"><b style="color:${scoreColor(m.score)}">${r1(m.score)}</b><span>Powder</span></div>
    </div>
    <div class="metrics">
      <div class="m"><b>${r0(m.p48)}<small> cm</small></b><span>neve fresca 48h</span></div>
      <div class="m"><b>+${r0(m.n72)}<small> cm</small></b><span>in arrivo 72h${rangeTxt(m.n72r) ? `<br><em class="rg">${rangeTxt(m.n72r)}</em>` : ""}</span></div>
      <div class="m"><b>${r0(m.temp)}°</b><span>temp. ${s.elev} m</span></div>
      <div class="m"><b>${av ? dsq(av.level) : "–"}</b><span>${av ? (DNAME[av.level] || "n.d.") : "valanghe n.d."}</span></div>
    </div>
    <div class="flags">
      <span class="flag">💨 ${r0(m.w7)} km/h ${dirName(m.w7dir)} in quota</span>
      <span class="flag">0° a ${m.fz != null ? r0(m.fz).toLocaleString("it-IT") + " m" : "–"}</span>
      ${(() => { const b = bestStation(s); return b ? `<span class="flag g" title="${esc(b.name)}">📏 ${r0(b.hs)} cm misurati${(b.d24 || 0) >= 1 ? ` · +${r0(b.d24)} in 24h` : ""}</span>` : ""; })()}
      ${m.flags.map(f => `<span class="flag ${f[0]}">${f[1]}</span>`).join("")}
    </div>
  </div>`;
}
const SORT_VAL = {
  powder: m => m.score, fresh: m => m.p48, p24: m => m.p24, p72: m => m.p72, n24: m => m.n24, next: m => m.n72, n7d: m => m.n7d,
  depth: m => m.depth ?? -1, station: (m, s) => { const b = bestStation(s); return b ? b.hs : -1; }, temp: m => m.temp, fz: m => m.fz ?? 0, w7: m => m.w7 ?? 0
};
function sortedSpots(){
  const arr = filterArea(SPOTS.slice(), state.area), k = state.sort, dir = state.dir || -1;
  if(k === "name") arr.sort((a, b) => a.name.localeCompare(b.name, "it") * (dir === -1 ? 1 : -1));
  else if(k === "danger"){ const v = s => { const a = avForSpot(s); return a ? a.level : 9; }; arr.sort((a, b) => (v(a) - v(b)) * (dir === -1 ? 1 : -1)); }
  else{ const f = SORT_VAL[k] || SORT_VAL.powder; const v = s => { const m = metrics(s); return m ? f(m, s) : -999; }; arr.sort((a, b) => (v(b) - v(a)) * (dir === -1 ? 1 : -1)); }
  arr.sort((a, b) => (state.fav.has(b.id) ? 1 : 0) - (state.fav.has(a.id) ? 1 : 0));
  return arr;
}

/* ---------- vista tabella (desktop) ---------- */
const TCOLS = [
  ["name", "Spot", "l"], ["powder", "Powder"], ["p24", "Fresca<br>24h", "o1"], ["fresh", "Fresca<br>48h"], ["p72", "Fresca<br>72h", "o1"],
  ["n24", "Arrivo<br>24h", "o1"], ["next", "Arrivo<br>72h"], ["n7d", "Arrivo<br>7 gg"], ["station", "Neve<br>stazione"], ["depth", "Suolo<br>modello", "o1"], ["temp", "Temp."], ["fz", "Zero<br>termico", "o2"], ["w7", "Vento<br>quota"], ["danger", "Valanghe"]
];
const snowCell = (v, plus, o = "", rg = null) => { const c = snowColor(v), t = rangeTxt(rg); return `<td class="n ${o} ${c ? "s" : "z"}" ${c ? `style="--sc:${c}"` : ""} ${t ? `title="Forbice dei modelli: ${t} cm"` : ""}>${v >= 0.5 ? (plus ? "+" : "") + r0(v) : "–"}${t && v >= 0.5 ? `<i class="rgt">${t}</i>` : ""}</td>`; };
function tableHTML(arr){
  const arrow = k => state.sort === k ? (state.dir === 1 ? " ▲" : " ▼") : "";
  let h = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th>${TCOLS.map(([k, t, al]) =>
    `<th class="${al || ""} ${state.sort === k ? "on" : ""}" data-sortcol="${k}">${t}${arrow(k)}</th>`).join("")}<th class="l o2">Note</th></tr></thead><tbody>`;
  for(const s of arr){
    const m = metrics(s), av = avForSpot(s), fav = state.fav.has(s.id);
    if(!m){ h += `<tr data-spot="${s.id}"><td></td><td class="l"><b>${esc(s.name)}</b></td><td colspan="${TCOLS.length}" class="note">dati non disponibili</td></tr>`; continue; }
    h += `<tr data-spot="${s.id}">
      <td><button class="star ${fav ? "on" : ""}" data-fav="${s.id}" aria-label="Preferito">${fav ? "★" : "☆"}</button></td>
      <td class="l"><div class="tn">${wmo(m.code)[0]} <b>${esc(s.name)}</b></div><div class="ts">${esc(s.group || s.area)} · ${s.elev.toLocaleString("it-IT")} m</div></td>
      <td class="n"><span class="pw" style="--pc:${scoreColor(m.score)}">${r1(m.score)}</span></td>
      ${snowCell(m.p24, 0, "o1")}${snowCell(m.p48)}${snowCell(m.p72, 0, "o1")}${snowCell(m.n24, 1, "o1")}${snowCell(m.n72, 1, "", m.n72r)}${snowCell(m.n7d, 1, "", m.n7dr)}
      ${(() => { const b = bestStation(s); return b ? `<td class="n" title="${esc(b.name)} · ${r0(b.elev)} m · ${r0(b.km)} km">${r0(b.hs)} cm${(b.d24 || 0) >= 1 ? ` <small class="up">+${r0(b.d24)}</small>` : ""}</td>` : `<td class="n z">–</td>`; })()}
      <td class="n o1">${m.depth != null ? r0(m.depth) + " cm" : "–"}</td>
      <td class="n" style="color:${m.temp > 0 ? "var(--warn)" : "var(--tx)"}">${r0(m.temp)}°</td>
      <td class="n o2">${m.fz != null ? r0(m.fz).toLocaleString("it-IT") + " m" : "–"}</td>
      <td class="n" style="color:${(m.w7 || 0) >= 50 ? "var(--bad)" : (m.w7 || 0) >= 30 ? "var(--warn)" : "var(--tx)"}">${r0(m.w7)} <small>${dirName(m.w7dir)}</small></td>
      <td class="n">${av ? dsq(av.level) : `<span class="small">n.d.</span>`}</td>
      <td class="l fl o2">${m.flags.map(f => `<span class="flag ${f[0]}">${f[1]}</span>`).join("")}</td>
    </tr>`;
  }
  return h + `</tbody></table></div>`;
}

/* ---------- pannello laterale (desktop largo) ---------- */
function renderAside(){
  const el = $("#aside"); if(!el) return;
  const ms = SPOTS.map(s => [s, metrics(s)]).filter(x => x[1]);
  if(!ms.length){ el.innerHTML = ""; return; }
  const top = (f, n = 5) => ms.slice().sort((a, b) => f(b[1]) - f(a[1])).slice(0, n);
  const row = (s, val, sub) => `<div class="arow" data-spot="${s.id}"><div><b>${esc(s.name)}</b><span>${sub}</span></div><em>${val}</em></div>`;
  const best = SPOTS.map(s => [s, bestDay(s)]).filter(x => x[1]).sort((a, b) => b[1].score - a[1].score).slice(0, 4);
  const avs = SPOTS.map(s => [s, avForSpot(s)]).filter(x => x[1]).sort((a, b) => b[1].level - a[1].level).slice(0, 5);
  el.innerHTML = `
    <div class="sec"><h4>🌨 Neve in arrivo · 7 giorni</h4>${top(m => m.n7d).map(([s, m]) => row(s, `+${r0(m.n7d)} cm`, `prossime 72h: +${r0(m.n72)} cm`)).join("")}</div>
    ${(() => { const meas = SPOTS.map(s => [s, bestStation(s)]).filter(x => x[1] && (x[1].d24 || 0) >= 1).sort((a, b) => b[1].d24 - a[1].d24).slice(0, 4);
      return meas.length ? `<div class="sec"><h4>📏 Neve nuova misurata · 24h</h4>${meas.map(([s, b]) => row(s, `+${r0(b.d24)} cm`, `${esc(b.name)} · ${r0(b.hs)} cm al suolo`)).join("")}</div>` : ""; })()}
    <div class="sec"><h4>🎯 Giornate migliori</h4>${best.length ? best.map(([s, b]) => row(s, `${dayName(b.date)} ${dayNum(b.date)}`, `~${r0(b.fresh)} cm freschi · affidabilità ${b.conf}`)).join("") : `<p class="note" style="margin:0">Nessuna nevicata ≥ 10 cm prevista nei prossimi ${FORECAST_DAYS} giorni.</p>`}
      <a class="more" href="#previsione">Apri la previsione →</a></div>
    <div class="sec"><h4>⚠️ Pericolo valanghe</h4>${avs.length ? avs.map(([s, a]) => `<div class="arow" data-spot="${s.id}"><div><b>${esc(s.name)}</b><span>${DNAME[a.level] || "n.d."}</span></div>${dsq(a.level)}</div>`).join("") : `<p class="note" style="margin:0">${state.avErr ? "Bollettini non raggiungibili." : "Bollettini non ancora emessi: la stagione dei bollettini parte di solito a dicembre."}</p>`}
      <a class="more" href="#valanghe">Tutti i bollettini →</a></div>
    <div class="sec"><h4>💨 Vento in quota più forte</h4>${top(m => m.w7 || 0, 3).map(([s, m]) => row(s, `${r0(m.w7)} km/h`, `da ${dirName(m.w7dir)} · ~3.000 m`)).join("")}</div>`;
}

function renderList(){
  $("#areaChips").innerHTML = chipsHTML(AREAS, state.area, "data-area");
  $("#sort").value = state.sort;
  if(state.loading && !Object.keys(state.wx).length){ $("#list").innerHTML = '<div class="skeleton"></div>'.repeat(5); return; }
  const arr = sortedSpots(), table = isDesktop() && state.view === "tabella";
  document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
  $("#list").classList.toggle("as-table", table);
  $("#list").innerHTML = !arr.length ? `<div class="note" style="padding:20px 4px">Nessuno spot qui. Tocca ☆ su uno spot per aggiungerlo ai preferiti.</div>`
    : table ? tableHTML(arr) : arr.map(cardHTML).join("");
  renderHero();
  renderAside();
  const sf = $("#sideFoot");
  if(sf) sf.textContent = state.updated ? `Dati aggiornati alle ${state.updated.toLocaleTimeString("it-IT", {hour:"2-digit", minute:"2-digit"})}` : "";
  $("#updated").textContent = state.updated ? `Aggiornato alle ${state.updated.toLocaleTimeString("it-IT", {hour:"2-digit", minute:"2-digit"})} · meteo alla quota di riferimento di ogni spot` : "";
}

/* ---------- previsione (ex pianifica) ----------
   Due viste senza scorrimento laterale:
   - "Per giorno": una scheda per giorno con gli spot dove nevica, ordinati, con barra proporzionale
   - "Per spot": una riga per spot con i giorni a quadretti che si adattano alla larghezza */
const giornoLungo = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", {weekday: "long", day: "numeric", month: "short", timeZone: "UTC"});
const nomeCorto = s => s.name.split(" · ")[0];
function cielo(codes){
  // icona del tempo più frequente tra gli spot
  const c = {}; codes.forEach(k => { if(k != null){ const i = wmo(k)[0]; c[i] = (c[i] || 0) + 1; } });
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || "";
}
function planGiorni(arr, days){
  const piani = new Map(arr.map(s => [s, dailyPlan(s)]));
  const scala = Math.max(20, ...arr.flatMap(s => piani.get(s).map(d => d.snow || 0)));
  return `<div class="pv-days">${days.map((g, i) => {
    const R = regimeLabel(regionRegime(g.date));
    const conNeve = arr.map(s => [s, piani.get(s)[i]]).filter(([, d]) => d && d.snow >= 1).sort((a, b) => b[1].snow - a[1].snow);
    const max = conNeve.length ? conNeve[0][1].snow : 0;
    const cod = arr.map(s => piani.get(s)[i] && piani.get(s)[i].code);
    const testa = `<div class="pv-h"><b>${i === 0 ? "Oggi" : i === 1 ? "Domani" : giornoLungo(g.date)}</b>${i <= 1 ? `<span class="pv-dt">${giornoLungo(g.date)}</span>` : ""}
      ${isWeekend(g.date) ? `<span class="pv-we">weekend</span>` : ""}<span class="pv-rg" title="${esc(R.name)}: ${esc(R.desc)}">${R.icon} ${esc(R.name.split(" ")[0])}</span></div>`;
    if(!conNeve.length) return `<div class="pv-day nada">${testa}<p class="pv-none">${cielo(cod)} Nessuna nevicata prevista</p></div>`;
    const righe = conNeve.slice(0, 6).map(([s, d]) => {
      const c = snowColor(d.snow) || "#bae6fd", w = Math.max(6, Math.round(100 * d.snow / scala));
      const forb = d.ens && d.ens.n >= 2 && d.ens.max - d.ens.min >= 3 ? `<small>${r0(d.ens.min)}–${r0(d.ens.max)}</small>` : "";
      return `<div class="pv-bar ${d.conf === "bassa" ? "low" : ""}" data-spot="${s.id}"><span class="n">${state.fav.has(s.id) ? "★ " : ""}${esc(nomeCorto(s))}</span>
        <span class="b"><i style="width:${w}%;background:${c}"></i></span><em>${r0(d.snow)} cm${forb}</em></div>`;
    }).join("");
    const altri = conNeve.length - 6;
    return `<div class="pv-day">${testa}${righe}${altri > 0 ? `<p class="pv-more">+ altri ${altri} spot con neve (fino a ${r0(conNeve[6][1].snow)} cm)</p>` : ""}</div>`;
  }).join("")}</div>`;
}
function planSpot(arr, days){
  const tot = s => dailyPlan(s).reduce((a, d) => a + (d.snow || 0), 0);
  const cellaGiorno = (d, g) => {
    const c = d && d.snow >= 1 ? snowColor(d.snow) : null;
    return `<span class="${c ? "" : "z"} ${d && d.conf === "bassa" ? "low" : ""} ${isWeekend(g.date) ? "we" : ""}" ${c ? `style="background:${c}"` : ""} title="${g.date}: ${d ? r1(d.snow) : "–"} cm">${d && d.snow >= 1 ? r0(d.snow) : ""}</span>`;
  };
  return `<div class="pv-grid">
    <div class="pv-row pv-hd"><span class="n"></span><div class="cells" style="grid-template-columns:repeat(${days.length},1fr)">${days.map((g, i) => `<span class="${isWeekend(g.date) ? "we" : ""}">${i === 0 ? "oggi" : dayName(g.date).slice(0, 2)}<br>${dayNum(g.date)}</span>`).join("")}</div><em>tot</em></div>
    ${arr.map(s => { const p = dailyPlan(s); return `<div class="pv-row" data-spot="${s.id}"><span class="n">${state.fav.has(s.id) ? "★ " : ""}${esc(nomeCorto(s))}</span>
      <div class="cells" style="grid-template-columns:repeat(${days.length},1fr)">${days.map((g, i) => cellaGiorno(p[i], g)).join("")}</div><em>${r0(tot(s))}</em></div>`; }).join("")}
  </div>
  <div class="plan-legend">cm/giorno: <i style="background:#bae6fd"></i>1–5 <i style="background:#7dd3fc"></i>5–10 <i style="background:#38bdf8"></i>10–20 <i style="background:#a78bfa"></i>20–35 <i style="background:#e879f9"></i>35+ · sbiadito = previsione poco affidabile</div>`;
}
function renderPlan(){
  $("#planChips").innerHTML = chipsHTML(AREAS, state.planArea, "data-planarea");
  document.querySelectorAll("[data-pvmode]").forEach(b => b.classList.toggle("on", b.dataset.pvmode === state.planMode));
  const arr = filterArea(SPOTS.slice(), state.planArea);
  const any = arr.find(s => dailyPlan(s).length);
  if(!any){ $("#planTable").innerHTML = state.loading ? '<div class="skeleton"></div>' : '<p class="note">Previsioni non disponibili.</p>'; $("#bestDays").innerHTML = ""; return; }
  const days = dailyPlan(any);
  const totals = s => dailyPlan(s).reduce((a, d) => a + d.snow, 0);
  arr.sort((a, b) => totals(b) - totals(a));
  $("#planTable").innerHTML = state.planMode === "spot" ? planSpot(arr, days) : planGiorni(arr, days);

  const best = arr.map(s => [s, bestDay(s)]).filter(x => x[1]).sort((a, b) => b[1].score - a[1].score).slice(0, 5);
  $("#bestDays").innerHTML = best.length ? best.map(([s, b]) => `<div class="card" data-spot="${s.id}"><div class="t" style="align-items:center">
      <div style="min-width:0"><h3 style="font-size:15px">${esc(s.name)}</h3>
      <div class="sub">${dayName(b.date)} ${dayNum(b.date)} · ~${r0(b.fresh)} cm freschi · ${b.sunny > .6 ? "☀️ sole" : b.sunny > .3 ? "⛅ schiarite" : "☁️ coperto"} · affidabilità ${b.conf}</div></div>
      <div class="score" style="border-color:var(--powder)"><b style="color:var(--powder);font-size:16px">${dayName(b.date)}</b><span>${dayNum(b.date)}</span></div>
    </div></div>`).join("") : `<p class="note">Nessuna nevicata significativa (≥ 10 cm) prevista nei prossimi ${FORECAST_DAYS} giorni.</p>`;
}

/* ---------- dettaglio ---------- */
function hourlyChart(spot, m){
  const H = state.wx[spot.id].hourly, i0 = m.idx - 23, i1 = Math.min(m.idx + 72, H.time.length - 1);
  const W = chartWidth(), Hh = isDesktop() ? 240 : 190, pl = 26, pr = 26, pt = 14, pb = 26;
  const n = i1 - i0 + 1, bw = (W - pl - pr) / n;
  const snow = (H.snow_c || H.snowfall).slice(i0, i1 + 1), temp = H.temperature_2m.slice(i0, i1 + 1), w7 = (H.wind_speed_700hPa || []).slice(i0, i1 + 1);
  const smax = Math.max(2, ...snow), tmin = Math.min(...temp) - 2, tmax = Math.max(...temp, 0) + 2;
  const y = v => pt + (Hh - pt - pb) * (1 - (v - tmin) / (tmax - tmin));
  let bars = "", labels = "";
  snow.forEach((v, k) => { if(v > 0){ const h = (Hh - pt - pb) * v / smax; bars += `<rect x="${pl + k * bw + 0.3}" y="${Hh - pb - h}" width="${Math.max(1, bw - 0.6)}" height="${h}" fill="#67e8f9" opacity=".85"/>`; } });
  const line = temp.map((v, k) => `${k ? "L" : "M"}${(pl + k * bw + bw / 2).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const wmax = Math.max(60, ...w7.filter(v => v != null));
  const wind = w7.map((v, k) => `${k ? "L" : "M"}${(pl + k * bw + bw / 2).toFixed(1)},${(pt + (Hh - pt - pb) * (1 - (v || 0) / wmax)).toFixed(1)}`).join("");
  for(let k = 0; k < n; k++){
    const t = H.time[i0 + k];
    if(t.endsWith("T00:00") || t.endsWith("T12:00")){
      const x = pl + k * bw, lab = t.endsWith("T00:00") ? dayName(t.slice(0, 10)) : "12";
      labels += `<line x1="${x}" x2="${x}" y1="${pt}" y2="${Hh - pb}" stroke="#24324f" ${t.endsWith("T12:00") ? 'stroke-dasharray="2 3"' : ""}/><text x="${x + 3}" y="${Hh - 10}" font-size="11" fill="#9fb0cc">${lab}</text>`;
    }
  }
  const nowX = pl + 23 * bw + bw / 2, zeroY = y(0);
  return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Grafico orario neve, temperatura e vento">
    ${labels}
    ${zeroY > pt && zeroY < Hh - pb ? `<line x1="${pl}" x2="${W - pr}" y1="${zeroY}" y2="${zeroY}" stroke="#f87171" stroke-dasharray="4 4" opacity=".6"/><text x="${W - pr + 3}" y="${zeroY + 4}" font-size="10" fill="#f87171">0°</text>` : ""}
    ${bars}<path d="${wind}" fill="none" stroke="#a78bfa" stroke-width="1.5" opacity=".7"/><path d="${line}" fill="none" stroke="#fbbf24" stroke-width="2.2"/>
    <line x1="${nowX}" x2="${nowX}" y1="${pt}" y2="${Hh - pb}" stroke="#e8eef9" stroke-width="1.5"/><text x="${nowX + 3}" y="${pt + 9}" font-size="10" fill="#e8eef9">ora</text>
    <text x="2" y="${pt + 8}" font-size="10" fill="#fbbf24">${Math.round(tmax)}°</text><text x="2" y="${Hh - pb}" font-size="10" fill="#fbbf24">${Math.round(tmin)}°</text>
    <text x="${W - 2}" y="${pt + 8}" font-size="10" fill="#67e8f9" text-anchor="end">${r1(smax)}cm/h</text>
  </svg>
  <div class="legend"><span><i style="background:#67e8f9"></i>Neve (cm/h)</span><span><i style="background:#fbbf24"></i>Temperatura ${spot.elev} m</span><span><i style="background:#a78bfa"></i>Vento in quota (0–${Math.round(wmax)} km/h)</span></div>`;
}
function daysHTML(spot){
  const p = dailyPlan(spot);
  const mx = Math.max(5, ...p.map(d => d.ens ? d.ens.max : d.snow));
  return `<div class="plan-wrap"><div class="days" style="grid-template-columns:repeat(${p.length},minmax(62px,1fr));min-width:${p.length * 66}px">${p.map((d, k) => {
    const R = d.regime ? regimeLabel(d.regime.key) : null, fx = d.regime && d.regime.wet ? flowEffect(spot, d.regime.key) : null;
    const lo = d.ens && d.ens.n >= 2 ? d.ens.min : null, hi = d.ens && d.ens.n >= 2 ? d.ens.max : null;
    return `<div class="day ${fx ? "fx-" + (fx.cls || "n") : ""}" style="${d.conf === "bassa" ? "opacity:.75" : ""}">
      <div class="dn">${k === 0 ? "Oggi" : dayName(d.date)} ${dayNum(d.date)}</div><div class="ic">${wmo(d.code)[0]}</div>
      <div class="bar">${hi != null ? `<b class="rbar" style="height:${Math.max(2, 44 * hi / mx)}px"></b>` : ""}<i style="height:${Math.max(2, 44 * d.snow / mx)}px;opacity:${d.snow > 0 ? 1 : .25}"></i></div>
      <div class="sn">${d.snow >= 0.5 ? r0(d.snow) + "cm" : "–"}</div>
      ${hi != null && hi - lo >= 1 ? `<div class="rg">${r0(lo)}–${r0(hi)}</div>` : `<div class="rg">&nbsp;</div>`}
      <div class="tt">${r0(d.tmax)}° / ${r0(d.tmin)}°</div>
      ${R ? `<div class="tt" title="${esc(R.name)}: ${esc(R.desc)}${fx ? " — " + fx.txt : ""}${d.regime.n ? ` (${d.regime.count}/${d.regime.n} modelli)` : ""}">${R.icon} ${esc(R.name.split(" ")[0])}</div>` : `<div class="tt">💨${r0(d.gust)}</div>`}
      <div class="conf">${d.conf}</div></div>`; }).join("")}</div></div>
    <p class="small" style="margin:6px 0 0">Numero grande = Previsione FreeRide (mediana dei modelli), sotto la forbice min–max. Barra chiara = valore più alto tra i modelli. Bordo verde/giallo = vento in quota favorevole/sfavorevole per questo spot. ${isDesktop() ? "" : `Scorri per vedere tutti i ${p.length} giorni.`}</p>`;
}

function windModelsHTML(e, dates){
  if(!dates.some(d => e.days[d].wind && e.days[d].wind.w7)) return "";
  const wc = v => v == null ? `<td class="z">n.d.</td>` : `<td class="${v >= 50 ? "wb" : v >= 30 ? "ww" : ""}">${r0(v)}</td>`;
  const rows = MODELS.filter(m => e.models.includes(m.id)).map(m =>
    `<tr><td class="l">${esc(m.label)}${calTag(m.id)}</td>${dates.map(d => { const w = e.days[d].wind; const k = w && w.regimes[m.id];
      return w && w.models[m.id] != null ? `<td class="${w.models[m.id] >= 50 ? "wb" : w.models[m.id] >= 30 ? "ww" : ""}">${r0(w.models[m.id])}<span>${k ? regimeLabel(k).icon : ""}</span></td>` : `<td class="z">n.d.</td>`; }).join("")}</tr>`).join("");
  return `<h5 class="subh">Vento in quota (~3.000 m) · massimo del giorno, km/h</h5>
    <div class="st-wrap"><table class="mdl wind">
    <thead><tr><th class="l"></th>${dates.map((d, i) => `<th>${i === 0 ? "Oggi" : dayName(d)}<br>${dayNum(d)}</th>`).join("")}</tr></thead>
    <tbody>${rows}
      <tr class="fr"><td class="l"><b>FreeRide</b><span>mediana · regime</span></td>${dates.map(d => { const x = e.days[d], w = x.wind && x.wind.w7, R = x.regime;
        return w ? `<td><b>${r0(w.med)}</b><span>${R ? `${regimeLabel(R.key).icon} ${R.count}/${R.n}` : ""}</span></td>` : `<td class="z">n.d.</td>`; }).join("")}</tr>
    </tbody></table></div>
    <p class="small" style="margin:6px 0 0">Giallo ≥ 30 km/h (trasporto di neve), rosso ≥ 50 km/h (accumuli importanti, impianti in quota a rischio). L'icona indica il regime dei venti per quel modello; "4/5" = quanti modelli sono d'accordo.</p>`;
}

function modelsHTML(spot){
  const e = ensembleFor(spot);
  if(!e || !e.models.length) return `<p class="note" style="margin:0">Confronto tra modelli non disponibile al momento.</p>`;
  const today = romeNowISO().slice(0, 10);
  const dates = Object.keys(e.days).filter(d => d >= today).slice(0, 6);
  const cell = v => v == null ? `<td class="z">n.d.</td>` : `<td class="${v >= 1 ? "s" : "z"}" ${v >= 1 ? `style="--sc:${snowColor(v) || "#bae6fd"}"` : ""}>${v >= 0.5 ? r0(v) : "–"}</td>`;
  const rows = MODELS.filter(m => e.models.includes(m.id)).map(m =>
    `<tr><td class="l">${esc(m.label)}${calTag(m.id)}</td>${dates.map(d => cell(e.days[d].models[m.id])).join("")}</tr>`).join("");
  const ag = agreement(e.n72);
  return `<div class="st-wrap"><table class="mdl">
    <thead><tr><th class="l">cm di neve</th>${dates.map((d, i) => `<th>${i === 0 ? "Oggi" : dayName(d)}<br>${dayNum(d)}</th>`).join("")}</tr></thead>
    <tbody>${rows}
      <tr class="fr"><td class="l"><b>Previsione FreeRide</b><span>${state.cal ? "mediana pesata" : "mediana"} · forbice</span></td>${dates.map(d => { const x = e.days[d]; return x && x.n ? `<td><b>${x.med >= 0.5 ? r0(x.med) : "–"}</b>${x.n >= 2 && x.max - x.min >= 1 ? `<span>${r0(x.min)}–${r0(x.max)}</span>` : ""}</td>` : `<td class="z">n.d.</td>`; }).join("")}</tr>
    </tbody></table></div>
    ${ag ? `<p class="small" style="margin:8px 0 0"><span class="agr agr-${ag.lvl}">● ${ag.txt}</span> sulle prossime 72 ore (${r0(e.n72.min)}–${r0(e.n72.max)} cm).</p>` : ""}
    ${windModelsHTML(e, dates)}
    <p class="small" style="margin:6px 0 0">${calNote()}</p>`;
}
/* fattore e peso della calibrazione accanto al nome del modello */
function calTag(mid){
  const m = state.cal && state.cal.models && state.cal.models[mid];
  if(!m || !m.ok) return "";
  const f = v => (Math.round(v * 100) / 100).toLocaleString("it-IT");
  return `<span>×${f(m.factor)} · peso ${f(m.weight)}</span>`;
}
function calNote(){
  const base = "Tutti i modelli usano lo stesso rapporto neve/acqua variabile con la temperatura.";
  const c = state.cal;
  if(!c) return base + " Per ora pesano tutti uguale: la calibrazione sulle stazioni non è ancora disponibile.";
  const v = c.verifica;
  return base + ` I cm sono corretti con la <b>calibrazione</b> su ${c.stazioni || "alcune"} stazioni dell'Alto Adige negli inverni ${(c.stagioni || []).join(", ")}: ×fattore = correzione dei cm, peso = quanto conta il modello nella Previsione FreeRide (chi ha sbagliato meno conta di più).`
    + (v && v.nevicate ? ` Nella verifica sugli inverni passati, a 1 giorno le nevicate di almeno 10 cm riconosciute sono passate da ${v.presePrima} a ${v.preseDopo} su ${v.nevicate}.` : "")
    + ` <a href="./html/info.html#calibrazione">Come funziona</a>`;
}

function sfHTML(spot){
  return `<div class="sf">${spot.sfWidget
      ? `<div class="widget">${spot.sfWidget}</div>`
      : `<p class="note" style="margin:0 0 8px">Qui comparirà il widget gratuito di snow-forecast per ${esc(spot.name)} (da generare sul loro sito e incollare in <code>js/config.js</code>, campo <code>sfWidget</code>).</p>`}
    <div class="links"><a class="lnk" href="${SF_HOME}" target="_blank" rel="noopener">snow-forecast.com</a></div></div>`;
}
function renderDetail(id){
  const s = SPOTS.find(x => x.id === id);
  if(!s){ location.hash = "#spot"; return; }
  const m = metrics(s), fav = state.fav.has(s.id), best = bestDay(s);
  const sec = (cls, title, body) => `<div class="sec ${cls}"><h4>${title}</h4>${body}</div>`;
  let head = `<button class="back" data-back>‹ Indietro</button>
    <div class="dtitle"><div style="flex:1;min-width:0"><h2>${esc(s.name)}</h2>
      <div class="sub" style="color:var(--tx2);font-size:13px">${esc(s.area)}${s.group ? " · " + esc(s.group) : ""} · quota di riferimento ${s.elev.toLocaleString("it-IT")} m</div>
      <div class="zones">⛰ ${esc(s.zones)}</div></div>
      <button class="star ${fav ? "on" : ""}" data-fav="${s.id}" style="font-size:26px">${fav ? "★" : "☆"}</button></div>`;
  let main = "", side = "";
  if(!m){ main += `<div class="sec note o-now">Dati meteo non disponibili.</div>`; }
  else{
    main += sec("o-now", `Adesso · ${wmo(m.code)[0]} ${wmo(m.code)[1]}`, `
      <div class="grid3">
        <div class="big"><b style="color:${scoreColor(m.score)}">${r1(m.score)}</b><span>Indice Powder</span></div>
        <div class="big"><b>${r0(m.temp)}°C</b><span>a ${s.elev} m</span></div>
        <div class="big"><b>${m.fz != null ? r0(m.fz).toLocaleString("it-IT") : "–"}</b><span>zero termico (m)</span></div>
        <div class="big"><b>${r0(m.w7)}</b><span>vento in quota km/h ${dirName(m.w7dir)}</span></div>
        <div class="big"><b>${r0(m.gust)}</b><span>raffiche 10 m km/h</span></div>
        <div class="big"><b>${m.depth != null ? r0(m.depth) : "–"}</b><span>neve al suolo stimata cm</span></div>
      </div>
      ${m.flags.length ? `<div class="flags">${m.flags.map(f => `<span class="flag ${f[0]}">${f[1]}</span>`).join("")}</div>` : ""}`);
    main += sec("o-snow", "Neve fresca · stima del modello", `
      <div class="grid3">
        <div class="big"><b>${r0(m.p24)}</b><span>cm ultime 24h</span></div>
        <div class="big"><b>${r0(m.p48)}</b><span>cm ultime 48h</span></div>
        <div class="big"><b>${r0(m.p72)}</b><span>cm ultimi 3 gg</span></div>
        <div class="big"><b style="color:var(--powder)">+${r0(m.n24)}</b><span>cm prossime 24h</span></div>
        <div class="big"><b style="color:var(--powder)">+${r0(m.n72)}</b><span>cm prossime 72h</span></div>
        <div class="big"><b style="color:var(--powder)">+${r0(m.n7d)}</b><span>cm prossimi 7 gg</span></div>
      </div>`);
    main += sec("o-quote", `Neve per quota · Vetta, Metà, Base`, quoteHTML(s));
    main += sec("o-meas", "Neve misurata · stazioni vicine", stationsHTML(s));
    main += sec("o-plan", `Previsione · prossimi ${FORECAST_DAYS} giorni`,
      `${best ? `<div class="flags" style="margin:0 0 10px"><span class="flag p">🎯 Giornata migliore: ${dayName(best.date)} ${dayNum(best.date)} · ~${r0(best.fresh)} cm freschi · affidabilità ${best.conf}</span></div>` : ""}${daysHTML(s)}`);
    main += sec("o-models", "Confronto modelli", modelsHTML(s));
    main += sec("o-hour", "Ora per ora · ieri → 3 giorni", hourlyChart(s, m));
  }
  if(!m) main += sec("o-meas", "Neve misurata · stazioni vicine", stationsHTML(s));
  side += sec("o-cam", "Webcam", camsHTML(s));
  side += sec("o-av", "Pericolo valanghe · bollettino ufficiale", avBlockHTML(s));
  side += sec("o-sf", "Snow-forecast", sfHTML(s));
  $("#v-detail").innerHTML = `${head}<div class="dgrid"><div class="dcol dmain">${main}</div><div class="dcol dside">${side}</div></div>
    <div class="disc">Dati automatici e indicativi. Prima di uscire leggi il bollettino completo, osserva il terreno e porta ARTVA, pala e sonda.</div>`;
}

/* ---------- valanghe / webcam ---------- */
function renderAv(){
  const arr = SPOTS.map(s => [s, avForSpot(s)]).sort((a, b) => ((b[1]?.level) || 0) - ((a[1]?.level) || 0));
  let h;
  if(state.loading && !Object.keys(state.av).length) h = '<div class="skeleton"></div>'.repeat(3);
  else if(!arr.some(x => x[1])) h = `<div class="sec note">${state.avErr ? "Non riesco a raggiungere i bollettini da qui: aprili dai link ufficiali qui sotto." : "Nessun bollettino attivo: a inizio e fine stagione i servizi valanghe non li emettono tutti i giorni."}</div>`;
  else h = arr.map(([s, av]) => `<div class="card" data-spot="${s.id}"><div class="t" style="align-items:center">${av ? dsq(av.level) : dsq(0)}
      <div style="min-width:0"><h3 style="font-size:15px">${esc(s.name)}</h3><div class="sub">${av ? `${DNAME[av.level] || "n.d."} · ${av.exact ? esc(av.names.slice(0, 2).join(", ")) : "max bollettino " + esc(av.provs.map(p => PROV_NAME[p]).join("/"))}` : "Bollettino non disponibile"}</div></div>
    </div></div>`).join("");
  $("#avList").innerHTML = h;
  $("#avLinks").innerHTML = AV_LINKS.map(l => `<a class="lnk" href="${l.u}" target="_blank" rel="noopener">${esc(l.t)}</a>`).join("");
}
function renderCams(){
  $("#camChips").innerHTML = chipsHTML(AREAS, state.camArea, "data-camarea");
  const arr = filterArea(SPOTS.slice(), state.camArea).sort((a, b) => b.cams.filter(c => c.img || c.embed).length - a.cams.filter(c => c.img || c.embed).length);
  $("#camList").innerHTML = arr.map(s => `<div class="sec" style="margin:0"><h4 style="color:var(--tx);font-size:14px;text-transform:none;letter-spacing:0">${esc(s.name)} <span class="small">· ${esc(s.zones)}</span></h4>${camsHTML(s)}</div>`).join("");
}

/* ---------- navigazione (hash) ---------- */
function route(){
  const h = (location.hash || "#spot").slice(1);
  let tab = "spot", view = "v-spot";
  if(h.startsWith("spot-")){ view = "v-detail"; tab = ""; renderDetail(h.slice(5)); window.scrollTo(0, 0); }
  else if(h === "previsione" || h === "pianifica"){ tab = "previsione"; view = "v-pianifica"; renderPlan(); }
  else if(h === "valanghe"){ tab = "valanghe"; view = "v-valanghe"; renderAv(); }
  else if(h === "webcam"){ tab = "webcam"; view = "v-webcam"; renderCams(); }
  else renderList();
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("on", v.id === view));
  document.querySelectorAll("nav.tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
}
const rerender = () => { renderBanner(); route(); };

document.addEventListener("click", e => {
  const f = e.target.closest("[data-fav]");
  if(f){ e.stopPropagation(); const id = f.dataset.fav; state.fav.has(id) ? state.fav.delete(id) : state.fav.add(id); LS.set("fr_fav", [...state.fav]); rerender(); return; }
  if(e.target.closest("[data-embed],img[data-zoom],a")) return;
  const c = e.target.closest("[data-spot]");
  if(c){ location.hash = "#spot-" + c.dataset.spot; return; }
  const sc = e.target.closest("[data-sortcol]");
  if(sc){ const k = sc.dataset.sortcol; state.dir = state.sort === k ? -state.dir : (k === "name" || k === "danger" ? -1 : -1); state.sort = k; LS.set("fr_sort", k); renderList(); return; }
  const vw = e.target.closest("[data-view]");
  if(vw){ state.view = vw.dataset.view; LS.set("fr_view", state.view); renderList(); return; }
  const a = e.target.closest("[data-area]");
  if(a){ state.area = a.dataset.area; LS.set("fr_area", state.area); renderList(); return; }
  const pm = e.target.closest("[data-pvmode]");
  if(pm){ state.planMode = pm.dataset.pvmode; LS.set("fr_pvmode", state.planMode); renderPlan(); return; }
  const pa = e.target.closest("[data-planarea]");
  if(pa){ state.planArea = pa.dataset.planarea; renderPlan(); return; }
  const ca = e.target.closest("[data-camarea]");
  if(ca){ state.camArea = ca.dataset.camarea; renderCams(); return; }
  if(e.target.closest("[data-back]")) history.length > 1 ? history.back() : (location.hash = "#spot");
});
$("#sort").addEventListener("change", e => { state.sort = e.target.value; state.dir = -1; LS.set("fr_sort", state.sort); renderList(); });
$("#refresh").addEventListener("click", () => loadAll());
window.addEventListener("hashchange", route);
DESKTOP_MQ.addEventListener("change", route);

/* ---------- avvio ---------- */
/* Dati già pronti, preparati ogni ora dall'automazione (scripts/aggiorna-dati.mjs).
   Se il file manca o è vecchio (> 3 ore) il sito scarica i dati direttamente, come in sviluppo. */
const SNAPSHOT_MAX_AGE = 3 * 3600e3;
async function loadSnapshot(){
  try{
    const r = await fetch("./dati/ultimo.json", {cache: "no-store"});
    if(!r.ok) return false;
    const j = unpackTimes(await r.json());
    if(!j.generated || Date.now() - new Date(j.generated).getTime() > SNAPSHOT_MAX_AGE) return false;
    state.wx = j.wx || {}; state.ens = j.ens || {}; state.ensMemo = {}; state.cal = j.cal || null; state.quote = j.quote || null;
    state.av = j.av || {}; state.avDate = j.avDate || {}; state.avErr = !!j.avErr;
    state.stations = j.stations || []; state.stationsDate = j.generated;
    state.updated = new Date(j.generated); state.source = "automazione"; state.demoSnap = !!j.demo;
    return Object.keys(state.wx).length > 0;
  }catch(e){ return false; }
}

async function loadAll(){
  if(state.loading) return;
  state.loading = true; $("#refresh").classList.add("spin"); rerender();
  if(await loadSnapshot()){
    state.demo = state.demoSnap; state.wxErr = false;
    state.loading = false; $("#refresh").classList.remove("spin"); rerender(); return;
  }
  state.source = "diretto";
  // la calibrazione serve prima di scaricare i modelli (per applicare i fattori)
  try{ const r = await fetch("./dati/calibrazione.json", {cache: "no-store"}); if(r.ok) state.cal = await r.json(); }catch(e){}
  const [w] = await Promise.allSettled([loadWeather(), loadAvalanche(), loadStations(), loadModels(), loadQuote()]);
  if(w.status === "rejected"){
    const cache = LS.get("fr_wx_cache", null);
    if(cache && Date.now() - cache.t < 6 * 3600e3){ state.wx = cache.wx; state.updated = new Date(cache.t); state.wxErr = false; }
    else { state.wxErr = true; demoWeather(); state.demo = true; state.updated = null; }
    if(!Object.keys(state.ens || {}).length && state.demo) demoModels();
    if(!state.quote && state.demo) demoQuote();
  } else { state.demo = false; state.wxErr = false; state.updated = new Date(); }
  state.loading = false; $("#refresh").classList.remove("spin");
  rerender();
}
const cached = LS.get("fr_wx_cache", null);
if(cached && Date.now() - cached.t < 3 * 3600e3){ state.wx = cached.wx; state.updated = new Date(cached.t); Object.values(state.wx).forEach(d => d && correctHourly(d.hourly)); }
route();
loadAll();
setInterval(() => { if(document.visibilityState === "visible") loadAll(); }, 30 * 60e3);
