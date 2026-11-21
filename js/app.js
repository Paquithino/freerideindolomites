import { SPOTS, AREAS, AV_LINKS, PROV_NAME, FORECAST_DAYS } from "./config.js";
import { $, esc, LS, r0, r1, scoreColor, snowColor, state, unpackTimes } from "./state.js";
import { wmo, dirName, metrics, dailyPlan, bestDay, dayName, dayNum, isWeekend, loadWeather, demoWeather, romeNowISO } from "./meteo.js";
import { giudizio } from "./giudizio.js";
import { oraPerOraHTML, avviaOraPerOra } from "./oraperora.js";
import { neveMisurataHTML, avviaNeveMisurata } from "./nevemisurata.js";
import { ventoIcona, unitaToggle, legendaVento, inUnita, etichettaUnita, testoVento, mediaDirezioni } from "./vento.js";
import { calOf, zonaDi } from "./calibrazione.js";
import { peakvisorHTML } from "./peakvisor.js";
import { DNAME, avForSpot, avBlockHTML, dsq, loadAvalanche, bollettiniInInglese, bollettiniPerServizio, gradiHTML, problemiHTML, testiHTML, intestazione, stripTags, PROB } from "./valanghe.js";
import { camsHTML } from "./webcam.js";
import { leggiPercorso, daHash, metaPer, coverHTML, percorsoSpot, percorsoArea, slugDaArea, AREE, SITO_NOME, GRUPPI_SPOT, gruppoHTML, tabellaHTML, href, nomeArea } from "./pagine.js";
import { t, lingua, inglese, loc, num, url as u, percorsoLogico, traduciDOM, traduciLink } from "./i18n.js";
import { badgeLingua, avviaBadgeLingua } from "./badge-lingua.js";
import { loadStations, bestStation } from "./stazioni.js";
import { loadModels, demoModels, ensembleFor, agreement, regionRegime, regimeLabel, flowEffect, correctHourly, dayRegime } from "./modelli.js";
import { MODELS, LAVORI_IN_CORSO } from "./config.js";
import { loadQuote, quoteHTML, demoQuote } from "./quote.js";

/* =========================================================
   APP — rendering delle viste e navigazione
   ========================================================= */
const DESKTOP_MQ = window.matchMedia("(min-width: 960px)");
const isDesktop = () => DESKTOP_MQ.matches;

/* larghezza del grafico orario ≈ larghezza reale della colonna, così testo e linee restano alla dimensione giusta */

const rangeTxt = st => st && st.n >= 2 && st.max - st.min >= 1 ? `${r0(st.min)}–${r0(st.max)}` : "";

/* ---------- banner / lista ---------- */
function renderBanner(){
  let h = "";
  if(LAVORI_IN_CORSO) h += `<div class="banner wip">${t("🚧 <b>Sito in costruzione</b> — dati e funzioni in fase di test: non usarlo ancora per decidere un'uscita.")}</div>`;
  if(state.demo) h += `<div class="banner demo">${t("<b>Anteprima con dati dimostrativi.</b> Le fonti meteo non sono raggiungibili da questo ambiente: una volta pubblicato il sito mostra i dati reali. Il pericolo valanghe non viene mai simulato.")}</div>`;
  else if(state.wxErr) h += `<div class="banner err">${t("Meteo non disponibile al momento. Riprova tra poco.")}</div>`;
  $("#banner").innerHTML = h;
}
function renderHero(){
  const ms = SPOTS.map(s => [s, metrics(s)]).filter(x => x[1]);
  if(!ms.length){ $("#hero").innerHTML = ""; return; }
  const top = ms.reduce((a, b) => b[1].p48 > a[1].p48 ? b : a);
  const nxt = ms.reduce((a, b) => b[1].n72 > a[1].n72 ? b : a);
  const avs = SPOTS.map(s => avForSpot(s)).filter(Boolean), mx = avs.length ? Math.max(...avs.map(a => a.level)) : null;
  const ICO_NEVE = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 15h9a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 6 8.5 3.5 3.5 0 0 0 7 15z" stroke="#64748b"/><path d="M9 19v.01M12 20.5v.01M15 19v.01" stroke="#0ea5e9" stroke-width="2.4"/></svg>`;
  const ICO_ARRIVO = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h11M3 7h7M3 17h7" stroke="#64748b"/><path d="M15 6l5 6-5 6" stroke="#0369a1"/></svg>`;
  $("#hero").innerHTML = `<h2 class="ttl sez">${t("In breve")}</h2><div class="ib">
    <a class="k" href="${href(percorsoSpot(top[0].id))}">${ICO_NEVE}<span class="kt"><span>${t("Più neve fresca · 48 ore")}</span><b>${esc(nomeCorto(top[0]))}</b></span><em>${r0(top[1].p48)}<small> cm</small></em></a>
    <a class="k" href="${href(percorsoSpot(nxt[0].id))}">${ICO_ARRIVO}<span class="kt"><span>${t("In arrivo nei prossimi 3 giorni")}</span><b>${esc(nomeCorto(nxt[0]))}</b></span><em>+${r0(nxt[1].n72)}<small> cm</small></em></a>
    <a class="k" href="${href("valanghe/")}">${mx != null ? dsq(mx) : dsq(0)}<span class="kt"><span>${t("Pericolo valanghe fino a")}</span><b>${mx != null ? t(DNAME[mx]) : t("bollettini non emessi")}</b></span><em class="lk">${t("Bollettini")}</em></a>
  </div>`;
}
/* ---------- versione semplice ----------
   Per chi vuole solo sapere "com'è la neve e si può andare": un giudizio a parole,
   tre numeri grandi, i prossimi giorni a icone. Niente modelli, forbici, tabelle. */
