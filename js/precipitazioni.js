/* =========================================================
   PAGINA "ANIMAZIONE PRECIPITAZIONI" — mappa animata ora per ora
   - si apre subito sulla mappa, i dati arrivano dopo (file unico, poi tutte le ore restano in memoria)
   - livello colorato: neve (blu/viola), mista (rosa), pioggia (verde/giallo), interpolato e morbido
   - "Mostra limite neve": linea bianca tratteggiata dove la precipitazione passa da neve a pioggia
   - spot sulla mappa: toccandoli si legge la precipitazione di quell'ora e si apre lo spot
   - play/pausa, ◀ ▶, barra del tempo, velocità, dissolvenza disattivabile; tastiera: ← → e spazio
   - ?spot=<id> apre la mappa centrata e zoomata sullo spot
   ========================================================= */
import { SPOTS } from "./config.js";
import { RIQUADRO, valoreIn, colore, lineaNeve, indiceAdesso, tipoDa, SOGLIE, SCALE } from "./precip-dati.js";
import { creaMappa } from "./mappa.js";
import { romaLocale, etichettaGiorno } from "./storico.js";
import "./menu.js";
import { t as tr, loc, url as u } from "./i18n.js";

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const LS = {get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } }, set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }};
const VELOCITA = {lenta: 1100, normale: 650, veloce: 320};
const VECCHIO_ORE = 9;
const RIDUCI = 4;                       // il livello si calcola 1 punto ogni 4 px e si allarga morbido

const S = {
  dati: null, k: 0, kAdesso: 0, play: null,
  velocita: LS.get("fr_pc_vel", "normale"),
  limite: LS.get("fr_pc_limite", true),
  dissolvenza: LS.get("fr_pc_diss", !(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)),
  scelto: null, mappa: null
};

/* ---------- avvio: prima la mappa, poi i dati ---------- */
const box = $("#pcMappa");
const parSpot = new URLSearchParams(location.search).get("spot");
const spotIniz = SPOTS.find(s => s.id === parSpot) || null;
S.mappa = creaMappa(box, {limiti: {lat0: RIQUADRO.lat0 - 0.3, lat1: RIQUADRO.lat1 + 0.3, lon0: RIQUADRO.lon0 - 0.3, lon1: RIQUADRO.lon1 + 0.3}});
if(spotIniz){ S.mappa.vai(spotIniz.lat, spotIniz.lon, 10); S.scelto = spotIniz.id; }
else S.mappa.adatta(RIQUADRO);
box.dataset.centro = spotIniz ? spotIniz.id : "tutto";

const sopra = S.mappa.sopra;
sopra.innerHTML = `<canvas class="pc-cv on" aria-hidden="true"></canvas><canvas class="pc-cv" aria-hidden="true"></canvas>
  <svg class="pc-linea" aria-hidden="true"></svg><div class="pc-spot"></div><div class="pc-pop" hidden></div>
  <details class="pc-leg mp-no" ${matchMedia("(min-width: 700px)").matches ? "open" : ""}><summary>${tr("Legenda")}</summary>${legendaHTML()}</details>`;
const [cvA, cvB] = sopra.querySelectorAll(".pc-cv");
let attivo = cvA;

function legendaHTML(){
  const riga = (tipo, nome) => `<div class="pc-lr"><span class="pc-ln">${nome}</span>${SCALE[tipo].map(c => `<i style="background:rgb(${c.join(",")})"></i>`).join("")}</div>`;
  return `<div class="pc-legc">${riga("neve", tr("Neve"))}${riga("mista", tr("Mista"))}${riga("pioggia", tr("Pioggia"))}
    <div class="pc-lr pc-ls"><span class="pc-ln">mm/h</span>${SOGLIE.map(s => `<b>${s.toLocaleString(loc())}</b>`).join("")}</div>
    <div class="pc-lr pc-lline"><span class="pc-ln"></span><svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4"/></svg> ${tr("limite neve")}</div></div>`;
}

