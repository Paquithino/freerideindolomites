import { test } from "node:test";
import assert from "node:assert/strict";
import { state } from "../../js/state.js";
import { SPOTS, FORECAST_DAYS, MODELS } from "../../js/config.js";
import { demoWeather, metrics, dailyPlan, bestDay, romeNowISO, addDaysISO, dirName } from "../../js/meteo.js";
import { demoModels, ensembleFor } from "../../js/modelli.js";
import { demoQuote, quoteHTML } from "../../js/quote.js";

demoWeather(); demoModels(); demoQuote();

test("date: fuso di Roma e somma di giorni", () => {
  assert.match(romeNowISO(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysISO("2026-03-01", -1), "2026-02-28");
  assert.equal(dirName(0), "N"); assert.equal(dirName(225), "SO"); assert.equal(dirName(359), "N"); assert.equal(dirName(null), "");
});

test("metriche di ogni spot: numeri validi e coerenti", () => {
  for(const s of SPOTS){
    const m = metrics(s);
    assert.ok(m, `${s.id} senza metriche`);
    for(const k of ["p24", "p48", "p72", "n24", "n72", "n7d", "score"]) assert.ok(Number.isFinite(m[k]) && m[k] >= 0, `${s.id}.${k} = ${m[k]}`);
    assert.ok(m.p24 <= m.p48 + 1e-6 && m.p48 <= m.p72 + 1e-6, `${s.id}: neve passata non cumulativa`);
    assert.ok(m.n24 <= m.n72 + 1e-6 && m.n72 <= m.n7d + 1e-6, `${s.id}: neve futura non cumulativa`);
    assert.ok(m.score <= 10, `${s.id}: indice powder ${m.score} > 10`);
    assert.ok(Array.isArray(m.flags));
  }
});

test("previsione giornaliera: parte da oggi, giorni consecutivi, neve non negativa", () => {
  for(const s of SPOTS){
    const p = dailyPlan(s);
    assert.ok(p.length >= FORECAST_DAYS - 1, `${s.id}: solo ${p.length} giorni`);
    assert.equal(p[0].date, romeNowISO().slice(0, 10));
    p.forEach((d, i) => { if(i) assert.equal(d.date, addDaysISO(p[i - 1].date, 1)); assert.ok(d.snow >= 0); assert.ok(["alta", "media", "bassa"].includes(d.conf), d.conf); });
  }
});

test("insieme dei modelli: tutti i modelli presenti e forbice min ≤ mediana ≤ max", () => {
  const s = SPOTS[0], e = ensembleFor(s);
  assert.ok(e, "nessun ensemble");
  for(const d of dailyPlan(s).filter(d => d.ens && d.ens.n >= 2)){
    assert.ok(d.ens.min <= d.snow + 0.05 && d.snow <= d.ens.max + 0.05, `${d.date}: ${d.ens.min} ≤ ${d.snow} ≤ ${d.ens.max}`);
    for(const id of Object.keys(d.ens.models)) assert.ok(MODELS.some(m => m.id === id), id);
  }
});

test("giorno migliore: se c'è, è nel futuro con almeno 10 cm", () => {
  for(const s of SPOTS){
    const b = bestDay(s); if(!b) continue;
    assert.ok(b.date >= romeNowISO().slice(0, 10)); assert.ok(b.fresh >= 10, `${s.id}: ${b.fresh}`);
  }
});

test("neve per quota: tabella con vetta, metà e base e quote dello spot", () => {
  const s = SPOTS.find(x => x.id === "cortina");
  const h = quoteHTML(s);
  for(const t of ["Vetta", "Metà", "Base", "2932", "1282"]) assert.ok(h.includes(t) || h.includes(t.replace(/(\d)(\d{3})$/, "$1.$2")), t);
  state.quote = null;
  assert.match(quoteHTML(s), /non disponibile/i);
  demoQuote();
});

test("spot senza dati meteo: niente crash, metriche nulle", () => {
  const prima = state.wx; state.wx = {};
  try{ assert.equal(metrics(SPOTS[0]), null); assert.deepEqual(dailyPlan(SPOTS[0]), []); }
  finally{ state.wx = prima; }
});
