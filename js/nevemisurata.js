/* =========================================================
   NEVE MISURATA — stazioni vicine, navigabile giorno per giorno fino a 14 giorni indietro
   - vista giornaliera: neve al suolo, neve fresca 24h, temperatura min/max, vento medio/massimo
   - vista oraria del giorno scelto (stessi dati ora per ora)
   - piccolo grafico dell'altezza neve sui 14 giorni per ogni stazione
   - frecce ◀ ▶, scorrimento col dito, chip per saltare, "Oggi"; oltre 14 giorni non si va
   - lo storico delle stazioni si scarica quando la tabella arriva sullo schermo (o al primo tocco), non all'apertura
   ========================================================= */
import { state, esc, r0, r1 } from "./state.js";
import { STATIONS_MAX_KM } from "./config.js";
import { stationsFor } from "./stazioni.js";
import { GIORNI_STORICO, daColonne, caricaStorico, percorsoStazione, giornoRoma, etichettaGiorno, aggiungiGiorni, riassuntoGiorno, andamentoNeve, oreDelGiorno } from "./storico.js";
import { inUnita, etichettaUnita, ventoIcona } from "./vento.js";

const memoria = {};
const mem = id => memoria[id] || (memoria[id] = {giorno: 0, vista: "giorno", serie: {}, stato: "no"});
const CHIP = [["Oggi", 0], ["Ieri", -1], ["-3g", -3], ["-7g", -7], ["-14g", -14]];
const ND = `<span class="nd" title="Dato non disponibile">—</span>`;
const v = (x, f) => x == null || !isFinite(x) ? ND : f(x);
const oggi = () => giornoRoma(Date.now());

function credits(st){
  const c = [];
  if(st.some(s => s.operator !== "ARPAV")) c.push("Meteo Alto Adige e Meteotrentino via avalanche.report");
  if(st.some(s => s.operator === "ARPAV")) c.push("ARPAV Veneto (dati in tempo reale non validati, CC BY 4.0)");
  return c.join("; ");
}

export function neveMisurataHTML(spot){
  const st = stationsFor(spot);
  if(!st.length){
    return `<p class="note" style="margin:0">${state.stations && state.stations.length
      ? (spot.area === "Friuli VG"
        ? `Nessuna stazione con dati aperti entro ${STATIONS_MAX_KM} km. Le stazioni del Friuli Venezia Giulia verranno aggiunte appena disponibili.`
        : `Nessuna stazione nivometrica entro ${STATIONS_MAX_KM} km.`)
      : "Dati delle stazioni non disponibili al momento."}</p>`;
  }
  const m = mem(spot.id);
  return `<div class="nm" data-nm="${esc(spot.id)}">
    <div class="oo-bar">
      <button type="button" class="oo-fr" data-nm-sposta="-1" aria-label="Giorno prima">◀</button>
      <div class="oo-giorno" aria-live="polite"><b></b><span class="oo-tipo"></span></div>
      <button type="button" class="oo-fr" data-nm-sposta="1" aria-label="Giorno dopo">▶</button>
    </div>
    <div class="oo-chip" role="group" aria-label="Vai al giorno">${CHIP.map(([n, g]) => `<button type="button" data-nm-giorno="${g}">${n}</button>`).join("")}</div>
    <div class="nm-vista seg2" role="group" aria-label="Dettaglio"><button type="button" data-nm-vista="giorno" class="${m.vista === "giorno" ? "on" : ""}" aria-pressed="${m.vista === "giorno"}">Giorno</button><button type="button" data-nm-vista="ore" class="${m.vista === "ore" ? "on" : ""}" aria-pressed="${m.vista === "ore"}">Ora per ora</button></div>
    <div class="nm-corpo"></div>
    <p class="small" style="margin:8px 0 0">Misure delle stazioni automatiche: ${credits(st)}. Neve fresca 24h = aumento dell'altezza neve rispetto alla fine del giorno prima (con assestamento o vento può differire dalla neve caduta). "—" = dato non disponibile.</p>
  </div>`;
}