/* ---------- disegno di un'ora ---------- */
function disegnaLivello(cv, k){
  const d = S.dati, st = S.mappa.stato();
  const w = Math.max(1, Math.ceil(st.w / RIDUCI)), h = Math.max(1, Math.ceil(st.h / RIDUCI));
  if(cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
  const ctx = cv.getContext("2d"), img = ctx.createImageData(w, h), px = img.data;
  for(let y = 0; y < h; y++){
    const [lat] = S.mappa.geo(0, y * RIDUCI + RIDUCI / 2);
    for(let x = 0; x < w; x++){
      const [, lon] = S.mappa.geo(x * RIDUCI + RIDUCI / 2, 0);
      const v = valoreIn(d, k, lat, lon);
      const c = v && colore(v.mm, v.neve);
      if(!c) continue;
      const i = (y * w + x) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
    }
  }
  ctx.putImageData(img, 0, 0);
}
function disegnaLinea(k){
  const svg = sopra.querySelector(".pc-linea"), st = S.mappa.stato();
  svg.setAttribute("viewBox", `0 0 ${st.w} ${st.h}`);
  if(!S.limite || !S.dati){ svg.innerHTML = ""; return; }
  const d = lineaNeve(S.dati, k).map(([a, b]) => { const p = S.mappa.px(a.lat, a.lon), q = S.mappa.px(b.lat, b.lon); return `M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`; }).join("");
  svg.innerHTML = d ? `<path d="${d}" class="pc-lb"/><path d="${d}" class="pc-lw"/>` : "";
}
function disegnaSpot(){
  const st = S.mappa.stato(), z = S.mappa.zoom();
  sopra.querySelector(".pc-spot").innerHTML = SPOTS.map(s => {
    const [x, y] = S.mappa.px(s.lat, s.lon);
    if(x < -20 || y < -20 || x > st.w + 20 || y > st.h + 20) return "";
    return `<button type="button" class="pc-m ${S.scelto === s.id ? "on" : ""}" data-pcspot="${s.id}" style="transform:translate(${x.toFixed(0)}px,${y.toFixed(0)}px)" aria-label="${esc(s.name)}"><i></i>${z >= 9.5 ? `<span>${esc(s.name.split(" · ")[0])}</span>` : ""}</button>`;
  }).join("");
  popup();
}
function popup(){
  const el = sopra.querySelector(".pc-pop"), s = SPOTS.find(x => x.id === S.scelto);
  if(!s || !S.dati){ el.hidden = true; return; }
  const v = valoreIn(S.dati, S.k, s.lat, s.lon), [x, y] = S.mappa.px(s.lat, s.lon), st = S.mappa.stato();
  const testo = !v ? tr("Fuori dall'area dei dati") : v.mm < 0.1 ? tr("Niente precipitazioni") : `${v.mm.toLocaleString(loc(), {minimumFractionDigits: 1, maximumFractionDigits: 1})} mm/h · ${tr(tipoDa(v.neve))}`;
  el.hidden = false;
  el.innerHTML = `<b>${esc(s.name)}</b><span class="pc-pv">${testo}</span>${v && v.quotaNeve != null ? `<span>${tr("Quota neve circa {q} m", {q: v.quotaNeve.toLocaleString(loc())})}</span>` : ""}
    <a href="${u(`spot/${s.id}/`)}">${tr("Apri lo spot →")}</a><button type="button" class="pc-popx" data-pcchiudi aria-label="${tr("Chiudi")}">×</button>`;
  const left = Math.max(8, Math.min(st.w - 228, x - 110)), top = y > 150 ? y - 12 : y + 22;
  el.style.left = left + "px"; el.style.top = top + "px";
  el.classList.toggle("sotto", y <= 150);
}

let primo = true;
function mostra(k, conDissolvenza = false){
  if(!S.dati) return;
  S.k = Math.max(0, Math.min(S.dati.ore.length - 1, k));
  const usaB = conDissolvenza && S.dissolvenza;
  const cv = usaB ? (attivo === cvA ? cvB : cvA) : attivo;
  disegnaLivello(cv, S.k);
  if(usaB){ cv.classList.add("on"); attivo.classList.remove("on"); attivo = cv; }
  disegnaLinea(S.k);
  popup();
  aggiornaTempo();
  if(primo){ primo = false; box.dataset.pronta = "1"; try{ performance.mark("pc-primo-frame"); }catch(e){} }
}

/* ---------- timeline ---------- */
const slider = $("#pcSlider"), lab = $("#pcOra"), tipo = $("#pcTipo");
function aggiornaTempo(){
  const o = S.dati.ore[S.k], loc = romaLocale(Date.parse(o));
  lab.textContent = `${etichettaGiorno(loc.slice(0, 10))} · ${loc.slice(11, 16)}`;
  const t = S.k === S.kAdesso ? [tr("Adesso"), "ad"] : S.k < S.kAdesso ? [tr("Ore passate · modello"), "pa"] : [`${tr("Previsto")} · +${S.k - S.kAdesso} h`, "pv"];
  tipo.textContent = t[0]; tipo.className = "pc-tipo " + t[1];
  slider.value = S.k;
  slider.setAttribute("aria-valuetext", `${lab.textContent}, ${t[0]}`);
  $("#pcPrima").disabled = S.k <= 0; $("#pcDopo").disabled = S.k >= S.dati.ore.length - 1;
  $("#pcAdesso").hidden = S.k === S.kAdesso;
}
function play(on){
  if(on === undefined) on = !S.play;
  clearInterval(S.play); S.play = null;
  const b = $("#pcPlay");
  if(on && S.dati){
    if(S.k >= S.dati.ore.length - 1) mostra(S.kAdesso);
    S.play = setInterval(() => { mostra(S.k >= S.dati.ore.length - 1 ? S.kAdesso : S.k + 1, true); }, VELOCITA[S.velocita] || VELOCITA.normale);
  }
  b.setAttribute("aria-pressed", String(!!S.play));
  b.setAttribute("aria-label", S.play ? tr("Pausa") : tr("Avvia l'animazione"));
  b.innerHTML = S.play ? "❚❚" : "▶";
}
const passo = n => { play(false); mostra(S.k + n, true); };

$("#pcCtrl").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.id === "pcPlay") return play();
  if(b.id === "pcPrima") return passo(-1);
  if(b.id === "pcDopo") return passo(1);
  if(b.id === "pcAdesso"){ play(false); return mostra(S.kAdesso, true); }
  if(b.dataset.vel){ S.velocita = b.dataset.vel; LS.set("fr_pc_vel", S.velocita); impostaControlli(); if(S.play) play(true); }
});
slider.addEventListener("input", () => { play(false); mostra(+slider.value); });
$("#pcLimite").addEventListener("change", e => { S.limite = e.target.checked; LS.set("fr_pc_limite", S.limite); disegnaLinea(S.k); });
$("#pcDiss").addEventListener("change", e => { S.dissolvenza = e.target.checked; LS.set("fr_pc_diss", S.dissolvenza); box.classList.toggle("pc-nodiss", !S.dissolvenza); });
document.addEventListener("keydown", e => {
  if(!S.dati || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if(t.closest && t.closest("select, textarea, input:not([type=range]):not([type=checkbox])")) return;
  if(e.key === " " && !(t.closest && t.closest("button, summary, a"))){ e.preventDefault(); play(); }
  else if((e.key === "ArrowLeft" || e.key === "ArrowRight") && !(t.type === "range")){ e.preventDefault(); passo(e.key === "ArrowLeft" ? -1 : 1); }
});
function impostaControlli(){
  document.querySelectorAll("[data-vel]").forEach(b => { const on = b.dataset.vel === S.velocita; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  $("#pcLimite").checked = S.limite; $("#pcDiss").checked = S.dissolvenza;
  box.classList.toggle("pc-nodiss", !S.dissolvenza);
}
impostaControlli();

/* spot e popup */
sopra.addEventListener("click", e => {
  if(e.target.closest("[data-pcchiudi]")){ S.scelto = null; disegnaSpot(); return; }
  const m = e.target.closest("[data-pcspot]");
  if(m){ S.scelto = m.dataset.pcspot; disegnaSpot(); }
});
S.mappa.alMuovere(() => { disegnaSpot(); if(S.dati){ disegnaLivello(attivo, S.k); disegnaLinea(S.k); } });
disegnaSpot();

/* ---------- dati ---------- */
const stato = $("#pcStato");
function messaggio(testo, tipo = "info"){ stato.innerHTML = testo ? `<div class="banner ${tipo === "err" ? "err" : tipo === "warn" ? "demo" : "wip"}" role="status">${testo}</div>` : ""; }
const ora = iso => new Date(iso).toLocaleTimeString(loc(), {hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"});
async function carica(){
  messaggio(tr("Carico le precipitazioni…"));
  let d = null;
  try{
    const r = await fetch("./dati/precipitazioni/ultimo.json", {cache: "no-cache"});
    if(r.ok) d = await r.json();
  }catch(e){}
  if(!d || !Array.isArray(d.ore) || !d.ore.length || !d.griglia || !Array.isArray(d.p)){
    messaggio(tr("L'animazione non è ancora disponibile: i dati si generano ogni 3 ore. Riprova più tardi; nel frattempo trovi la previsione neve di ogni spot nelle loro pagine."), "err");
    $("#pcCtrl").classList.add("pc-off");
    box.dataset.pronta = "vuota";
    return;
  }
  S.dati = d;
  S.kAdesso = indiceAdesso(d.ore);
  const fine = Date.parse(d.ore[d.ore.length - 1]), eta = (Date.now() - Date.parse(d.generato)) / 3600e3;
  if(Date.now() > fine + 3600e3) messaggio(tr("Questi dati sono vecchi (scaricati {n} ore fa) e non coprono più l'ora attuale: li mostriamo comunque, ma non usarli per decidere.", {n: Math.round(eta)}), "warn");
  else if(eta > VECCHIO_ORE) messaggio(tr("Dati scaricati {n} ore fa: l'aggiornamento è in ritardo.", {n: Math.round(eta)}), "warn");
  else if(d.demo) messaggio(tr("Anteprima con dati dimostrativi: una volta pubblicato il sito mostra i dati veri."), "warn");
  else messaggio("");
  slider.max = d.ore.length - 1;
  slider.style.setProperty("--adesso", `${(S.kAdesso / Math.max(1, d.ore.length - 1) * 100).toFixed(1)}%`);
  $("#pcInfo").innerHTML = `${tr("Aggiornato alle {ora}", {ora: ora(d.generato)})}${d.corsa ? ` – ${tr("corsa del modello delle {h} UTC", {h: d.corsa.slice(11, 13)})}` : ""}. ${tr("Dati")}: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0) – ${tr("modello")} ${esc(d.etichetta || d.modello)}. ${tr("Le ore passate sono quelle calcolate dal modello, non osservazioni.")}`;
  $("#pcCtrl").classList.remove("pc-off");
  mostra(S.kAdesso);
}
// la pagina si mostra subito: i dati si chiedono appena il browser è libero
(window.requestIdleCallback || (f => setTimeout(f, 0)))(carica, {timeout: 300});
