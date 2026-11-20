/* =========================================================
   NEVE MISURATA — stazioni nivometriche ARPAV (Veneto)
   Fonte: ARPAV, file XML in tempo reale (licenza CC BY 4.0)
     elenco:   https://meteo.arpa.veneto.it/meteo/dati_meteo/xml/stazioni_neve.xml
     stazione: https://meteo.arpa.veneto.it/meteo/dati_meteo/xml/NNNN.xml
   Ogni file stazione contiene circa 60 ore di dati ogni 30 minuti, in orario solare (UTC+1).
   Sensori usati: LIVNEVE = altezza neve (cm), TEMP = temperatura aria (°C).
   Il sito del Veneto non permette la lettura diretta dal browser dei visitatori:
   questi dati arrivano nel sito tramite l'automazione oraria (GitHub Actions).
   ========================================================= */

import { fetchRetry } from "./state.js";

export const ARPAV_BASE = "https://meteo.arpa.veneto.it/meteo/dati_meteo/xml/";

/* i file sono in ISO-8859-1: leggiamo i byte e li decodifichiamo noi */
async function getText(url){
  const r = await fetchRetry(url, {}, 2);
  if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return new TextDecoder("latin1").decode(await r.arrayBuffer());
}

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${name}>`));
  return m ? m[1].trim() : null;
};
const blocks = (xml, name) => xml.match(new RegExp(`<${name}>[\\s\\S]*?</${name}>`, "g")) || [];

/* "202611171130" in orario solare (UTC+1) -> millisecondi UTC */
export function istanteMs(s){
  return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10) - 1, +s.slice(10, 12));
}

/* elenco delle stazioni nivometriche */
export function parseElenco(xml){
  return blocks(xml, "STAZIONE").map(b => ({
    code: tag(b, "LINKSTAZ"), id: tag(b, "IDSTAZ"), name: tag(b, "NOME"),
    lon: +tag(b, "X"), lat: +tag(b, "Y"), elev: +tag(b, "QUOTA")
  })).filter(s => s.code && isFinite(s.lat) && isFinite(s.lon));
}

/* serie di un sensore: [{t, v}] solo con valori validi (">>" = dato mancante) */
export function serie(xml, type){
  const s = blocks(xml, "SENSORE").find(b => tag(b, "TYPE") === type);
  if(!s) return [];
  const out = [];
  for(const m of s.matchAll(/<DATI ISTANTE="(\d{12})">\s*<VM>([^<]*)<\/VM>/g)){
    const v = parseFloat(m[2].replace(",", "."));
    if(isFinite(v)) out.push({t: istanteMs(m[1]), v});
  }
  return out;
}

/* valore "robusto" vicino a un istante: mediana dei dati entro ±45 minuti
   (il sensore a ultrasuoni ha piccoli salti da una lettura all'altra) */
function near(ser, t){
  const w = ser.filter(p => Math.abs(p.t - t) <= 45 * 60e3).map(p => p.v).sort((a, b) => a - b);
  return w.length ? w[Math.floor(w.length / 2)] : null;
}

/* sensore trovato per descrizione (il vento non c'è in tutte le stazioni): serie in km/h o gradi */
function serieDove(xml, prova){
  const s = blocks(xml, "SENSORE").find(b => prova(`${tag(b, "TYPE") || ""} ${tag(b, "DESC") || ""} ${tag(b, "NOME") || ""}`));
  if(!s) return [];
  const unita = (tag(s, "UNIT") || tag(s, "UNITA") || "").toLowerCase();
  const k = /m\/s/.test(unita) ? 3.6 : 1;
  const out = [];
  for(const m of s.matchAll(/<DATI ISTANTE="(\d{12})">\s*<VM>([^<]*)<\/VM>/g)){
    const v = parseFloat(m[2].replace(",", "."));
    if(isFinite(v)) out.push({t: istanteMs(m[1]), v: v * k});
  }
  return out;
}
const VENTO = x => /vent|VV/i.test(x) && !/dir|DV/i.test(x), DIREZ = x => /dir|DV/i.test(x) && /vent|DV/i.test(x);

/* ore piene delle ultime ~60 ore (il file ARPAV ha un dato ogni 30 minuti): per lo storico */
export function oreStazione(xml){
  const hs = serie(xml, "LIVNEVE"), tt = serie(xml, "TEMP"), vv = serieDove(xml, VENTO), dv = serieDove(xml, DIREZ);
  if(!hs.length && !tt.length) return [];
  const tutti = [...hs, ...tt].map(p => p.t), t0 = Math.ceil(Math.min(...tutti) / 3600e3) * 3600e3, t1 = Math.max(...tutti);
  const out = [];
  for(let t = t0; t <= t1; t += 3600e3){
    const r = {hs: near(hs, t), t: near(tt, t)};
    if(vv.length){ const w = vv.filter(p => p.t > t - 3600e3 && p.t <= t).map(p => p.v); if(w.length){ r.w = w.reduce((a, b) => a + b, 0) / w.length; r.wx = Math.max(...w); } }
    if(dv.length) r.d = near(dv, t);
    if(r.hs != null || r.t != null) out.push([t, r]);
  }
  return out;
}

/* da file stazione a riga nel formato delle altre stazioni del sito */
export function parseStazione(xml, info){
  const hs = serie(xml, "LIVNEVE");
  if(!hs.length) return null;
  const last = hs[hs.length - 1];
  const now = near(hs, last.t);
  const diff = h => { const p = near(hs, last.t - h * 3600e3); return p == null || now == null ? null : now - p; };
  const temp = serie(xml, "TEMP");
  return {
    id: "ARPAV-" + info.id, name: info.name, lat: info.lat, lon: info.lon, elev: info.elev,
    hs: Math.max(0, now), d24: diff(24), d48: diff(48), d72: diff(72),
    lt: temp.length ? temp[temp.length - 1].v : null,
    region: "", operator: "ARPAV", date: new Date(last.t).toISOString(),
    ore: oreStazione(xml)   // serie oraria per lo storico (il robot la toglie dal file del sito)
  };
}

/* esegue le richieste a gruppi, per non sovraccaricare il server di ARPAV */
async function pool(items, n, fn){
  const out = [];
  for(let i = 0; i < items.length; i += n){
    out.push(...await Promise.allSettled(items.slice(i, i + n).map(fn)));
  }
  return out;
}

/* scarica solo le stazioni utili: quelle entro maxKm da almeno uno spot */
export async function loadArpav(spots, maxKm, distKm){
  const elenco = parseElenco(await getText(ARPAV_BASE + "stazioni_neve.xml"));
  const utili = elenco.filter(s => spots.some(p => distKm(p.lat, p.lon, s.lat, s.lon) <= maxKm));
  const res = await pool(utili, 6, async s => parseStazione(await getText(ARPAV_BASE + s.code), s));
  const old = Date.now() - 6 * 3600e3;   // scarta stazioni ferme da più di 6 ore
  return res.filter(r => r.status === "fulfilled" && r.value && new Date(r.value.date).getTime() > old).map(r => r.value);
}
