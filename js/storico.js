/* =========================================================
   STORICO 14 GIORNI — formato comune a robot (scripts/storico.mjs) e sito
   Un file per spot e uno per stazione, serie oraria "a colonne" (leggera):
     {v: 1, id, inizio: "2026-11-06T10:00Z", ore: 336, t: [...], hs: [...], ...}
   l'ora i è inizio + i ore (UTC, offset esplicito "Z"); null = dato mancante.
   Sul sito gli orari si mostrano sempre in ora italiana (Europe/Rome).
   Spot (stima oraria registrata, non una misura):
     t = temperatura °C, n = neve caduta nell'ora cm, hs = neve al suolo cm,
     w = vento in quota km/h, d = direzione da cui soffia (gradi), g = raffiche a 10 m km/h
   Stazioni (misure):
     hs = neve al suolo cm, t = temperatura °C, w = vento medio km/h, wx = raffica/massimo km/h, d = direzione
   Niente DOM qui: lo usano anche il robot e i test.
   ========================================================= */

export const ORA = 3600e3;
export const GIORNI_STORICO = 14;
export const ORE_STORICO = GIORNI_STORICO * 24;
export const CAMPI_SPOT = ["t", "n", "hs", "w", "d", "g"];
export const CAMPI_STAZIONE = ["hs", "t", "w", "wx", "d"];

export const oraPiena = ms => Math.floor(ms / ORA) * ORA;
export const isoUTC = ms => new Date(ms).toISOString().slice(0, 13) + ":00Z";
/* nome file sicuro per una stazione */
export const fileStazione = id => String(id).replace(/[^A-Za-z0-9_-]/g, "_");

