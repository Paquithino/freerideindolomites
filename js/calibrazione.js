/* =========================================================
   CALIBRAZIONE DEI MODELLI
   Confronta ciò che ogni modello prevedeva 1, 2 e 3 giorni prima con la neve
   misurata dalle stazioni (aumento dell'altezza neve tra le 8:00 di un giorno
   e le 8:00 del giorno dopo). Da qui ricava, per ogni modello:
     - un FATTORE: quanto correggere i suoi cm (es. 0,8 = tende a sovrastimare del 25%)
     - un PESO: quanto contare nella Previsione FreeRide (chi sbaglia meno pesa di più)
   Le funzioni di calcolo sono qui; il download dei dati storici sta in
   scripts/calibra.mjs. Il risultato è il file calibrazione.json.
   ========================================================= */

export const MIN_GIORNI = 12;          // sotto questo numero di giornate un modello resta neutro
export const SOGLIA_CM = 1;            // giornata "con neve": misurata o prevista ≥ 1 cm
const LIMITI_FATTORE = [0.5, 1.8];     // correzioni più estreme sono sospette: le limitiamo

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

/* mediana pesata: ogni valore conta quanto il suo peso */
export function weightedMedian(pairs){
  const p = pairs.filter(x => x.v != null && x.w > 0).sort((a, b) => a.v - b.v);
  if(!p.length) return null;
  const tot = p.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  for(const x of p){ acc += x.w; if(acc >= tot / 2 - 1e-9) return x.v; }
  return p[p.length - 1].v;
}

/* fattore e peso di un modello (neutri se manca la calibrazione) */
export function calOf(cal, mid){
  const m = cal && cal.models && cal.models[mid];
  return m && m.ok ? {factor: m.factor, weight: m.weight} : {factor: 1, weight: 1};
}

/* ---------- valutazione ----------
   righe: [{date, station, season, obs, regime, fc: {modello: {1: cm, 2: cm, 3: cm}}}] */
const giornataUtile = (o, f) => o != null && f != null && (o >= SOGLIA_CM || f >= SOGLIA_CM);

function fit(righe, modelli, leads){
  const models = {};
  for(const mid of modelli){
    const coppie = [];
    for(const r of righe) for(const L of leads){
      const f = r.fc[mid] && r.fc[mid][L];
      if(giornataUtile(r.obs, f)) coppie.push([f, r.obs]);
    }
    const n = coppie.length, sf = coppie.reduce((s, c) => s + c[0], 0);
    const ok = n >= MIN_GIORNI * leads.length && sf >= 20;
    // il fattore è quello che rende minimo l'errore medio (cerchiamo tra 0,5 e 1,8 a passi di 0,02):
    // più robusto del semplice rapporto tra totali, che si fa ingannare dalle "spolverate" previste e non cadute
    const errore = k => mean(coppie.map(([f, o]) => Math.abs(f * k - o)));
    let factor = 1, mae = errore(1);
    if(ok) for(let k = LIMITI_FATTORE[0]; k <= LIMITI_FATTORE[1] + 1e-9; k += 0.02){
      const e = errore(k); if(e < mae - 1e-9){ mae = e; factor = Math.round(k * 100) / 100; }
    }
    models[mid] = {ok, n: Math.round(n / leads.length), factor, mae, maeGrezzo: errore(1)};
  }
  // peso = inverso dell'errore, normalizzato in modo che il peso medio sia 1
  const okIds = modelli.filter(m => models[m].ok && models[m].mae > 0);
  const inv = okIds.map(m => 1 / models[m].mae), avg = mean(inv);
  okIds.forEach((m, i) => { models[m].weight = inv[i] / avg; });
  modelli.forEach(m => { if(models[m].weight == null) models[m].weight = 1; });
  return {models};
}

/* errore della previsione combinata su un insieme di righe */
function ensembleError(righe, modelli, cal, L){
  const err = [], bias = [];
  let colpi = 0, grosse = 0, falsi = 0;
  for(const r of righe){
    if(r.obs == null) continue;
    const pairs = modelli.map(mid => {
      const f = r.fc[mid] && r.fc[mid][L]; const c = calOf(cal, mid);
      return {v: f == null ? null : f * c.factor, w: c.weight};
    });
    const e = weightedMedian(pairs);
    if(e == null || !(r.obs >= SOGLIA_CM || e >= SOGLIA_CM)) continue;
    err.push(Math.abs(e - r.obs)); bias.push(e - r.obs);
    if(r.obs >= 10){ grosse++; if(e >= 5) colpi++; }
    if(e >= 10 && r.obs < 3) falsi++;
  }
  return {n: err.length, mae: mean(err), bias: mean(bias), nevicateGrosse: grosse, prese: colpi, falsiAllarmi: falsi};
}

/* calibrazione completa + verifica onesta "fuori campione":
   per ogni inverno calcoliamo i fattori sugli ALTRI inverni e misuriamo l'errore su quello */
export function calibra(righe, modelli){
  const leads = [1, 2, 3];
  const finale = fit(righe, modelli, leads);
  // dettaglio per giorni di anticipo
  for(const mid of modelli){
    finale.models[mid].perAnticipo = {};
    for(const L of leads){
      const f1 = fit(righe, [mid], [L]).models[mid];
      finale.models[mid].perAnticipo[L] = {n: f1.n, factor: f1.factor, mae: f1.mae};
    }
  }
  const stagioni = [...new Set(righe.map(r => r.season))].sort();
  const verifica = {};
  for(const L of leads){
    const grezzo = [], calibrato = [];
    for(const s of stagioni){
      const test = righe.filter(r => r.season === s), train = righe.filter(r => r.season !== s);
      if(!train.length || !test.length) continue;
      const c = fit(train, modelli, leads);
      grezzo.push(ensembleError(test, modelli, null, L));
      calibrato.push(ensembleError(test, modelli, c, L));
    }
    const unisci = a => {
      const n = a.reduce((s, x) => s + x.n, 0);
      const w = k => n ? a.reduce((s, x) => s + (x[k] || 0) * x.n, 0) / n : null;
      const sum = k => a.reduce((s, x) => s + x[k], 0);
      return {n, mae: w("mae"), bias: w("bias"), nevicateGrosse: sum("nevicateGrosse"), prese: sum("prese"), falsiAllarmi: sum("falsiAllarmi")};
    };
    verifica[L] = {grezzo: unisci(grezzo), calibrato: unisci(calibrato)};
  }
  // regimi dei venti: rapporto misurata / prevista (modelli grezzi, 1 giorno prima)
  const regimi = {};
  for(const r of righe){
    if(!r.regime || r.obs == null) continue;
    const e = weightedMedian(modelli.map(mid => ({v: r.fc[mid] && r.fc[mid][1], w: 1})));
    if(e == null || !(r.obs >= SOGLIA_CM || e >= SOGLIA_CM)) continue;
    const g = regimi[r.regime] = regimi[r.regime] || {giorni: 0, misurata: 0, prevista: 0};
    g.giorni++; g.misurata += r.obs; g.prevista += e;
  }
  for(const k in regimi){ const g = regimi[k]; g.rapporto = g.prevista > 0 ? g.misurata / g.prevista : null; }
  return {models: finale.models, verifica, regimi, stagioni};
}