const semplice = () => state.modo === "semplice";
function modoSeg(){
  return `<div class="seg2" role="group" aria-label="${t("Versione del sito")}"><button data-modo="semplice" class="${semplice() ? "on" : ""}" aria-pressed="${semplice()}">${t("Semplice")}</button><button data-modo="completa" class="${state.modo === "completa" ? "on" : ""}" aria-pressed="${state.modo === "completa"}">${t("Completa")}</button></div>`;
}
function modoHTML(){
  const nuovo = !state.modo;
  if(!nuovo) return "";
  return `${nuovo ? `<p class="modo-q">${t("Come preferisci vedere il sito?")}</p>` : ""}
    <div class="modo-seg" role="group" aria-label="${t("Versione del sito")}">
      <button data-modo="semplice" class="${semplice() ? "on" : ""}"><b>✨ ${t("Semplice")}</b><span>${t("Solo l'essenziale")}</span></button>
      <button data-modo="completa" class="${!semplice() && !nuovo ? "on" : ""}"><b>📊 ${t("Completa")}</b><span>${t("Tutti i dati")}</span></button>
    </div>`;
}
function giorniSemplici(s, n = 5){
  const p = dailyPlan(s).slice(0, n);
  return `<div class="sg-days" style="grid-template-columns:repeat(${p.length},1fr)">${p.map((d, k) => `<div class="sg-d">
    <span>${k === 0 ? t("Oggi") : k === 1 ? t("Domani") : dayName(d.date)}</span><i>${wmo(d.code)[0]}</i>
    <b class="${d.snow >= 0.5 ? "neve" : ""}">${d.snow >= 0.5 ? r0(d.snow) + " cm" : "–"}</b><em>${r0(d.tmax)}°</em>${ventoIcona(d.w7, d.w7dir, "cella")}</div>`).join("")}</div>`;
}
function cardSemplice(s){
  const m = metrics(s), av = avForSpot(s), fav = state.fav.has(s.id);
  if(!m) return `<a class="card sg" href="${href(percorsoSpot(s.id))}" data-spot="${s.id}"><h3>${esc(s.name)}</h3><p class="note">${t("Dati non disponibili")}</p></a>`;
  const g = giudizio(m, av);
  return `<a class="card sg gv-${g.cls}" href="${href(percorsoSpot(s.id))}" data-spot="${s.id}">
    <div class="sg-top"><button class="star ${fav ? "on" : ""}" data-fav="${s.id}" aria-label="${t("Preferito")}">${fav ? "★" : "☆"}</button>
      <div style="min-width:0;flex:1"><h3>${esc(s.name)}</h3><div class="sg-g"><span>${g.ico}</span> ${esc(g.txt)}</div></div></div>
    <div class="sg-n">
      <div><b>${r0(m.p48)}<small> cm</small></b><span>${t("neve fresca")}</span></div>
      <div><b>${m.n72 >= 0.5 ? "+" + r0(m.n72) : "0"}<small> cm</small></b><span>${t("in arrivo 3 gg")}</span></div>
      <div class="sg-v">${ventoIcona(m.w7, m.w7dir, "cella")}<span>${t("vento")} ${etichettaUnita()}</span></div>
      <div><b>${av ? dsq(av.level) : "–"}</b><span>${av ? t("valanghe") + " " + t(DNAME[av.level] || "").toLowerCase() : t("valanghe n.d.")}</span></div>
    </div>
    ${g.avvisi.length ? `<p class="sg-w">${g.avvisi.map(esc).join(" ")}</p>` : ""}
  </a>`;
}
function heroSemplice(){
  const ms = SPOTS.map(s => [s, metrics(s)]).filter(x => x[1]);
  if(!ms.length) return "";
  const top = ms.reduce((a, b) => b[1].p48 > a[1].p48 ? b : a), nxt = ms.reduce((a, b) => b[1].n72 > a[1].n72 ? b : a);
  const righe = [];
  righe.push(top[1].p48 >= 5 ? "❄️ " + t("Più neve fresca a <b>{spot}</b>: {cm} cm", {spot: esc(nomeCorto(top[0])), cm: r0(top[1].p48)}) : "❄️ " + t("Nessuna nevicata importante negli ultimi 2 giorni"));
  righe.push(nxt[1].n72 >= 5 ? "🌨 " + t("In arrivo soprattutto a <b>{spot}</b>: circa {cm} cm in 3 giorni", {spot: esc(nomeCorto(nxt[0])), cm: r0(nxt[1].n72)}) : "🌨 " + t("Nessuna nevicata in vista nei prossimi 3 giorni"));
  const avs = SPOTS.map(s => avForSpot(s)).filter(Boolean);
  if(avs.length){ const mx = Math.max(...avs.map(a => a.level)); righe.push(`${dsq(mx)} ${t("Pericolo valanghe fino a")} <b>${t(DNAME[mx] || "").toLowerCase()}</b>`); }
  return `<h2 class="ttl sez">${t("In breve")}</h2><div class="sg-hero">${righe.map(r => `<p>${r}</p>`).join("")}</div>`;
}
const chipsHTML = (list, cur, attr) => list.map(a => `<button class="chip ${a === cur ? "on" : ""}" ${attr}="${esc(a)}">${esc(a === "★ Preferiti" ? "★ " + t("Preferiti") : t(a))}</button>`).join("");
function filterArea(arr, area){
  if(area === "★ Preferiti") return arr.filter(s => state.fav.has(s.id));
  if(area !== "Tutti") return arr.filter(s => s.area === area);
  return arr;
}
function cardHTML(s){
  const m = metrics(s), av = avForSpot(s), fav = state.fav.has(s.id);
  if(!m) return `<a class="card" href="${href(percorsoSpot(s.id))}" data-spot="${s.id}"><div class="t"><div><h3>${esc(s.name)}</h3><div class="sub">${esc(nomeArea(s.area))} · ${s.elev} m</div></div></div><div class="note" style="margin-top:8px">${t("Dati non disponibili")}</div></a>`;
  return `<a class="card" href="${href(percorsoSpot(s.id))}" data-spot="${s.id}">
    <div class="t">
      <button class="star ${fav ? "on" : ""}" data-fav="${s.id}" aria-label="${t("Preferito")}">${fav ? "★" : "☆"}</button>
      <div style="min-width:0"><h3>${esc(s.name)}</h3>
        <div class="sub">${esc(nomeArea(s.area))}${s.group ? " · " + esc(t(s.group)) : ""} · ${t("quota rif.")} ${num(s.elev)} m · ${wmo(m.code)[0]} ${wmo(m.code)[1]}</div></div>
      <div class="score" style="border-color:${scoreColor(m.score)}"><b style="color:${scoreColor(m.score)}">${r1(m.score)}</b><span>Powder</span></div>
    </div>
    <div class="metrics">
      <div class="m"><b>${r0(m.p48)}<small> cm</small></b><span>${t("neve fresca 48h")}</span></div>
      <div class="m"><b>+${r0(m.n72)}<small> cm</small></b><span>${t("in arrivo 72h")}${rangeTxt(m.n72r) ? `<br><em class="rg">${rangeTxt(m.n72r)}</em>` : ""}</span></div>
      <div class="m"><b>${r0(m.temp)}°</b><span>${t("temp.")} ${s.elev} m</span></div>
      <div class="m"><b>${av ? dsq(av.level) : "–"}</b><span>${av ? t(DNAME[av.level] || "n.d.") : t("valanghe n.d.")}</span></div>
    </div>
    <div class="flags">
      <span class="flag fv">${ventoIcona(m.w7, m.w7dir, "mini")}<span>${t("in quota")}</span></span>
      <span class="flag">${t("0° a")} ${m.fz != null ? num(r0(m.fz)) + " m" : "–"}</span>
      ${(() => { const b = bestStation(s); return b ? `<span class="flag g" title="${esc(b.name)}">📏 ${r0(b.hs)} ${t("cm misurati")}${(b.d24 || 0) >= 1 ? ` · +${r0(b.d24)} ${t("in 24h")}` : ""}</span>` : ""; })()}
      ${m.flags.map(f => `<span class="flag ${f[0]}">${t(f[1])}</span>`).join("")}
    </div>
  </a>`;
}
const SORT_VAL = {
  powder: m => m.score, fresh: m => m.p48, p24: m => m.p24, p72: m => m.p72, n24: m => m.n24, next: m => m.n72, n7d: m => m.n7d,
  depth: m => m.depth ?? -1, station: (m, s) => { const b = bestStation(s); return b ? b.hs : -1; }, temp: m => m.temp, fz: m => m.fz ?? 0, w7: m => m.w7 ?? 0
};
function sortedSpots(){
  const arr = filterArea(SPOTS.slice(), state.area), k = state.sort, dir = state.dir || -1;
  if(k === "name") arr.sort((a, b) => a.name.localeCompare(b.name, lingua()) * (dir === -1 ? 1 : -1));
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
const snowCell = (v, plus, o = "", rg = null) => { const c = snowColor(v), fb = rangeTxt(rg); return `<td class="n ${o} ${c ? "s" : "z"}" ${c ? `style="--sc:${c}"` : ""} ${fb ? `title="${t("Forbice dei modelli: {f} cm", {f: fb})}"` : ""}>${v >= 0.5 ? (plus ? "+" : "") + r0(v) : "–"}${fb && v >= 0.5 ? `<i class="rgt">${fb}</i>` : ""}</td>`; };
function tableHTML(arr){
  const arrow = k => state.sort === k ? (state.dir === 1 ? " ▲" : " ▼") : "";
  let h = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th>${TCOLS.map(([k, tit, al]) =>
    `<th class="${al || ""} ${state.sort === k ? "on" : ""}" data-sortcol="${k}">${t(tit)}${arrow(k)}</th>`).join("")}<th class="l o2">${t("Note")}</th></tr></thead><tbody>`;
  for(const s of arr){
    const m = metrics(s), av = avForSpot(s), fav = state.fav.has(s.id);
    if(!m){ h += `<tr data-spot="${s.id}"><td></td><td class="l"><b>${esc(s.name)}</b></td><td colspan="${TCOLS.length}" class="note">${t("dati non disponibili")}</td></tr>`; continue; }
    h += `<tr data-spot="${s.id}">
      <td><button class="star ${fav ? "on" : ""}" data-fav="${s.id}" aria-label="${t("Preferito")}">${fav ? "★" : "☆"}</button></td>
      <td class="l"><div class="tn">${wmo(m.code)[0]} <b>${esc(s.name)}</b></div><div class="ts">${esc(s.group ? t(s.group) : nomeArea(s.area))} · ${num(s.elev)} m</div></td>
      <td class="n"><span class="pw" style="--pc:${scoreColor(m.score)}">${r1(m.score)}</span></td>
      ${snowCell(m.p24, 0, "o1")}${snowCell(m.p48)}${snowCell(m.p72, 0, "o1")}${snowCell(m.n24, 1, "o1")}${snowCell(m.n72, 1, "", m.n72r)}${snowCell(m.n7d, 1, "", m.n7dr)}
      ${(() => { const b = bestStation(s); return b ? `<td class="n" title="${esc(b.name)} · ${r0(b.elev)} m · ${r0(b.km)} km">${r0(b.hs)} cm${(b.d24 || 0) >= 1 ? ` <small class="up">+${r0(b.d24)}</small>` : ""}</td>` : `<td class="n z">–</td>`; })()}
      <td class="n o1">${m.depth != null ? r0(m.depth) + " cm" : "–"}</td>
      <td class="n" style="color:${m.temp > 0 ? "var(--warn)" : "var(--tx)"}">${r0(m.temp)}°</td>
      <td class="n o2">${m.fz != null ? num(r0(m.fz)) + " m" : "–"}</td>
      <td class="n">${ventoIcona(m.w7, m.w7dir, "mini")}</td>
      <td class="n">${av ? dsq(av.level) : `<span class="small">n.d.</span>`}</td>
      <td class="l fl o2">${m.flags.map(f => `<span class="flag ${f[0]}">${t(f[1])}</span>`).join("")}</td>
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
    <div class="sec"><h4>🌨 ${t("Neve in arrivo · 7 giorni")}</h4>${top(m => m.n7d).map(([s, m]) => row(s, `+${r0(m.n7d)} cm`, `${t("prossime 72h")}: +${r0(m.n72)} cm`)).join("")}</div>
    ${(() => { const meas = SPOTS.map(s => [s, bestStation(s)]).filter(x => x[1] && (x[1].d24 || 0) >= 1).sort((a, b) => b[1].d24 - a[1].d24).slice(0, 4);
      return meas.length ? `<div class="sec"><h4>📏 ${t("Neve nuova misurata · 24h")}</h4>${meas.map(([s, b]) => row(s, `+${r0(b.d24)} cm`, `${esc(b.name)} · ${r0(b.hs)} ${t("cm al suolo")}`)).join("")}</div>` : ""; })()}
    <div class="sec"><h4>🎯 ${t("Giornate migliori")}</h4>${best.length ? best.map(([s, b]) => row(s, `${dayName(b.date)} ${dayNum(b.date)}`, `~${r0(b.fresh)} ${t("cm freschi")} · ${t("affidabilità")} ${t(b.conf)}`)).join("") : `<p class="note" style="margin:0">${t("Nessuna nevicata ≥ 10 cm prevista nei prossimi {n} giorni.", {n: FORECAST_DAYS})}</p>`}
      <a class="more" href="${href("previsione/")}">${t("Apri la previsione →")}</a></div>
    <div class="sec"><h4>⚠️ ${t("Pericolo valanghe")}</h4>${avs.length ? avs.map(([s, a]) => `<div class="arow" data-spot="${s.id}"><div><b>${esc(s.name)}</b><span>${t(DNAME[a.level] || "n.d.")}</span></div>${dsq(a.level)}</div>`).join("") : `<p class="note" style="margin:0">${state.avErr ? t("Bollettini non raggiungibili.") : t("Bollettini non ancora emessi: la stagione dei bollettini parte di solito a dicembre.")}</p>`}
      <a class="more" href="${href("valanghe/")}">${t("Tutti i bollettini →")}</a></div>
    <div class="sec"><h4>${t("Vento in quota più forte")}</h4>${top(m => m.w7 || 0, 3).map(([s, m]) => row(s, ventoIcona(m.w7, m.w7dir, "mini"), "~3.000 m")).join("")}</div>`;
}

function renderList(){
  $("#modo").innerHTML = modoHTML();
  $("#vuList").innerHTML = unitaToggle();
  { const z = AREE.find(a => a.area === state.area); $("#spotTitle").textContent = z ? `${t("Spot")} · ${t(z.nome)}` : state.area === "★ Preferiti" ? t("Spot preferiti") : t("Spot"); }
  $("#areaChips").innerHTML = chipsHTML(AREAS, state.area, "data-area");
  $("#sort").value = state.sort;
  if(state.loading && !Object.keys(state.wx).length){ $("#list").innerHTML = '<div class="skeleton"></div>'.repeat(5); return; }
  const arr = sortedSpots(), table = isDesktop() && state.view === "tabella" && !semplice();
  document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
  $("#list").classList.toggle("as-table", table);
  $("#list").innerHTML = !arr.length ? `<div class="note" style="padding:20px 4px">${t("Nessuno spot qui. Tocca ☆ su uno spot per aggiungerlo ai preferiti.")}</div>`
    : table ? tableHTML(arr) : arr.map(semplice() ? cardSemplice : cardHTML).join("");
  if(semplice()) $("#hero").innerHTML = heroSemplice(); else renderHero();
  renderAside();
  const sf = $("#sideFoot");
  if(sf) sf.textContent = state.updated ? t("Dati aggiornati alle {ora}", {ora: state.updated.toLocaleTimeString(loc(), {hour:"2-digit", minute:"2-digit"})}) : "";
  $("#updated").textContent = state.updated ? t("Aggiornato alle {ora} · meteo alla quota di riferimento di ogni spot", {ora: state.updated.toLocaleTimeString(loc(), {hour:"2-digit", minute:"2-digit"})}) : "";
}

/* ---------- previsione (ex pianifica) ----------
   Due viste senza scorrimento laterale:
   - "Per giorno": una scheda per giorno con gli spot dove nevica, ordinati, con barra proporzionale
   - "Per spot": una riga per spot con i giorni a quadretti che si adattano alla larghezza */
const giornoLungo = iso => new Date(iso + "T12:00:00Z").toLocaleDateString(loc(), {weekday: "long", day: "numeric", month: "short", timeZone: "UTC"});
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
    const testa = `<div class="pv-h"><b>${i === 0 ? t("Oggi") : i === 1 ? t("Domani") : giornoLungo(g.date)}</b>${i <= 1 ? `<span class="pv-dt">${giornoLungo(g.date)}</span>` : ""}
      ${isWeekend(g.date) ? `<span class="pv-we">weekend</span>` : ""}<span class="pv-rg" title="${t("Regime")}: ${esc(t(R.name))}. ${esc(t(R.desc))}">${ventoRegione(g.date)}</span></div>`;
    if(!conNeve.length) return `<div class="pv-day nada">${testa}<p class="pv-none">${cielo(cod)} ${t("Nessuna nevicata prevista")}</p></div>`;
    const righe = conNeve.slice(0, 6).map(([s, d]) => {
      const c = snowColor(d.snow) || "#bae6fd", w = Math.max(6, Math.round(100 * d.snow / scala));
      const forb = d.ens && d.ens.n >= 2 && d.ens.max - d.ens.min >= 3 ? `<small>${r0(d.ens.min)}–${r0(d.ens.max)}</small>` : "";
      return `<div class="pv-bar ${d.conf === "bassa" ? "low" : ""}" data-spot="${s.id}"><span class="n">${state.fav.has(s.id) ? "★ " : ""}${esc(nomeCorto(s))}</span>
        <span class="b"><i style="width:${w}%;background:${c}"></i></span><em>${r0(d.snow)} cm${forb}</em></div>`;
    }).join("");
    const altri = conNeve.length - 6;
    return `<div class="pv-day">${testa}${righe}${altri > 0 ? `<p class="pv-more">${t("+ altri {n} spot con neve (fino a {cm} cm)", {n: altri, cm: r0(conNeve[6][1].snow)})}</p>` : ""}</div>`;
  }).join("")}</div>`;
}
function planSpot(arr, days){
  const tot = s => dailyPlan(s).reduce((a, d) => a + (d.snow || 0), 0);
  const cellaGiorno = (d, g) => {
    const c = d && d.snow >= 1 ? snowColor(d.snow) : null;
    return `<span class="${c ? "" : "z"} ${d && d.conf === "bassa" ? "low" : ""} ${isWeekend(g.date) ? "we" : ""}" ${c ? `style="background:${c}"` : ""} title="${g.date}: ${d ? r1(d.snow) : "–"} cm">${d && d.snow >= 1 ? r0(d.snow) : ""}</span>`;
  };
  return `<div class="pv-grid">
    <div class="pv-row pv-hd"><span class="n"></span><div class="cells" style="grid-template-columns:repeat(${days.length},1fr)">${days.map((g, i) => `<span class="${isWeekend(g.date) ? "we" : ""}">${i === 0 ? t("oggi") : dayName(g.date).slice(0, 2)}<br>${dayNum(g.date)}</span>`).join("")}</div><em>tot</em></div>
    ${arr.map(s => { const p = dailyPlan(s); return `<div class="pv-row" data-spot="${s.id}"><span class="n">${state.fav.has(s.id) ? "★ " : ""}${esc(nomeCorto(s))}</span>
      <div class="cells" style="grid-template-columns:repeat(${days.length},1fr)">${days.map((g, i) => cellaGiorno(p[i], g)).join("")}</div><em>${r0(tot(s))}</em></div>`; }).join("")}
  </div>
  <div class="plan-legend">${t("cm/giorno")}: <i style="background:#e0f2fe"></i>1–5 <i style="background:#bae6fd"></i>5–10 <i style="background:#7dd3fc"></i>10–20 <i style="background:#38bdf8"></i>20–35 <i style="background:#0ea5e9"></i>35+ · ${t("sbiadito = previsione poco affidabile")}</div>`;
}
function renderPlan(){
  $("#planChips").innerHTML = chipsHTML(AREAS, state.planArea, "data-planarea");
  document.querySelectorAll("[data-pvmode]").forEach(b => b.classList.toggle("on", b.dataset.pvmode === state.planMode));
  const arr = filterArea(SPOTS.slice(), state.planArea);
  const any = arr.find(s => dailyPlan(s).length);
  if(!any){ $("#planTable").innerHTML = state.loading ? '<div class="skeleton"></div>' : `<p class="note">${t("Previsioni non disponibili.")}</p>`; $("#bestDays").innerHTML = ""; return; }
  const days = dailyPlan(any);
  const totals = s => dailyPlan(s).reduce((a, d) => a + d.snow, 0);
  arr.sort((a, b) => totals(b) - totals(a));
  $("#planTable").innerHTML = state.planMode === "spot" ? planSpot(arr, days) : planGiorni(arr, days);

  const best = arr.map(s => [s, bestDay(s)]).filter(x => x[1]).sort((a, b) => b[1].score - a[1].score).slice(0, 5);
  $("#bestDays").innerHTML = best.length ? best.map(([s, b]) => `<div class="card" data-spot="${s.id}"><div class="t" style="align-items:center">
      <div style="min-width:0"><h3 style="font-size:15px">${esc(s.name)}</h3>
      <div class="sub">${dayName(b.date)} ${dayNum(b.date)} · ~${r0(b.fresh)} ${t("cm freschi")} · ${b.sunny > .6 ? "☀️ " + t("sole") : b.sunny > .3 ? "⛅ " + t("schiarite") : "☁️ " + t("coperto")} · ${t("affidabilità")} ${t(b.conf)}</div></div>
      <div class="score" style="border-color:var(--powder)"><b style="color:var(--powder);font-size:16px">${dayName(b.date)}</b><span>${dayNum(b.date)}</span></div>
    </div></div>`).join("") : `<p class="note">${t("Nessuna nevicata significativa (≥ 10 cm) prevista nei prossimi {n} giorni.", {n: FORECAST_DAYS})}</p>`;
}

/* ---------- dettaglio ---------- */
function daysHTML(spot){
  const p = dailyPlan(spot);
  const mx = Math.max(5, ...p.map(d => d.ens ? d.ens.max : d.snow));
  return `<div class="plan-wrap"><div class="days" style="grid-template-columns:repeat(${p.length},minmax(62px,1fr));min-width:${p.length * 66}px">${p.map((d, k) => {
    const R = d.regime ? regimeLabel(d.regime.key) : null, fx = d.regime && d.regime.wet ? flowEffect(spot, d.regime.key) : null;
    const lo = d.ens && d.ens.n >= 2 ? d.ens.min : null, hi = d.ens && d.ens.n >= 2 ? d.ens.max : null;
    return `<div class="day ${fx ? "fx-" + (fx.cls || "n") : ""}" style="${d.conf === "bassa" ? "opacity:.75" : ""}">
      <div class="dn">${k === 0 ? t("Oggi") : dayName(d.date)} ${dayNum(d.date)}</div><div class="ic">${wmo(d.code)[0]}</div>
      <div class="bar">${hi != null ? `<b class="rbar" style="height:${Math.max(2, 44 * hi / mx)}px"></b>` : ""}<i style="height:${Math.max(2, 44 * d.snow / mx)}px;opacity:${d.snow > 0 ? 1 : .25}"></i></div>
      <div class="sn">${d.snow >= 0.5 ? r0(d.snow) + "cm" : "–"}</div>
      ${hi != null && hi - lo >= 1 ? `<div class="rg">${r0(lo)}–${r0(hi)}</div>` : `<div class="rg">&nbsp;</div>`}
      <div class="tt">${r0(d.tmax)}° / ${r0(d.tmin)}°</div>
      <div class="tv" ${R ? `title="${t("Regime delle precipitazioni")}: ${esc(t(R.name))}. ${esc(t(R.desc))}${fx ? " — " + t(fx.txt) : ""}${d.regime.n ? ` (${d.regime.count}/${d.regime.n} ${t("modelli")})` : ""}"` : ""}>${ventoIcona(d.w7, d.w7dir, "cella")}</div>
      <div class="conf">${t(d.conf)}</div></div>`; }).join("")}</div></div>
    <p class="small" style="margin:6px 0 0">${t("Numero grande = Previsione FreeRide (mediana dei modelli), sotto la forbice min–max. Barra chiara = valore più alto tra i modelli. Sotto: vento in quota più forte del giorno (freccia = dove va il vento). Bordo verde/giallo = flusso in quota favorevole/sfavorevole alla neve su questo spot.")} ${isDesktop() ? "" : t("Scorri per vedere tutti i {n} giorni.", {n: p.length})}</p>`;
}

function windModelsHTML(e, dates){
  if(!dates.some(d => e.days[d].wind && e.days[d].wind.w7)) return "";
  const rows = MODELS.filter(m => e.models.includes(m.id)).map(m =>
    `<tr><td class="l">${esc(m.label)}</td>${dates.map(d => { const w = e.days[d].wind;
      return w && w.models[m.id] != null ? `<td>${ventoIcona(w.models[m.id], w.dirs ? w.dirs[m.id] : null, "cella")}</td>` : `<td class="z">n.d.</td>`; }).join("")}</tr>`).join("");
  return `<div class="subh-row"><h5 class="subh">${t("Vento in quota (~3.000 m) · massimo del giorno")}</h5>${unitaToggle()}</div>
    <div class="st-wrap"><table class="mdl wind">
    <thead><tr><th class="l"></th>${dates.map((d, i) => `<th>${i === 0 ? t("Oggi") : dayName(d)}<br>${dayNum(d)}</th>`).join("")}</tr></thead>
    <tbody>${rows}
      <tr class="fr"><td class="l"><b>FreeRide</b><span>${t("mediana · accordo")}</span></td>${dates.map(d => { const w = e.days[d].wind;
        return w && w.w7 ? `<td>${ventoIcona(w.w7.med, w.dir, "cella", {extra: w.nDir ? `${w.accordo}/${w.nDir}` : ""})}</td>` : `<td class="z">n.d.</td>`; }).join("")}</tr>
    </tbody></table></div>
    <p class="small" style="margin:6px 0 0">${legendaVento()}</p>
    <p class="small" style="margin:4px 0 0">${t("La freccia punta dove va il vento (come su windguru), con il nome del vento e l'intensità. Da {a} c'è trasporto di neve, da {b} accumuli importanti e impianti in quota a rischio. \"4/5\" = quanti modelli danno il vento dallo stesso settore.", {a: `${inUnita(30)} ${etichettaUnita()}`, b: inUnita(50)})}</p>`;
}
/* vento della regione in un giorno: media dei flussi in quota degli spot (per la Previsione) */
function ventoRegione(date){
  const r = SPOTS.map(s => dayRegime(s, date)).filter(Boolean);
  if(!r.length) return "";
  const dir = mediaDirezioni(r.map(x => x.dir), r.map(x => x.speed));
  const sp = r.reduce((a, x) => a + x.speed, 0) / r.length;
  return ventoIcona(sp, dir, "mini");
}

function modelsHTML(spot){
  const e = ensembleFor(spot);
  if(!e || !e.models.length) return `<p class="note" style="margin:0">${t("Confronto tra modelli non disponibile al momento.")}</p>`;
  const today = romeNowISO().slice(0, 10);
  const dates = Object.keys(e.days).filter(d => d >= today).slice(0, 6);
  const cell = v => v == null ? `<td class="z">n.d.</td>` : `<td class="${v >= 1 ? "s" : "z"}" ${v >= 1 ? `style="--sc:${snowColor(v) || "#bae6fd"}"` : ""}>${v >= 0.5 ? r0(v) : "–"}</td>`;
  const rows = MODELS.filter(m => e.models.includes(m.id)).map(m =>
    `<tr><td class="l">${esc(m.label)}${calTag(m.id, spot.id)}</td>${dates.map(d => cell(e.days[d].models[m.id])).join("")}</tr>`).join("");
  const ag = agreement(e.n72);
  return `<div class="st-wrap"><table class="mdl">
    <thead><tr><th class="l">${t("cm di neve")}</th>${dates.map((d, i) => `<th>${i === 0 ? t("Oggi") : dayName(d)}<br>${dayNum(d)}</th>`).join("")}</tr></thead>
    <tbody>${rows}
      <tr class="fr"><td class="l"><b>${t("Previsione FreeRide")}</b><span>${state.cal ? t("mediana pesata") : t("mediana")} · ${t("forbice")}</span></td>${dates.map(d => { const x = e.days[d]; return x && x.n ? `<td><b>${x.med >= 0.5 ? r0(x.med) : "–"}</b>${x.n >= 2 && x.max - x.min >= 1 ? `<span>${r0(x.min)}–${r0(x.max)}</span>` : ""}</td>` : `<td class="z">n.d.</td>`; }).join("")}</tr>
    </tbody></table></div>
    ${ag ? `<p class="small" style="margin:8px 0 0"><span class="agr agr-${ag.lvl}">● ${t(ag.txt)}</span> ${t("sulle prossime 72 ore")} (${r0(e.n72.min)}–${r0(e.n72.max)} cm).</p>` : ""}
    ${windModelsHTML(e, dates)}
    <p class="small" style="margin:6px 0 0">${calNote(spot.id)}</p>`;
}
/* fattore e peso della calibrazione accanto al nome del modello */
function calTag(mid, spotId){
  if(!state.cal) return "";
  const c = calOf(state.cal, mid, spotId);
  if(c.factor === 1 && c.weight === 1) return "";
  const f = v => (Math.round(v * 100) / 100).toLocaleString(loc());
  return `<span>×${f(c.factor)} · ${t("peso")} ${f(c.weight)}</span>`;
}
function calNote(spotId){
  const base = t("Tutti i modelli usano lo stesso rapporto neve/acqua variabile con la temperatura.");
  const c = state.cal;
  if(!c) return base + " " + t("Per ora pesano tutti uguale: la calibrazione sulle stazioni non è ancora disponibile.");
  const z = zonaDi(c, spotId), zn = z && c.zone[z];
  const v = zn && zn.verifica ? zn.verifica : c.verifica;
  const dove = zn ? t("sulle stazioni della zona <b>{zona}</b> ({n} stazioni)", {zona: esc(t(zn.nome)), n: zn.stazioni}) : t("su {n} stazioni di Alto Adige e Veneto", {n: c.stazioni || t("alcune")});
  return base + " " + t("I cm sono corretti con la <b>calibrazione</b> {dove}, inverni {inverni}: ×fattore = correzione dei cm, peso = quanto conta il modello nella Previsione FreeRide (chi ha sbagliato meno conta di più).", {dove, inverni: (c.stagioni || []).join(", ")})
    + (v && v.nevicate ? " " + t("Nella verifica sugli inverni passati, a 1 giorno le nevicate di almeno 10 cm riconosciute sono passate da {a} a {b} su {n}.", {a: v.presePrima, b: v.preseDopo, n: v.nevicate}) : "")
    + ` <a href="${href("guida/")}#calibrazione">${t("Come funziona")}</a>`;
}

const linkAnimazione = s => `<a class="pc-lnk" href="${href("precipitazioni/")}?spot=${s.id}"><span class="pc-lnk-i" aria-hidden="true"></span><span><b>${t("Guarda l'animazione delle precipitazioni")}</b><small>${t("Neve e pioggia ora per ora sulla mappa, centrata su {spot}", {spot: esc(s.name.split(" · ")[0])})}</small></span><i aria-hidden="true">→</i></a>`;
/* indice delle 5 sezioni (sul computer resta fisso a sinistra mentre scorri) */
const indiceSpot = parti => `<div class="sp-lay"><nav class="sp-ind" aria-label="${t("Sezioni della pagina")}"><p>${t("In questa pagina")}</p>${GRUPPI_SPOT.map((g, i) => parti[i] ? `<button type="button" data-goto="${g.id}" class="${i === 0 ? "on" : ""}"><span>${i + 1}</span>${esc(t(g.nome))}</button>` : "").join("")}</nav>`;
/* l'indice segue lo scorrimento della pagina */
let spiaSezioni = null;
function seguiSezioni(){
  if(spiaSezioni) spiaSezioni.disconnect();
  if(typeof IntersectionObserver === "undefined") return;
  const nav = document.querySelector("#v-detail .sp-ind");
  if(!nav) return;
  spiaSezioni = new IntersectionObserver(es => {
    const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if(vis) nav.querySelectorAll("[data-goto]").forEach(b => b.classList.toggle("on", b.dataset.goto === vis.target.id));
  }, {rootMargin: "-90px 0px -60% 0px"});
  document.querySelectorAll("#v-detail .grp").forEach(g => spiaSezioni.observe(g));
}
function renderDetail(id){
  const s = SPOTS.find(x => x.id === id);
  if(!s){ naviga("", true); return; }
  const m = metrics(s), best = bestDay(s);
  const tab = tabellaHTML;
  const head = `<p class="dzone">⛰ ${esc(s.zones)}${s.group ? " · " + esc(t(s.group)) : ""} · ${t("quota di riferimento")} ${num(s.elev)} m</p>`;
  const nd = `<div class="sec note o-now">${t("Dati meteo non disponibili.")}</div>`;
  // le 5 sezioni, sempre in quest'ordine: dati raccolti, previsioni, valanghe, 3D, webcam
  let dati = "", prev = "", av = "", tre = "", cam = "";
  if(semplice()){
    const avs = avForSpot(s);
    if(m){
      const g = giudizio(m, avs);
      dati += `<div class="sec sg gv-${g.cls} o-now" id="o-now"><h3 class="sh sr">${t("Adesso")}</h3><div class="sg-g sg-big"><span>${g.ico}</span> ${esc(g.txt)}</div><p class="sg-sub">${esc(g.sub)}</p>
        ${g.avvisi.length ? `<p class="sg-w">${g.avvisi.map(esc).join(" ")}</p>` : ""}
        <div class="sg-n">
          <div><b>${r0(m.p48)}<small> cm</small></b><span>${t("neve fresca 2 gg")}</span></div>
          <div><b>${m.n72 >= 0.5 ? "+" + r0(m.n72) : "0"}<small> cm</small></b><span>${t("in arrivo 3 gg")}</span></div>
          <div class="sg-v">${ventoIcona(m.w7, m.w7dir, "cella")}<span>${t("vento")} ${etichettaUnita()}</span></div>
          <div><b>${r0(m.temp)}°</b><span>${t("adesso a")} ${num(s.elev)} m</span></div>
        </div><div class="sg-vu">${unitaToggle()}</div></div>`;
      prev += tab("o-plan", t("Prossimi giorni"), `${giorniSemplici(s)}${best ? `<p class="sg-best">🎯 ${t("Giorno migliore: <b>{giorno}</b>, circa {cm} cm di neve fresca", {giorno: giornoLungo(best.date), cm: r0(best.fresh)})}</p>` : ""}`);
      prev += linkAnimazione(s);
    }else dati += nd;
    av += tab("o-av", t("Pericolo valanghe"), avBlockHTML(s));
    tre += tab("o-3d", t("Montagna in 3D · scegli la linea"), peakvisorHTML(s));
    cam += tab("o-cam", t("Webcam"), camsHTML(s));
    $("#v-detail").innerHTML = `${head}${indiceSpot([dati, prev, av, tre, cam])}<div class="sp-corpo">${gruppoHTML(0, dati)}${gruppoHTML(1, prev)}${gruppoHTML(2, av)}${gruppoHTML(3, tre)}${gruppoHTML(4, cam)}</div></div>
      <button class="sg-tutti" data-modo="completa">📊 ${t("Vedi tutti i dati di questo spot")}</button>
      <div class="disc">${t("Indicazioni automatiche. Prima di uscire leggi il bollettino valanghe, osserva il terreno e porta ARTVA, pala e sonda.")}</div>`;
    seguiSezioni();
    return;
  }
  // 1 · Dati raccolti
  if(!m) dati += nd;
  else{
    dati += tab("o-now", `${t("Adesso")} · ${wmo(m.code)[0]} ${wmo(m.code)[1]}`, `<div class="sec-tools">${unitaToggle()}</div>
      <div class="grid3">
        <div class="big"><b style="color:${scoreColor(m.score)}">${r1(m.score)}</b><span>${t("Indice Powder")}</span></div>
        <div class="big"><b>${r0(m.temp)}°C</b><span>${t("a")} ${s.elev} m</span></div>
        <div class="big"><b>${m.fz != null ? num(r0(m.fz)) : "–"}</b><span>${t("zero termico (m)")}</span></div>
        <div class="big bigv">${ventoIcona(m.w7, m.w7dir, "grande")}<span>${t("vento in quota (~3.000 m)")}</span></div>
        <div class="big"><b>${inUnita(m.gust) ?? "–"}</b><span>${t("raffiche a 10 m")} · ${etichettaUnita()}</span></div>
        <div class="big"><b>${m.depth != null ? r0(m.depth) : "–"}</b><span>${t("neve al suolo stimata cm")}</span></div>
      </div>
      ${m.flags.length ? `<div class="flags">${m.flags.map(f => `<span class="flag ${f[0]}">${t(f[1])}</span>`).join("")}</div>` : ""}`);
    dati += tab("o-snow", t("Neve fresca · stima del modello"), `
      <div class="grid3">
        <div class="big"><b>${r0(m.p24)}</b><span>${t("cm ultime 24h")}</span></div>
        <div class="big"><b>${r0(m.p48)}</b><span>${t("cm ultime 48h")}</span></div>
        <div class="big"><b>${r0(m.p72)}</b><span>${t("cm ultimi 3 gg")}</span></div>
        <div class="big"><b style="color:var(--powder)">+${r0(m.n24)}</b><span>${t("cm prossime 24h")}</span></div>
        <div class="big"><b style="color:var(--powder)">+${r0(m.n72)}</b><span>${t("cm prossime 72h")}</span></div>
        <div class="big"><b style="color:var(--powder)">+${r0(m.n7d)}</b><span>${t("cm prossimi 7 gg")}</span></div>
      </div>`);
  }
  dati += tab("o-meas", t("Neve misurata · stazioni vicine"), neveMisurataHTML(s), "largo");
  // 2 · Previsioni
  if(m){
    prev += tab("o-plan", t("Previsioni · prossimi {n} giorni", {n: FORECAST_DAYS}),
      `<div class="sec-tools">${unitaToggle()}</div>${best ? `<div class="flags" style="margin:0 0 10px"><span class="flag p">🎯 ${t("Giornata migliore")}: ${dayName(best.date)} ${dayNum(best.date)} · ~${r0(best.fresh)} ${t("cm freschi")} · ${t("affidabilità")} ${t(best.conf)}</span></div>` : ""}${daysHTML(s)}`);
    prev += linkAnimazione(s);
    prev += tab("o-quote", t("Neve per quota · Vetta, Metà, Base"), quoteHTML(s));
    prev += tab("o-models", t("Confronto modelli"), modelsHTML(s));
    prev += tab("o-hour", t("Ora per ora · ultimi 14 giorni e previsione"), oraPerOraHTML(s));
  }
  // 3 · Valanghe · 4 · 3D · 5 · Webcam
  av += tab("o-av", t("Pericolo valanghe · bollettino ufficiale"), avBlockHTML(s));
  tre += tab("o-3d", t("Montagna in 3D · scegli la linea"), peakvisorHTML(s));
  cam += tab("o-cam", t("Webcam"), camsHTML(s));
  $("#v-detail").innerHTML = `${head}${indiceSpot([dati, prev, av, tre, cam])}<div class="sp-corpo">${gruppoHTML(0, dati)}${gruppoHTML(1, prev)}${gruppoHTML(2, av)}${gruppoHTML(3, tre)}${gruppoHTML(4, cam)}</div></div>
    <div class="disc">${t("Dati automatici e indicativi. Prima di uscire leggi il bollettino completo, osserva il terreno e porta ARTVA, pala e sonda.")}</div>`;
  avviaOraPerOra(s, $("#v-detail"));
  avviaNeveMisurata(s, $("#v-detail"));
  seguiSezioni();
}

/* ---------- valanghe / webcam ---------- */
function renderAv(){
  const arr = SPOTS.map(s => [s, avForSpot(s)]).sort((a, b) => ((b[1]?.level) || 0) - ((a[1]?.level) || 0));
  // 1. bollettini completi, raggruppati per servizio
  const servizi = bollettiniPerServizio(SPOTS);
  let bh;
  if(state.loading && !Object.keys(state.av).length) bh = '<div class="skeleton"></div>'.repeat(2);
  else if(!servizi.length) bh = `<div class="sec note">${state.avErr ? t("Non riesco a raggiungere i bollettini da qui: aprili dai link ufficiali qui sotto.") : t("Nessun bollettino attivo in questo momento: i servizi valanghe iniziano a pubblicarli ogni giorno di solito a dicembre. Appena escono li trovi qui, completi.")}</div>`;
  else bh = servizi.map(sv => `<div class="avsrv"><h3 class="ttl" style="font-size:16px;margin:16px 0 8px">${esc(t(sv.nome))}${sv.date ? ` <span class="small">· ${new Date(sv.date + "T12:00:00Z").toLocaleDateString(loc(), {weekday: "long", day: "numeric", month: "long", timeZone: "UTC"})}</span>` : ""}</h3>
    ${sv.items.map(({b, level, spots}) => {
      const zone = (b.regions || []).map(r => r.name);
      const hl = stripTags(b.avalancheActivity && b.avalancheActivity.highlights);
      const probs = [...new Set((b.avalancheProblems || []).map(p => PROB[p.problemType] || p.problemType))];
      return `<details class="avb"><summary>
        <div class="avb-h">${dsq(level)}<div style="min-width:0"><b>${t(DNAME[level] || "n.d.")}</b>
          <span class="avb-z">${esc(zone.slice(0, 3).join(", "))}${zone.length > 3 ? (zone.length === 4 ? " " + t("e un'altra zona") : " " + t("e altre {n} zone", {n: zone.length - 3})) : ""}</span></div></div>
        ${spots.length ? `<div class="avb-sp">${spots.map(s => `<span>${esc(s.name.split(" · ")[0])}</span>`).join("")}</div>` : ""}
        ${hl ? `<p class="avb-hl">${esc(hl)}</p>` : ""}
        ${probs.length ? `<p class="avb-pr">${probs.map(esc).join(" · ")}</p>` : ""}
        <span class="avb-more">${t("Leggi il bollettino")}</span>
      </summary>
      <div class="avb-body">${gradiHTML(b)}${problemiHTML(b) ? `<div style="margin-top:8px">${problemiHTML(b)}</div>` : ""}${testiHTML(b)}
        ${zone.length > 3 ? `<p class="small">${t("Zone")}: ${esc(zone.join(", "))}</p>` : ""}${intestazione(b, sv.p)}</div></details>`;
    }).join("")}</div>`).join("");
  $("#avBulletins").innerHTML = bh;
  // 2. elenco rapido per spot
  let h;
  if(state.loading && !Object.keys(state.av).length) h = "";
  else if(!arr.some(x => x[1])) h = `<p class="note">${t("Il grado per spot comparirà quando i bollettini saranno pubblicati.")}</p>`;
  else h = arr.map(([s, av]) => `<div class="card" data-spot="${s.id}"><div class="t" style="align-items:center">${av ? dsq(av.level) : dsq(0)}
      <div style="min-width:0"><h3 style="font-size:15px">${esc(s.name)}</h3><div class="sub">${av ? `${t(DNAME[av.level] || "n.d.")} · ${av.exact ? esc(av.names.slice(0, 2).join(", ")) : t("max bollettino") + " " + esc(av.provs.map(p => t(PROV_NAME[p])).join("/"))}` : t("Bollettino non disponibile")}</div></div>
    </div></div>`).join("");
  $("#avList").innerHTML = h;
  $("#avLinks").innerHTML = AV_LINKS.map(l => `<a class="lnk" href="${l.u}" target="_blank" rel="noopener">${esc(t(l.t))}</a>`).join("");
}
function renderCams(){
  $("#camChips").innerHTML = chipsHTML(AREAS, state.camArea, "data-camarea");
  const arr = filterArea(SPOTS.slice(), state.camArea).sort((a, b) => b.cams.filter(c => c.img || c.embed).length - a.cams.filter(c => c.img || c.embed).length);
  $("#camList").innerHTML = arr.map(s => `<div class="sec" style="margin:0"><h4 style="color:var(--tx);font-size:14px;text-transform:none;letter-spacing:0">${esc(s.name)} <span class="small">· ${esc(s.zones)}</span></h4>${camsHTML(s)}</div>`).join("");
}

/* ---------- navigazione: un indirizzo vero per ogni pagina (spot/cortina/, valanghe/ …) ----------
   Il tag <base> della pagina è la radice del sito: tutti i link sono relativi a lei. */
const BASE = new URL(document.baseURI).pathname;
const percorsoAttuale = () => { const p = location.pathname; return p.startsWith(BASE) ? p.slice(BASE.length) : p.replace(/^\//, ""); };
let rotta = leggiPercorso(percorsoAttuale()), passi = 0;
// vecchi link con # (#spot-cortina, #valanghe…): li trasformo nell'indirizzo nuovo
{ const v = daHash(location.hash); if(v != null){ history.replaceState(null, "", new URL(v, document.baseURI)); rotta = leggiPercorso(v); } }
function naviga(path, sostituisci = false){
  const url = new URL(u(path) || "./", document.baseURI);
  if(url.pathname === location.pathname && !url.hash){ window.scrollTo(0, 0); return; }
  history[sostituisci ? "replaceState" : "pushState"](null, "", url);
  if(!sostituisci) passi++;
  rotta = leggiPercorso(percorsoAttuale());
  route(); window.scrollTo(0, 0);
}
const quando = () => (state.updated || new Date()).toLocaleDateString(loc(), {weekday: "long", day: "numeric", month: "long"}).replace(/^./, c => c.toUpperCase())
  + (state.updated ? ` · ${t("ore")} ${state.updated.toLocaleTimeString(loc(), {hour: "2-digit", minute: "2-digit"})}` : "");
function impostaMeta(meta, r){
  document.title = meta.title;
  const d = document.querySelector('meta[name="description"]'); if(d) d.setAttribute("content", meta.description);
  const c = document.querySelector('link[rel="canonical"]');
  if(c && c.dataset.radice) c.setAttribute("href", c.dataset.radice + u(r.path));
  // le due lingue si indicano a vicenda (Google) e il badge porta alla stessa pagina nell'altra lingua
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(l => { const lg = l.getAttribute("hreflang") === "en" ? "en" : "it"; if(l.dataset.radice) l.setAttribute("href", l.dataset.radice + u(r.path, lg)); });
  document.querySelectorAll("[data-lingua-badge]").forEach(b => b.innerHTML = badgeLingua(r.path));
}
function route(){
  const r = rotta, meta = metaPer(r);
  let view = "v-spot";
  if(r.vista === "spot"){ view = "v-detail"; renderDetail(r.id); }
  else if(r.vista === "previsione"){ view = "v-pianifica"; renderPlan(); }
  else if(r.vista === "valanghe"){ view = "v-valanghe"; renderAv(); }
  else if(r.vista === "webcam"){ view = "v-webcam"; renderCams(); }
  else{
    // home e liste: la zona viene dall'indirizzo (spot/veneto/), i preferiti restano un filtro
    if(r.vista === "lista") state.area = r.area || "Tutti";
    else if(state.area !== "★ Preferiti") state.area = "Tutti";
    renderList();
  }
  const cover = $("#cover"), foto = cover.querySelector(".cv-img");
  cover.innerHTML = coverHTML(r, quando(), {fav: r.vista === "spot" ? state.fav.has(r.id) : null});
  if(foto) cover.querySelector(".cv-img").replaceWith(foto);   // la foto resta quella già caricata
  $("#cover").classList.toggle("cv-spot", r.vista === "spot");
  document.body.dataset.vista = r.vista;
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("on", v.id === view));
  document.querySelectorAll("[data-tab]").forEach(a => { const on = a.dataset.tab === meta.tab; a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
  impostaMeta(meta, r);
  renderMenu();
}
const rerender = () => { document.body.classList.toggle("semplice", semplice()); renderBanner(); route(); };

/* menu a scomparsa (telefono) */
function renderMenu(){
  $("#menuZone").innerHTML = AREE.map(a => `<a href="${href(`spot/${a.slug}/`)}"><b>${esc(t(a.nome))}</b><span>${t("{n} spot", {n: SPOTS.filter(s => s.area === a.area).length})}</span></a>`).join("");
  $("#menuModo").innerHTML = modoSeg();
  $("#hmodo").innerHTML = state.modo ? modoSeg() : "";
}
function menu(apri){
  const m = $("#menu"), b = $("#menuBtn");
  m.hidden = !apri; b.setAttribute("aria-expanded", String(apri));
  document.body.classList.toggle("menu-aperto", apri);
  if(apri) m.querySelector(".mlinks a")?.focus(); else b.focus({preventScroll: true});
}
$("#menuBtn").addEventListener("click", () => menu(true));
document.addEventListener("keydown", e => { if(e.key === "Escape" && !$("#menu").hidden) menu(false); });

/* link interni: cambio pagina senza ricaricare (gli indirizzi restano veri per Google e per la condivisione) */
function linkInterno(a, e){
  const h = a.getAttribute("href");
  if(!h || a.target === "_blank" || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return null;
  if(h.startsWith("#")) return {ancora: h.slice(1)};
  const dest = new URL(a.href);
  if(dest.origin !== location.origin || !dest.pathname.startsWith(BASE)) return null;
  const L = percorsoLogico(dest.pathname.slice(BASE.length));
  if(L.lingua !== lingua()) return null;   // cambio lingua: pagina ricaricata
  const p = L.percorso;
  if(/\.[a-z0-9]+$/i.test(p) || p.startsWith("guida") || p.startsWith("precipitazioni") || p.startsWith("contatti") || p.startsWith("html/")) return null;   // file e pagina guida: caricamento normale
  return {path: p + dest.search};
}

document.addEventListener("click", e => {
  if(e.target.closest("[data-menuclose]")){ menu(false); return; }
  const f = e.target.closest("[data-fav]");
  if(f){ e.preventDefault(); e.stopPropagation(); const id = f.dataset.fav; state.fav.has(id) ? state.fav.delete(id) : state.fav.add(id); LS.set("fr_fav", [...state.fav]); rerender(); return; }
  const vu = e.target.closest("[data-vu]");
  if(vu){ state.ventoUnita = vu.dataset.vu; LS.set("fr_vento", state.ventoUnita); rerender(); return; }
  const md = e.target.closest("[data-modo]");
  if(md){ state.modo = md.dataset.modo; LS.set("fr_modo", state.modo); rerender(); return; }
  const go = e.target.closest("[data-goto]");
  if(go){
    const el = document.getElementById(go.dataset.goto);
    go.parentElement.querySelectorAll("[data-goto]").forEach(b => b.classList.toggle("on", b === go));
    if(el) el.scrollIntoView({behavior: "smooth", block: "start"});
    return;
  }
  const bk = e.target.closest("[data-back]");
  if(bk){ e.preventDefault(); if(passi > 0){ passi--; history.back(); } else naviga(percorsoLogico(bk.getAttribute("href") || "").percorso); return; }
  const a = e.target.closest("a[href]");
  if(a){
    const li = linkInterno(a, e);
    if(!li) return;
    e.preventDefault();
    if(!$("#menu").hidden) menu(false);
    if(li.ancora != null){ const el = document.getElementById(li.ancora); if(el){ el.setAttribute("tabindex", "-1"); el.focus(); el.scrollIntoView(); } return; }
    naviga(li.path);
    return;
  }
  if(e.target.closest("[data-embed],img[data-zoom]")) return;
  const c = e.target.closest("[data-spot]");
  if(c){ naviga(percorsoSpot(c.dataset.spot)); return; }
  const sc = e.target.closest("[data-sortcol]");
  if(sc){ const k = sc.dataset.sortcol; state.dir = state.sort === k ? -state.dir : (k === "name" || k === "danger" ? -1 : -1); state.sort = k; LS.set("fr_sort", k); renderList(); return; }
  const vw = e.target.closest("[data-view]");
  if(vw){ state.view = vw.dataset.view; LS.set("fr_view", state.view); renderList(); return; }
  const ar = e.target.closest("[data-area]");
  if(ar){
    const z = ar.dataset.area;
    if(z === "★ Preferiti"){ state.area = z; renderList(); return; }
    naviga(z === "Tutti" ? "spot/" : percorsoArea(z));
    return;
  }
  const pm = e.target.closest("[data-pvmode]");
  if(pm){ state.planMode = pm.dataset.pvmode; LS.set("fr_pvmode", state.planMode); renderPlan(); return; }
  const pa = e.target.closest("[data-planarea]");
  if(pa){ state.planArea = pa.dataset.planarea; renderPlan(); return; }
  const ca = e.target.closest("[data-camarea]");
  if(ca){ state.camArea = ca.dataset.camarea; renderCams(); return; }
});
$("#sort").addEventListener("change", e => { state.sort = e.target.value; state.dir = -1; LS.set("fr_sort", state.sort); renderList(); });
$("#refresh").addEventListener("click", () => loadAll());
window.addEventListener("popstate", () => { rotta = leggiPercorso(percorsoAttuale()); route(); });
// un vecchio link con # aperto mentre il sito è già caricato
window.addEventListener("hashchange", () => { const v = daHash(location.hash); if(v != null) naviga(v, true); });
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
    state.wx = j.wx || {}; state.ens = j.ens || {}; state.ensMemo = {}; state.cal = j.cal || null; state.quote = j.quote || null; state.camCheck = j.camCheck || null;
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
    state.loading = false; $("#refresh").classList.remove("spin"); rerender();
    // se il file del robot non ha la neve per quota (es. Open-Meteo non rispondeva), la chiediamo dal telefono
    if(!state.quote && !state.demo) loadQuote().then(rerender, () => {});
    // sito in inglese: bollettini Euregio nella versione inglese
    if(inglese()) bollettiniInInglese().then(c => { if(c) rerender(); }, () => {});
    return;
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
// pagina inglese: testi fissi della pagina (menu, footer…) e link interni nella lingua giusta
if(inglese()){ document.documentElement.lang = "en"; traduciDOM(document.body); traduciLink(document.body); }
avviaBadgeLingua(rotta.path);
if(cached && Date.now() - cached.t < 3 * 3600e3){ state.wx = cached.wx; state.updated = new Date(cached.t); Object.values(state.wx).forEach(d => d && correctHourly(d.hourly)); }
route();
loadAll();
setInterval(() => { if(document.visibilityState === "visible") loadAll(); }, 30 * 60e3);
