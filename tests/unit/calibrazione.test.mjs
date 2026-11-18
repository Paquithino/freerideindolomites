import { test } from "node:test";
import assert from "node:assert/strict";
import { weightedMedian, calOf, calibra, METODO } from "../../js/calibrazione.js";

test("mediana pesata: il peso sposta il risultato", () => {
  assert.equal(weightedMedian([{v: 1, w: 1}, {v: 5, w: 1}, {v: 9, w: 1}]), 5);
  assert.equal(weightedMedian([{v: 1, w: 1}, {v: 5, w: 1}, {v: 9, w: 5}]), 9);
  assert.equal(weightedMedian([{v: null, w: 1}, {v: 3, w: 0}]), null);
  assert.equal(weightedMedian([]), null);
});

test("calOf: senza calibrazione o modello non affidabile resta neutro", () => {
  assert.deepEqual(calOf(null, "icon"), {factor: 1, weight: 1});
  assert.deepEqual(calOf({models: {icon: {ok: false, factor: 0.5, weight: 3}}}, "icon"), {factor: 1, weight: 1});
  assert.deepEqual(calOf({models: {icon: {ok: true, factor: 0.9, weight: 1.2}}}, "icon"), {factor: 0.9, weight: 1.2});
});

/* dati sintetici: "alto" prevede il 40% in più del vero, "basso" il 30% in meno, "giusto" esatto,
   "rumoroso" giusto in media ma con errori grandi giorno per giorno */
function sintetici(){
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const righe = [];
  for(const season of ["2023-24", "2024-25", "2025-26"]) for(let i = 0; i < 120; i++){
    const obs = rnd() < 0.35 ? Math.round(rnd() * 40) : 0;
    const fc = {};
    for(const [mid, k, rum] of [["alto", 1.4, 2], ["basso", 0.7, 2], ["giusto", 1, 2], ["rumoroso", 1, 24]]){
      fc[mid] = {}; for(const L of [1, 2, 3]) fc[mid][L] = Math.max(0, obs * k + (rnd() - 0.5) * rum * L);
    }
    righe.push({date: `d${i}`, station: "S", season, obs, regime: rnd() < 0.5 ? "SE" : "N", fc});
  }
  return righe;
}

test("calibra: riconosce chi sovrastima e chi sottostima", () => {
  const c = calibra(sintetici(), ["alto", "basso", "giusto"]);
  assert.equal(c.metodo, METODO);
  const f = id => c.models[id].factor;
  for(const id of ["alto", "basso", "giusto"]) assert.ok(c.models[id].ok, `${id} non affidabile`);
  assert.ok(f("alto") < f("giusto") && f("giusto") < f("basso"), `ordine fattori: ${f("alto")} ${f("giusto")} ${f("basso")}`);
});

test("calibra: fattori relativi (media geometrica 1) e dentro i limiti", () => {
  const c = calibra(sintetici(), ["alto", "basso", "giusto"]);
  const fs = Object.values(c.models).map(m => m.factor);
  const gm = Math.exp(fs.reduce((s, x) => s + Math.log(x), 0) / fs.length);
  assert.ok(Math.abs(gm - 1) < 0.02, `media geometrica ${gm}`);
  for(const x of fs) assert.ok(x >= 0.6 && x <= 1.6, `fattore ${x} fuori limiti`);
});

test("calibra: chi sbaglia di più giorno per giorno pesa meno", () => {
  const c = calibra(sintetici(), ["alto", "basso", "giusto", "rumoroso"]);
  assert.ok(c.models.giusto.weight > c.models.rumoroso.weight, `${c.models.giusto.weight} vs ${c.models.rumoroso.weight}`);
  // una sovrastima costante si corregge col fattore: dopo la correzione non deve pesare molto meno
  assert.ok(c.models.alto.weight > c.models.rumoroso.weight);
});

test("calibra: verifica fuori campione presente per 1, 2 e 3 giorni", () => {
  const c = calibra(sintetici(), ["alto", "basso", "giusto"]);
  for(const L of [1, 2, 3]){
    assert.ok(c.verifica[L].calibrato.n > 0);
    assert.ok(c.verifica[L].calibrato.mae <= c.verifica[L].grezzo.mae * 1.05, `L${L}: la calibrazione peggiora l'errore`);
  }
});

test("calibra: pochi dati = modello neutro", () => {
  const poche = sintetici().slice(0, 15);
  const c = calibra(poche, ["alto", "basso", "giusto"]);
  for(const m of Object.values(c.models)) assert.equal(m.ok, false);
});