/* piccolo grafico dell'altezza neve (14 giorni) con il giorno scelto evidenziato */
function sparkline(punti, scelto){
  const W = 112, H = 30, val = punti.map(p => p.hs).filter(x => x != null);
  if(val.length < 2) return `<span class="nm-sp nm-sp-vuoto" title="Andamento non disponibile">andamento n.d.</span>`;
  const lo = Math.min(...val), hi = Math.max(...val, lo + 10), n = punti.length;
  const x = i => 2 + (W - 4) * i / (n - 1), y = hs => H - 3 - (H - 6) * (hs - lo) / (hi - lo);
  let d = "", su = false;
  punti.forEach((p, i) => { if(p.hs == null){ su = false; return; } d += `${su ? "L" : "M"}${x(i).toFixed(1)},${y(p.hs).toFixed(1)}`; su = true; });
  const k = punti.findIndex(p => p.giorno === scelto);
  const ultimo = [...punti].reverse().find(p => p.hs != null);
  return `<svg class="nm-sp" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Altezza neve negli ultimi ${GIORNI_STORICO} giorni: da ${r0(punti.find(p => p.hs != null).hs)} a ${r0(ultimo.hs)} cm">
    <path d="${d}" class="nm-sl"/>${k >= 0 ? `<line x1="${x(k)}" x2="${x(k)}" y1="1" y2="${H - 1}" class="nm-sk"/>${punti[k].hs != null ? `<circle cx="${x(k)}" cy="${y(punti[k].hs)}" r="2.6" class="nm-sc"/>` : ""}` : ""}</svg>`;
}

function giornoHTML(spot, st, m, g){
  const caricato = m.stato === "ok" || m.stato === "parziale";
  return `<div class="st-wrap"><table class="st nm-t">
    <thead><tr><th class="l">Stazione · ${GIORNI_STORICO} giorni</th><th>Neve al suolo</th><th>Fresca 24h</th><th>Temp. min / max</th><th>Vento med / max</th></tr></thead>
    <tbody>${st.map(s => {
      const serie = m.serie[s.id];
      let r;
      if(serie && serie.size) r = riassuntoGiorno(serie, g);
      else if(g === oggi()) r = {hs: s.hs, nuova: s.d24 != null ? Math.max(0, s.d24) : null, tmin: s.lt, tmax: s.lt, wmed: s.vw, wmax: s.vwmax, ora: true};
      else r = {};
      const sp = serie && serie.size ? sparkline(andamentoNeve(serie, oggi()), g) : caricato ? `<span class="nm-sp nm-sp-vuoto" title="Dato non disponibile">andamento n.d.</span>` : `<span class="nm-sp nm-sp-vuoto">…</span>`;
      const temp = r.tmin == null ? ND : r.ora || r.tmin === r.tmax ? `${r1(r.tmin)}°` : `${r1(r.tmin)}° / ${r1(r.tmax)}°`;
      const vento = r.wmed == null && r.wmax == null ? ND : `${v(r.wmed, x => inUnita(x))} / ${v(r.wmax, x => inUnita(x))} <small>${etichettaUnita()}</small>`;
      return `<tr data-st="${esc(s.id)}">
        <td class="l"><b>${esc(s.name)}</b><span>${s.elev != null ? r0(s.elev).toLocaleString("it-IT") + " m" : ""} · ${r0(s.km)} km</span>${sp}</td>
        <td class="hs" data-l="Al suolo">${v(r.hs, x => r0(x) + " cm")}</td>
        <td class="${(r.nuova || 0) >= 1 ? "up" : ""}" data-l="Fresca 24h">${v(r.nuova, x => x >= 0.5 ? "+" + r0(x) + " cm" : "0")}</td>
        <td data-l="Temp. min / max">${temp}</td>
        <td data-l="Vento med / max">${vento}</td></tr>`;
    }).join("")}</tbody></table></div>`;
}

