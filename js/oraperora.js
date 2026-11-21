/* =========================================================
   ORA PER ORA — timeline continua: fino a 14 giorni indietro + le ore già previste
   - all'apertura è centrata su "Adesso" (linea verticale ben visibile)
   - ore passate = stima oraria registrata ogni ora dal robot; ore future = previsione (sfondo a righe)
   - per ogni ora: temperatura, vento in quota (intensità, direzione) con raffiche, neve caduta, neve al suolo
   - si scorre con il dito, con la rotella/trackpad o trascinando; frecce ◀ ▶ = un giorno; chip per saltare
   - lo storico (oltre le ultime 72 ore) si scarica solo quando si comincia ad andare indietro
   ========================================================= */
import { state, esc, r0, r1 } from "./state.js";
import { t } from "./i18n.js";
import { ORA, GIORNI_STORICO, oraPiena, oreDaMeteo, daColonne, caricaStorico, percorsoSpot, romaLocale, giornoRoma, etichettaGiorno, aggiungiGiorni, msDaRoma } from "./storico.js";
import { ventoIcona, inUnita, etichettaUnita, livello } from "./vento.js";

const memoria = {};   // per spot: {storico: Map|null, stato: "no"|"carico"|"ok"|"assente", centro: istante al centro}
const mem = id => memoria[id] || (memoria[id] = {storico: null, stato: "no", centro: null, scelto: null});
const desktop = () => typeof matchMedia !== "undefined" && matchMedia("(min-width: 960px)").matches;
const PX = () => desktop() ? 14 : 12;          // larghezza di un'ora
const ALT = () => desktop() ? 250 : 220;
const CHIP = [["Oggi", 0], ["Ieri", -1], ["-3g", -3], ["-7g", -7], ["-14g", -14]];
const chip = n => t(n);

/* contenitore: si riempie con avviaOraPerOra() dopo che la pagina è nel DOM */
export function oraPerOraHTML(spot){
  return `<div class="oo" data-oo="${esc(spot.id)}">
    <div class="oo-bar">
      <button type="button" class="oo-fr" data-oo-sposta="-1" aria-label="${t("Giorno prima")}">◀</button>
      <div class="oo-giorno" aria-live="polite"><b>—</b><span class="oo-tipo"></span></div>
      <button type="button" class="oo-fr" data-oo-sposta="1" aria-label="${t("Giorno dopo")}">▶</button>
    </div>
    <div class="oo-chip" role="group" aria-label="${t("Vai al giorno")}">${CHIP.map(([n, g]) => `<button type="button" data-oo-giorno="${g}">${chip(n)}</button>`).join("")}<button type="button" class="oo-adesso" data-oo-adesso>${t("Torna ad adesso")}</button></div>
    <div class="oo-lettura" aria-live="polite"></div>
    <div class="oo-area"><div class="oo-scorri" tabindex="0" aria-label="${t("Grafico ora per ora: scorri a destra e a sinistra")}"></div>
      <div class="oo-asse oo-asse-s"></div><div class="oo-asse oo-asse-d"></div></div>
    <div class="legend oo-leg"><span><i style="background:var(--c-temp)"></i>${t("Temperatura")}</span><span><i style="background:var(--c-vento)"></i>${t("Vento in quota")}</span><span><i style="background:#0ea5e9"></i>${t("Neve caduta (cm/h)")}</span><span><i style="background:var(--c-hs)"></i>${t("Neve al suolo")}</span><span><i class="oo-l-prev"></i>${t("Previsto")}</span><span><i class="oo-l-buco"></i>${t("Dato mancante")}</span></div>
    <p class="small oo-nota"></p>
  </div>`;
}

/* tutte le ore della timeline: [{t, r, prev}] */
function ore(spot){
  const m = mem(spot.id), adesso = oraPiena(Date.now());
  const H = state.wx[spot.id] && state.wx[spot.id].hourly;
  const mappa = new Map();
  if(m.storico) for(const [t, r] of m.storico) mappa.set(t, r);
  for(const [t, r] of oreDaMeteo(H)) mappa.set(t, r);       // meteo dell'ultimo giro: vince sulle ore registrate
  if(!mappa.size) return {lista: [], adesso, inizio: adesso};
  const ks = [...mappa.keys()];
  const minimo = adesso - GIORNI_STORICO * 24 * ORA;
  const inizio = m.stato === "ok" ? minimo : Math.max(minimo, Math.min(...ks)), fine = Math.max(...ks);
  const lista = [];
  for(let t = inizio; t <= fine; t += ORA) lista.push({t, r: mappa.get(t) || null, prev: t > adesso});
  return {lista, adesso, inizio};
}