/* ---------- ora italiana ---------- */
let fmt = null;
const formatoRoma = () => fmt || (fmt = new Intl.DateTimeFormat("sv-SE", {timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false}));
/* istante → "2026-11-20T10:00" in ora italiana */
export const romaLocale = ms => formatoRoma().format(new Date(ms)).replace(" ", "T");
export const giornoRoma = ms => romaLocale(ms).slice(0, 10);
/* "2026-11-20T10:00" ora italiana → istante (gestisce ora solare e legale) */
export function msDaRoma(loc){
  const s = loc.slice(0, 16), base = Date.parse(s + ":00Z");
  for(const off of [1, 2]){ const ms = base - off * ORA; if(romaLocale(ms) === s) return ms; }
  return base - ORA;
}
const GG = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"], MM = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
/* "2026-11-18" → "Mar 18 nov" */
export function etichettaGiorno(g){
  const d = new Date(g + "T12:00:00Z");
  const s = `${GG[d.getUTCDay()]} ${d.getUTCDate()} ${MM[d.getUTCMonth()]}`;
  return s[0].toUpperCase() + s.slice(1);
}
export function aggiungiGiorni(g, n){ const d = new Date(g + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/* ---------- serie: Map(istante → record) ↔ colonne ---------- */
export function daColonne(j){
  const m = new Map();
  if(!j || !j.inizio || !j.ore) return m;
  const t0 = Date.parse(j.inizio), campi = Object.keys(j).filter(k => Array.isArray(j[k]));
  for(let i = 0; i < j.ore; i++){
    const r = {}; let c = 0;
    for(const k of campi){ const v = j[k][i]; if(v != null){ r[k] = v; c++; } }
    if(c) m.set(t0 + i * ORA, r);
  }
  return m;
}
const tondo = v => v == null || !isFinite(v) ? null : Math.round(v * 10) / 10;
export function aColonne(m, campi, extra = {}){
  const ks = [...m.keys()].sort((a, b) => a - b);
  const out = {v: 1, ...extra, inizio: ks.length ? isoUTC(ks[0]) : null, ore: 0};
  if(!ks.length) return out;
  const t0 = ks[0], n = Math.round((ks[ks.length - 1] - t0) / ORA) + 1;
  out.ore = n;
  for(const k of campi) out[k] = new Array(n).fill(null);
  for(const [t, r] of m){ const i = Math.round((t - t0) / ORA); for(const k of campi) if(r[k] != null) out[k][i] = tondo(r[k]); }
  // colonne del tutto vuote: tolte (il sito le legge come "dato non disponibile")
  for(const k of campi) if(out[k].every(v => v == null)) delete out[k];
  return out;
}
/* tiene solo le ultime 14 giornate fino all'ora attuale: niente futuro, niente oltre il limite */
export function taglia(m, adesso, ore = ORE_STORICO){
  const fine = oraPiena(adesso), inizio = fine - ore * ORA;
  for(const t of [...m.keys()]) if(t < inizio || t > fine) m.delete(t);
  return m;
}
/* aggiunge record (sovrascrive=true: il nuovo vince; false: riempie solo i buchi) */
export function inserisci(m, t, r, sovrascrivi = true){
  const pulito = {}; let c = 0;
  for(const k in r) if(r[k] != null && isFinite(r[k])){ pulito[k] = r[k]; c++; }
  if(!c) return;
  if(sovrascrivi || !m.has(t)) m.set(t, sovrascrivi ? {...(m.get(t) || {}), ...pulito} : pulito);
}
/* ore mancanti nella finestra (dalla più recente) */
export function oreMancanti(m, adesso, ore = ORE_STORICO){
  const fine = oraPiena(adesso), out = [];
  for(let t = fine; t > fine - ore * ORA; t -= ORA) if(!m.has(t)) out.push(t);
  return out;
}

/* ---------- dai dati meteo orari (Open-Meteo, ora italiana) ai record dello spot ---------- */
export function recordDaMeteo(H, i){
  const sf = H.snow_c || H.snowfall;
  return {
    t: H.temperature_2m ? H.temperature_2m[i] : null,
    n: sf ? sf[i] : null,
    hs: H.snow_depth && H.snow_depth[i] != null ? H.snow_depth[i] * 100 : null,
    w: H.wind_speed_700hPa ? H.wind_speed_700hPa[i] : null,
    d: H.wind_direction_700hPa ? H.wind_direction_700hPa[i] : null,
    g: H.wind_gusts_10m ? H.wind_gusts_10m[i] : null
  };
}
/* tutte le ore di una serie meteo come [istante, record] (fino a "finoA" compreso, se dato) */
export function oreDaMeteo(H, finoA = Infinity){
  const out = [];
  if(!H || !H.time) return out;
  H.time.forEach((loc, i) => { const t = msDaRoma(loc); if(t <= finoA) out.push([t, recordDaMeteo(H, i)]); });
  return out;
}

/* ---------- riassunto di un giorno per una stazione ---------- */
const valori = (m, t0, t1, k) => { const v = []; for(let t = t0; t < t1; t += ORA){ const r = m.get(t); if(r && r[k] != null) v.push(r[k]); } return v; };
const ultimo = (m, t0, t1, k) => { for(let t = t1 - ORA; t >= t0; t -= ORA){ const r = m.get(t); if(r && r[k] != null) return r[k]; } return null; };
/* giorno = "2026-11-18" (ora italiana). neve fresca = aumento dell'altezza neve rispetto a fine giorno prima */
export function riassuntoGiorno(m, giorno){
  const t0 = msDaRoma(giorno + "T00:00"), t1 = msDaRoma(aggiungiGiorni(giorno, 1) + "T00:00");
  const hs = valori(m, t0, t1, "hs"), t = valori(m, t0, t1, "t"), w = valori(m, t0, t1, "w"), wx = valori(m, t0, t1, "wx");
  const prima = ultimo(m, t0 - 24 * ORA, t0, "hs");
  const hsMax = hs.length ? Math.max(...hs) : null;
  return {
    giorno, ore: Math.max(hs.length, t.length),
    hs: ultimo(m, t0, t1, "hs"), hsMax,
    nuova: hsMax != null && prima != null ? Math.max(0, hsMax - prima) : null,
    tmin: t.length ? Math.min(...t) : null, tmax: t.length ? Math.max(...t) : null,
    wmed: w.length ? w.reduce((a, b) => a + b, 0) / w.length : null,
    wmax: wx.length ? Math.max(...wx) : w.length ? Math.max(...w) : null
  };
}
/* altezza neve a fine di ogni giorno, per il piccolo grafico dei 14 giorni */
export function andamentoNeve(m, oggi, giorni = GIORNI_STORICO){
  const out = [];
  for(let k = giorni; k >= 0; k--){
    const g = aggiungiGiorni(oggi, -k), t0 = msDaRoma(g + "T00:00"), t1 = msDaRoma(aggiungiGiorni(g, 1) + "T00:00");
    out.push({giorno: g, hs: ultimo(m, t0, t1, "hs")});
  }
  return out;
}
/* le 24 ore di un giorno (ora italiana): [{t, ora: "08", r}] */
export function oreDelGiorno(m, giorno){
  const t0 = msDaRoma(giorno + "T00:00"), t1 = msDaRoma(aggiungiGiorni(giorno, 1) + "T00:00"), out = [];
  for(let t = t0; t < t1; t += ORA) out.push({t, ora: romaLocale(t).slice(11, 13), r: m.get(t) || null});
  return out;
}

/* ---------- sul sito: scarica un file dello storico (una volta sola) ---------- */
const memo = {};
export function caricaStorico(percorso){
  if(!memo[percorso]) memo[percorso] = fetch(percorso, {cache: "no-cache"})
    .then(r => r.ok ? r.json() : null).catch(() => null)
    .then(j => { if(!j) delete memo[percorso]; return j; });
  return memo[percorso];
}
export const percorsoSpot = id => `./dati/storico/spot/${id}.json`;
export const percorsoStazione = id => `./dati/storico/stazioni/${fileStazione(id)}.json`;
