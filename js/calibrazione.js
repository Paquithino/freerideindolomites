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

export const METODO = 2;               // versione del metodo (il sito ignora calibrazioni fatte con metodi vecchi)
export const MIN_GIORNI = 12;          // sotto questo numero di giornate un modello resta neutro
export const SOGLIA_CM = 1;            // giornata "con neve": misurata o prevista ≥ 1 cm
export const SOGLIA_EVENTO = 5;        // per i fattori contano solo le nevicate vere (≥ 5 cm misurati o previsti)
const LIMITI_FATTORE = [0.6, 1.6];     // correzioni più estreme sono sospette: le limitiamo

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

/* fattore e peso di un modello (neutri se manca la calibrazione).
   Con lo spot: si usano i fattori della sua zona (Alto Adige, Veneto…) se quella zona ha abbastanza dati
   per quel modello, altrimenti quelli generali. */
export function zonaDi(cal, spotId){
  const z = spotId && cal && cal.spotZona && cal.spotZona[spotId];
  return z && cal.zone && cal.zone[z] ? z : null;
}
export function calOf(cal, mid, spotId){
  const z = zonaDi(cal, spotId);
  const mz = z && cal.zone[z].models && cal.zone[z].models[mid];
  if(mz && mz.ok) return {factor: mz.factor, weight: mz.weight, zona: z};
  const m = cal && cal.models && cal.models[mid];
  return m && m.ok ? {factor: m.factor, weight: m.weight} : {factor: 1, weight: 1};
}

/* ---------- valutazione ----------
   righe: [{date, station, season, obs, regime, fc: {modello: {1: cm, 2: cm, 3: cm}}}] */
const giornataUtile = (o, f) => o != null && f != null && (o >= SOGLIA_CM || f >= SOGLIA_CM);

/* Metodo 2 (deciso sui dati degli inverni 2024-2026):
   - il fattore di ogni modello si calcola SOLO sulle nevicate vere (≥ 5 cm), come rapporto tra neve
     misurata e prevista: le centinaia di "spolverate" previste e non viste dalle stazioni altrimenti
     spingono tutti i modelli verso il basso e il sito perde le grandi nevicate;
   - i fattori sono RELATIVI (la loro media geometrica è 1): correggono le differenze tra modelli,
     non la scala generale, perché l'aumento dell'altezza neve sulle stazioni è sempre un po' meno
     della neve caduta (assestamento, vento) e non vogliamo "dimezzare" la neve per questo;
   - il peso è l'inverso dell'errore medio dopo la correzione. */
export function fit(righe, modelli, leads){
  const models = {};
  for(const mid of modelli){
    let so = 0, sf = 0, n = 0, nEv = 0;
    for(const r of righe) for(const L of leads){
      const f = r.fc[mid] && r.fc[mid][L];
      if(!giornataUtile(r.obs, f)) continue;
      n++;
      if(r.obs >= SOGLIA_EVENTO || f >= SOGLIA_EVENTO){ so += r.obs; sf += f; nEv++; }
    }
    const ok = n >= MIN_GIORNI * leads.length && nEv >= MIN_GIORNI && sf >= 20;
    models[mid] = {ok, n: Math.round(n / leads.length), nevicate: Math.round(nEv / leads.length), rapporto: sf > 0 ? so / sf : null};
  }
  const okIds = modelli.filter(m => models[m].ok);
  const raw = Object.fromEntries(okIds.map(m => [m, clamp(models[m].rapporto, ...LIMITI_FATTORE)]));
  const g = okIds.length ? Math.exp(mean(okIds.map(m => Math.log(raw[m])))) : 1;
  for(const mid of modelli){
    const m = models[mid];
    m.factor = m.ok ? Math.round(raw[mid] / g * 100) / 100 : 1;
    const err = [];
    for(const r of righe) for(const L of leads){
      const f = r.fc[mid] && r.fc[mid][L];
      if(giornataUtile(r.obs, f)) err.push(Math.abs(f * m.factor - r.obs));
    }
    m.mae = mean(err);
  }
  const inv = okIds.filter(m => models[m].mae > 0).map(m => [m, 1 / models[m].mae]);
  const avg = mean(inv.map(x => x[1]));
  inv.forEach(([m, v]) => { models[m].weight = v / avg; });
  modelli.forEach(m => { if(models[m].weight == null) models[m].weight = 1; });
  return {models, scala: g};
}

/* errore della previsione combinata su un insieme di righe */
export function ensembleError(righe, modelli, cal, L){
  const err = [], bias = [];
  let colpi = 0, grosse = 0, falsi = 0, soG = 0, seG = 0;
  for(const r of righe){
    if(r.obs == null) continue;
    const pairs = modelli.map(mid => {
      const f = r.fc[mid] && r.fc[mid][L]; const c = calOf(cal, mid);
      return {v: f == null ? null : f * c.factor, w: c.weight};
    });
    const e = weightedMedian(pairs);
    if(e == null || !(r.obs >= SOGLIA_CM || e >= SOGLIA_CM)) continue;
    err.push(Math.abs(e - r.obs)); bias.push(e - r.obs);
    if(r.obs >= 10){ grosse++; soG += r.obs; seG += e; if(e >= 5) colpi++; }
    if(e >= 10 && r.obs < 3) falsi++;
  }
  return {n: err.length, mae: mean(err), bias: mean(bias), nevicateGrosse: grosse, prese: colpi, falsiAllarmi: falsi, soG, seG};
}

/* calibrazione completa + verifica onesta "fuori campione":
   per ogni inverno calcoliamo i fattori sugli ALTRI inverni e misuriamo l'errore su quello */
export function calibra(righe, modelli){
  const leads = [1, 2, 3];
  const finale = fit(righe, modelli, leads);
  // per ogni modello e anticipo: nelle nevicate ≥ 10 cm misurati, quanta neve prevedeva (1 = perfetto)
  for(const mid of modelli){
    finale.models[mid].grosse = {};
    for(const L of leads){
      let so = 0, sf = 0, n = 0;
      for(const r of righe){ const f = r.fc[mid] && r.fc[mid][L]; if(f == null || r.obs < 10) continue; so += r.obs; sf += f; n++; }
      finale.models[mid].grosse[L] = {n, rapporto: so > 0 ? sf / so : null};
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
      return {n, mae: w("mae"), bias: w("bias"), nevicateGrosse: sum("nevicateGrosse"), prese: sum("prese"), falsiAllarmi: sum("falsiAllarmi"),
        // nelle nevicate ≥ 10 cm: quanta neve prevedeva la Previsione FreeRide rispetto a quella misurata
        grosseRapporto: sum("soG") > 0 ? sum("seG") / sum("soG") : null};
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
  return {metodo: METODO, scala: finale.scala, models: finale.models, verifica, regimi, stagioni};
}