const scala = (vals, lo, hi) => { const v = vals.filter(x => x != null && isFinite(x)); return v.length ? [Math.min(lo, ...v), Math.max(hi, ...v)] : [lo, hi]; };
/* linea spezzata dove manca il dato */
function linea(lista, k, x, y){
  let d = "", su = false;
  lista.forEach((o, i) => { const v = o.r && o.r[k]; if(v == null){ su = false; return; } d += `${su ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; su = true; });
  return d;
}

function svg(spot, dati){
  const {lista, adesso} = dati, px = PX(), W = lista.length * px, H = ALT();
  const top = 30, bot = H - 26, alto = bot - top;
  const x = i => i * px + px / 2;
  const [tmin, tmax] = scala(lista.map(o => o.r && o.r.t), -5, 5);
  const ty = v => top + alto * (1 - (v - (tmin - 2)) / (tmax - tmin + 4));
  const smax = Math.max(2, ...lista.map(o => (o.r && o.r.n) || 0));
  const hmax = Math.max(20, ...lista.map(o => (o.r && o.r.hs) || 0)) * 1.15;
  const wmax = Math.max(60, ...lista.map(o => (o.r && Math.max(o.r.w || 0, o.r.g || 0)) || 0));
  const id = "oo-" + spot.id;
  let fondo = "", griglia = "", barre = "", buchi = "", frecce = "";
  // previsione: sfondo a righe
  const iNow = lista.findIndex(o => o.t === adesso);
  if(iNow >= 0) fondo += `<rect x="${(iNow + 1) * px}" y="${top - 4}" width="${W - (iNow + 1) * px}" height="${bot - top + 4}" fill="url(#${id}-r)" class="oo-prev"/>`;
  // dati mancanti nel passato: fasce grigie unite
  for(let i = 0; i < lista.length; i++){
    if(lista[i].r || lista[i].prev) continue;
    let j = i; while(j + 1 < lista.length && !lista[j + 1].r && !lista[j + 1].prev) j++;
    buchi += `<rect class="oo-buco" x="${i * px}" y="${top - 4}" width="${(j - i + 1) * px}" height="${bot - top + 4}"><title>${t("Dato non disponibile")}</title></rect>`;
    i = j;
  }
  lista.forEach((o, i) => {
    const loc = romaLocale(o.t), h = loc.slice(11, 13);
    if(h === "00") griglia += `<line x1="${i * px}" x2="${i * px}" y1="${top - 4}" y2="${bot}" class="oo-g0"/><text x="${i * px + 3}" y="${H - 9}" class="oo-tx oo-gl">${esc(etichettaGiorno(loc.slice(0, 10)))}</text>`;
    else if(h === "12") griglia += `<line x1="${i * px}" x2="${i * px}" y1="${top}" y2="${bot}" class="oo-g12"/><text x="${i * px + 2}" y="${H - 9}" class="oo-tx">12</text>`;
    else if(h === "06" || h === "18") griglia += `<text x="${i * px + 2}" y="${H - 9}" class="oo-tx oo-tx2">${h}</text>`;
    const r = o.r; if(!r) return;
    if(r.n > 0){ const hh = alto * 0.55 * r.n / smax; barre += `<rect x="${i * px + 1}" y="${bot - hh}" width="${px - 2}" height="${hh}" rx="1.5" class="oo-n"/>`; }
    if(r.w != null && h % 3 === 0){
      const l = livello(r.w);
      frecce += `<g transform="translate(${x(i)},13)"><g class="vw ${l.cls}"><circle r="8.5" class="oo-fc"/>${r.d != null && r.w >= 5 ? `<path d="M0,-6 L4,2 L1.2,1.2 L1.2,6 L-1.2,6 L-1.2,1.2 L-4,2 Z" transform="rotate(${Math.round((r.d + 180) % 360)})" class="oo-fa"/>` : `<circle r="2"/>`}</g></g>`;
    }
  });
  const hsPath = linea(lista, "hs", x, v => bot - alto * v / hmax);
  const hsArea = hsPath ? hsPath.replace(/M([\d.]+),/g, (s, a) => `M${a},${bot} L${a},`) : "";
  const nowX = iNow >= 0 ? x(iNow) : null;
  const zeroY = ty(0);
  return {W, H, html: `<svg class="oo-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("Ora per ora di {spot}: temperatura, vento, neve caduta e neve al suolo, {n} ore", {spot: spot.name, n: lista.length}))}">
    <defs><pattern id="${id}-r" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" class="oo-r0"/><line x1="0" y1="0" x2="0" y2="8" class="oo-r1"/></pattern></defs>
    ${fondo}${buchi}${griglia}
    ${zeroY > top && zeroY < bot ? `<line x1="0" x2="${W}" y1="${zeroY}" y2="${zeroY}" class="oo-zero"/>` : ""}
    ${hsArea ? `<path d="${hsArea}" class="oo-hs"/>` : ""}${barre}
    <path d="${linea(lista, "g", x, v => bot - alto * v / wmax)}" class="oo-g"/>
    <path d="${linea(lista, "w", x, v => bot - alto * v / wmax)}" class="oo-w"/>
    <path d="${linea(lista, "t", x, ty)}" class="oo-t"/>
    ${frecce}
    ${nowX != null ? `<line x1="${nowX}" x2="${nowX}" y1="2" y2="${bot}" class="oo-now"/><rect x="${nowX - 27}" y="${bot - 2}" width="54" height="17" rx="8.5" class="oo-nowp"/><text x="${nowX}" y="${bot + 10}" text-anchor="middle" class="oo-nowt">${t("Adesso")}</text>` : ""}
    <line class="oo-cur" x1="-10" x2="-10" y1="${top - 4}" y2="${bot}"/>
  </svg>`, assi: {tmin: tmin - 2, tmax: tmax + 2, hmax, wmax}};
}

function lettura(o, adesso){
  if(!o) return "";
  const loc = romaLocale(o.t), r = o.r || {};
  const tipo = o.prev ? `<span class="oo-pv">${t("Previsto")}</span>` : o.t === adesso ? `<span class="oo-ad">${t("Adesso")}</span>` : `<span class="oo-rg">${t("Registrato")}</span>`;
  const nd = `<span class="oo-nd" title="${t("Dato non disponibile")}">—</span>`;
  return `<div class="oo-lt"><b>${esc(etichettaGiorno(loc.slice(0, 10)))}, ${loc.slice(11, 16)}</b>${tipo}</div>
    <div class="oo-lv">
      <div><span>${t("Temp.")}</span><b>${r.t != null ? r1(r.t) + "°" : nd}</b></div>
      <div><span>${t("Neve caduta")}</span><b>${r.n != null ? r1(r.n) + " cm" : nd}</b></div>
      <div><span>${t("Al suolo")}</span><b>${r.hs != null ? r0(r.hs) + " cm" : nd}</b></div>
      <div class="oo-lw"><span>${t("Vento in quota")}</span>${r.w != null ? ventoIcona(r.w, r.d, "mini") : nd}${r.g != null ? `<em>${t("raffiche")} ${inUnita(r.g)} ${etichettaUnita()}</em>` : ""}</div>
    </div>`;
}

/* ---------- comportamento ---------- */
export function avviaOraPerOra(spot, root){
  const box = root && root.querySelector(`[data-oo="${spot.id}"]`);
  if(!box) return;
  const m = mem(spot.id), sc = box.querySelector(".oo-scorri");
  let dati, px;
  const centro = () => dati.inizio + ((sc.scrollLeft + sc.clientWidth / 2) / px) * ORA;
  const vaiA = (t, liscio) => { const left = (t - dati.inizio) / ORA * px - sc.clientWidth / 2; sc.scrollTo({left: Math.max(0, left), behavior: liscio ? "smooth" : "auto"}); };
  const nota = box.querySelector(".oo-nota");
  const disegna = () => {
    dati = ore(spot); px = PX();
    if(!dati.lista.length){ sc.innerHTML = `<p class="note" style="padding:12px">${t("Dati orari non disponibili.")}</p>`; return false; }
    const g = svg(spot, dati);
    sc.innerHTML = g.html;
    box.querySelector(".oo-asse-s").innerHTML = `<span>${Math.round(g.assi.tmax)}°</span><span>${Math.round(g.assi.tmin)}°</span>`;
    box.querySelector(".oo-asse-d").innerHTML = `<span>${Math.round(g.assi.hmax)} cm</span><span>${t("vento")} 0–${inUnita(g.assi.wmax)}</span>`;
    nota.innerHTML = m.stato === "assente" ? t("Lo storico dei giorni passati non è ancora disponibile: si riempie da solo, un'ora alla volta.") :
      t("Passato = stima oraria registrata ogni ora per la quota dello spot (non è una misura: le misure vere sono in \"Neve misurata\"). Sfondo a righe = previsione. Tocca il grafico per leggere i valori di un'ora.");
    return true;
  };
  const aggiorna = () => {
    if(!dati || !dati.lista.length) return;
    const c = centro(), g = giornoRoma(c), oggi = giornoRoma(dati.adesso);
    box.querySelector(".oo-giorno b").textContent = etichettaGiorno(g);
    box.querySelector(".oo-tipo").textContent = c > dati.adesso + ORA ? t("Previsto") : g === oggi ? t("Oggi") : t("Registrato");
    const limite = m.stato === "ok" || m.stato === "assente";
    box.querySelector('[data-oo-sposta="-1"]').disabled = limite && sc.scrollLeft <= 2;
    box.querySelector('[data-oo-sposta="1"]').disabled = sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 2;
    box.querySelector("[data-oo-adesso]").classList.toggle("on", Math.abs(c - dati.adesso) > 6 * ORA);
    box.querySelectorAll("[data-oo-giorno]").forEach(b => b.classList.toggle("on", aggiungiGiorni(oggi, +b.dataset.ooGiorno) === g));
    m.centro = c;
    if(m.scelto == null) mostra(dati.lista.findIndex(o => o.t === dati.adesso));
  };
  const mostra = i => {
    const o = dati.lista[i]; if(!o) return;
    box.querySelector(".oo-lettura").innerHTML = lettura(o, dati.adesso);
    const cur = sc.querySelector(".oo-cur"); if(cur){ cur.setAttribute("x1", i * px + px / 2); cur.setAttribute("x2", i * px + px / 2); }
  };
  /* storico: si scarica solo quando si va indietro */
  const carica = async () => {
    if(m.stato === "ok" || m.stato === "assente" || m.stato === "carico") return;
    m.stato = "carico"; box.classList.add("oo-carica");
    const j = await caricaStorico(percorsoSpot(spot.id));
    box.classList.remove("oo-carica");
    m.storico = j ? daColonne(j) : null;
    m.stato = j ? "ok" : "assente";
    const c = centro();
    disegna(); vaiA(c); aggiorna();
  };
  const indietro = () => { if(sc.scrollLeft < 24 * px && m.stato === "no") carica(); };

  if(!disegna()) return;
  vaiA(m.centro || dati.adesso);
  aggiorna();
  if(m.scelto != null){ const i = dati.lista.findIndex(o => o.t === m.scelto); if(i >= 0) mostra(i); }
  let pending = 0;
  sc.addEventListener("scroll", () => { if(!pending) pending = requestAnimationFrame(() => { pending = 0; aggiorna(); indietro(); }); }, {passive: true});
  box.addEventListener("click", async e => {
    const sp = e.target.closest("[data-oo-sposta]");
    if(sp){
      const dir = +sp.dataset.ooSposta;
      if(dir < 0 && sc.scrollLeft <= 24 * px && m.stato === "no") await carica();
      vaiA(centro() + dir * 24 * ORA); aggiorna(); return;
    }
    const gg = e.target.closest("[data-oo-giorno]");
    if(gg){
      const n = +gg.dataset.ooGiorno;
      if(n < -2) await carica();
      const oggi = giornoRoma(dati.adesso);
      const t = n === 0 ? dati.adesso : Math.max(dati.inizio + sc.clientWidth / 2 / px * ORA, msDaRoma(aggiungiGiorni(oggi, n) + "T12:00"));
      vaiA(t); aggiorna(); return;
    }
    if(e.target.closest("[data-oo-adesso]")){ m.scelto = null; vaiA(dati.adesso); aggiorna(); mostra(dati.lista.findIndex(o => o.t === dati.adesso)); return; }
  });
  // tocco o clic sul grafico: legge i valori di quell'ora
  sc.addEventListener("click", e => {
    if(trascinato) return;
    const r = sc.getBoundingClientRect(), i = Math.floor((e.clientX - r.left + sc.scrollLeft) / px);
    if(dati.lista[i]){ m.scelto = dati.lista[i].t; mostra(i); }
  });
  // computer: rotella verticale → scorre il grafico (ai bordi lascia scorrere la pagina); trascinamento col mouse
  sc.addEventListener("wheel", e => {
    if(Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const prima = sc.scrollLeft;
    sc.scrollLeft += e.deltaY;
    if(sc.scrollLeft !== prima) e.preventDefault();
  }, {passive: false});
  let giu = null, trascinato = false;
  sc.addEventListener("pointerdown", e => { if(e.pointerType !== "mouse" || e.button !== 0) return; giu = {x: e.clientX, l: sc.scrollLeft, id: e.pointerId}; trascinato = false; });
  sc.addEventListener("pointermove", e => {
    if(!giu) return;
    const dx = e.clientX - giu.x;
    if(!trascinato && Math.abs(dx) > 4){ trascinato = true; sc.classList.add("oo-tira"); try{ sc.setPointerCapture(giu.id); }catch(x){} }
    if(trascinato) sc.scrollLeft = giu.l - dx;
  });
  const lascia = () => { if(giu){ giu = null; sc.classList.remove("oo-tira"); setTimeout(() => trascinato = false, 0); } };
  sc.addEventListener("pointerup", lascia); sc.addEventListener("pointercancel", lascia);
  sc.addEventListener("keydown", e => {
    if(e.key === "ArrowLeft" || e.key === "ArrowRight"){ e.preventDefault(); sc.scrollBy({left: (e.key === "ArrowLeft" ? -3 : 3) * px}); }
  });
}
/* per i test: dimentica storico e posizione */
export const azzeraOraPerOra = () => { for(const k in memoria) delete memoria[k]; };