function oreHTML(spot, st, m, g){
  return st.map(s => {
    const serie = m.serie[s.id];
    if(!serie || !serie.size) return `<div class="nm-ore"><h4 class="nm-h">${esc(s.name)} <span>${s.elev != null ? r0(s.elev) + " m" : ""}</span></h4><p class="note" style="margin:0">${m.stato === "carico" || m.stato === "no" ? "Carico i dati orari…" : "Dati orari non disponibili per questa stazione."}</p></div>`;
    const ore = oreDelGiorno(serie, g);
    const riga = (nome, f) => `<tr><th class="l">${nome}</th>${ore.map(o => `<td>${o.r ? f(o.r) : ND}</td>`).join("")}</tr>`;
    return `<div class="nm-ore"><h4 class="nm-h">${esc(s.name)} <span>${s.elev != null ? r0(s.elev) + " m" : ""}</span></h4>
      <div class="st-wrap"><table class="st nm-oret">
        <thead><tr><th class="l">Ora</th>${ore.map(o => `<th>${o.ora}</th>`).join("")}</tr></thead>
        <tbody>${riga("Neve cm", r => v(r.hs, x => r0(x)))}${riga("Temp. °C", r => v(r.t, x => r1(x)))}${riga(`Vento ${etichettaUnita()}`, r => r.w == null ? ND : ventoIcona(r.w, r.d, "cella", {nome: false}))}${riga("Max", r => v(r.wx, x => inUnita(x)))}</tbody>
      </table></div></div>`;
  }).join("");
}

export function avviaNeveMisurata(spot, root){
  const box = root && root.querySelector(`[data-nm="${spot.id}"]`);
  if(!box) return;
  const m = mem(spot.id), st = stationsFor(spot), corpo = box.querySelector(".nm-corpo");
  const giorno = () => aggiungiGiorni(oggi(), m.giorno);
  const disegna = () => {
    const g = giorno();
    box.querySelector(".oo-giorno b").textContent = etichettaGiorno(g);
    box.querySelector(".oo-tipo").textContent = m.giorno === 0 ? "Oggi" : m.giorno === -1 ? "Ieri" : `${-m.giorno} giorni fa`;
    box.querySelector('[data-nm-sposta="-1"]').disabled = m.giorno <= -GIORNI_STORICO;
    box.querySelector('[data-nm-sposta="1"]').disabled = m.giorno >= 0;
    box.querySelectorAll("[data-nm-giorno]").forEach(b => b.classList.toggle("on", +b.dataset.nmGiorno === m.giorno));
    box.querySelectorAll("[data-nm-vista]").forEach(b => { const on = b.dataset.nmVista === m.vista; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    corpo.innerHTML = m.vista === "ore" ? oreHTML(spot, st, m, g) : giornoHTML(spot, st, m, g);
  };
  const carica = async () => {
    if(m.stato !== "no") return;
    m.stato = "carico";
    const res = await Promise.all(st.map(s => caricaStorico(percorsoStazione(s.id))));
    let ok = 0;
    st.forEach((s, i) => { if(res[i]){ m.serie[s.id] = daColonne(res[i]); ok++; } });
    m.stato = ok === st.length ? "ok" : ok ? "parziale" : "assente";
    if(box.isConnected) disegna();
  };
  const vai = n => { m.giorno = Math.max(-GIORNI_STORICO, Math.min(0, n)); disegna(); if(m.giorno !== 0 || m.vista === "ore") carica(); };
  disegna();
  // si scarica quando la tabella arriva sullo schermo
  if(m.stato === "no"){
    if(typeof IntersectionObserver !== "undefined"){
      const io = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting)){ io.disconnect(); carica(); } }, {rootMargin: "200px"});
      io.observe(box);
    }else carica();
  }
  box.addEventListener("click", e => {
    const sp = e.target.closest("[data-nm-sposta]"); if(sp) return vai(m.giorno + +sp.dataset.nmSposta);
    const gg = e.target.closest("[data-nm-giorno]"); if(gg) return vai(+gg.dataset.nmGiorno);
    const vv = e.target.closest("[data-nm-vista]"); if(vv){ m.vista = vv.dataset.nmVista; vai(m.giorno); }
  });
  // scorrimento col dito sulla tabella giornaliera: giorno prima / dopo
  let x0 = null, y0 = 0;
  corpo.addEventListener("touchstart", e => { if(m.vista !== "giorno") return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, {passive: true});
  corpo.addEventListener("touchend", e => {
    if(x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if(Math.abs(dx) > 60 && Math.abs(dy) < 40) vai(m.giorno + (dx > 0 ? -1 : 1));
  }, {passive: true});
}
export const azzeraNeveMisurata = () => { for(const k in memoria) delete memoria[k]; };
