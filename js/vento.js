/* =========================================================
   VENTO — un'unica icona con tre dati, ovunque nel sito:
   - nome del vento (rosa dei venti: Tramontana, Grecale, Levante, Scirocco, Ostro, Libeccio, Ponente, Maestrale)
   - direzione, con un vettore come su windguru: la freccia punta DOVE VA il vento
     (vento da nord = freccia verso il basso)
   - intensità: numero e colore della scala (debole, moderato, sostenuto, forte, molto forte)
   Unità a scelta: km/h o nodi (salvata sul telefono). I dati restano in km/h: si converte solo per mostrarli.
   Niente DOM qui: lo usano anche le pagine statiche e i test.
   ========================================================= */
import { state, esc } from "./state.js";

export const NODI = 1.852;                       // 1 nodo = 1,852 km/h
export const unita = () => state.ventoUnita === "kn" ? "kn" : "kmh";
export const etichettaUnita = (u = unita()) => u === "kn" ? "nodi" : "km/h";
export const inUnita = (kmh, u = unita()) => kmh == null || !isFinite(kmh) ? null : Math.round(u === "kn" ? kmh / NODI : kmh);
/* valore + unità, per i testi: "48 km/h" / "26 nodi" */
export const testoVento = (kmh, u = unita()) => kmh == null ? "–" : `${inUnita(kmh, u)} ${etichettaUnita(u)}`;

/* rosa dei venti a 8 settori (direzione DA CUI soffia il vento, in gradi) */
export const ROSA = [
  {k: "N", nome: "Tramontana", da: "nord"}, {k: "NE", nome: "Grecale", da: "nord-est"},
  {k: "E", nome: "Levante", da: "est"}, {k: "SE", nome: "Scirocco", da: "sud-est"},
  {k: "S", nome: "Ostro", da: "sud"}, {k: "SO", nome: "Libeccio", da: "sud-ovest"},
  {k: "O", nome: "Ponente", da: "ovest"}, {k: "NO", nome: "Maestrale", da: "nord-ovest"}
];
export const settore = dir => dir == null || !isFinite(dir) ? null : ROSA[Math.round((((dir % 360) + 360) % 360) / 45) % 8];

/* soglie in km/h, uguali per tutte le unità */
export const SCALA = [
  {min: 0, cls: "v0", nome: "calma"}, {min: 5, cls: "v1", nome: "debole"}, {min: 15, cls: "v2", nome: "moderato"},
  {min: 30, cls: "v3", nome: "sostenuto"}, {min: 50, cls: "v4", nome: "forte"}, {min: 70, cls: "v5", nome: "molto forte"}
];
export const livello = kmh => { let l = SCALA[0]; for(const x of SCALA) if((kmh || 0) >= x.min) l = x; return l; };

/* media vettoriale di direzioni (gradi), opzionalmente pesata */
export function mediaDirezioni(dirs, pesi){
  let u = 0, v = 0, n = 0;
  dirs.forEach((d, i) => { if(d == null || !isFinite(d)) return; const w = pesi ? (pesi[i] || 0) : 1, r = d * Math.PI / 180; u += Math.sin(r) * w; v += Math.cos(r) * w; n++; });
  if(!n || (Math.abs(u) < 1e-9 && Math.abs(v) < 1e-9)) return null;
  return (Math.atan2(u, v) * 180 / Math.PI + 360) % 360;
}

const FRECCIA = `<path d="M12 2.5 L18.5 13 L13.4 11.6 L13.4 21.5 L10.6 21.5 L10.6 11.6 L5.5 13 Z"/>`;
/* L'icona del vento. dimensione: "mini" (in riga), "cella" (tabelle), "grande" (riquadri).
   opz.nome = false per nasconderlo (la direzione resta nel testo per lettori di schermo) */
export function ventoIcona(kmh, dir, dimensione = "cella", opz = {}){
  if(kmh == null || !isFinite(kmh)) return `<span class="vw vw-${dimensione} vw-nd">n.d.</span>`;
  const u = unita(), l = livello(kmh), s = settore(dir), val = inUnita(kmh, u);
  const calma = kmh < 5 || !s;
  const nome = calma ? "Calma" : s.nome;
  const descr = calma ? `Vento calmo, ${val} ${etichettaUnita(u)}` : `${s.nome}, vento ${l.nome} da ${s.da}, ${val} ${etichettaUnita(u)}${opz.extra ? ", " + opz.extra : ""}`;
  const freccia = calma ? `<svg class="vw-a" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/></svg>`
    : `<svg class="vw-a" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${Math.round((dir + 180) % 360)}deg)">${FRECCIA}</svg>`;
  return `<span class="vw vw-${dimensione} ${l.cls}" role="img" aria-label="${esc(descr)}" title="${esc(descr)}">${freccia}<b>${val}</b>${dimensione === "mini" ? `<i>${etichettaUnita(u)}</i>` : ""}${opz.nome === false ? "" : `<small>${esc(nome)}</small>`}${opz.extra && dimensione !== "mini" ? `<em>${esc(opz.extra)}</em>` : ""}</span>`;
}

/* interruttore km/h ↔ nodi (vicino a ogni dato di vento) */
export function unitaToggle(){
  const u = unita();
  return `<span class="vu-t" role="group" aria-label="Unità del vento"><button type="button" data-vu="kmh" class="${u === "kmh" ? "on" : ""}" aria-pressed="${u === "kmh"}">km/h</button><button type="button" data-vu="kn" class="${u === "kn" ? "on" : ""}" aria-pressed="${u === "kn"}">nodi</button></span>`;
}

/* legenda della scala nell'unità scelta */
export function legendaVento(){
  const u = unita(), lim = SCALA.slice(1).map(x => x.min);
  return `<span class="vw-leg">${SCALA.slice(1).map((x, i) => `<span class="${x.cls}">${x.nome} ${i < lim.length - 1 ? `${inUnita(x.min, u)}–${inUnita(lim[i + 1], u)}` : `≥ ${inUnita(x.min, u)}`}</span>`).join("")} <span class="u">${etichettaUnita(u)}</span></span>`;
}
