import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../../js/state.js";
import { inUnita, settore, livello, mediaDirezioni, ventoIcona, unitaToggle, testoVento } from "../../js/vento.js";

test("conversione km/h → nodi", () => {
  assert.equal(inUnita(100, "kmh"), 100);
  assert.equal(inUnita(100, "kn"), 54);
  assert.equal(inUnita(null, "kn"), null);
  assert.equal(testoVento(37.04, "kn"), "20 nodi");
});
test("nomi dei venti dalla direzione di provenienza", () => {
  assert.equal(settore(0).nome, "Tramontana");
  assert.equal(settore(359).nome, "Tramontana");
  assert.equal(settore(135).nome, "Scirocco");
  assert.equal(settore(225).nome, "Libeccio");
  assert.equal(settore(315).nome, "Maestrale");
  assert.equal(settore(null), null);
});
test("scala di intensità", () => {
  assert.equal(livello(3).cls, "v0");
  assert.equal(livello(20).cls, "v2");
  assert.equal(livello(55).cls, "v4");
  assert.equal(livello(90).cls, "v5");
});
test("media vettoriale attraversa il nord", () => {
  const d = mediaDirezioni([350, 10]);
  assert.ok(d < 1 || d > 359, String(d));
  assert.equal(mediaDirezioni([90, 270]), null);
});
test("icona: tre dati, freccia sottovento, unità scelta", () => {
  state.ventoUnita = "kmh";
  let h = ventoIcona(40, 0);
  assert.match(h, /rotate\(180deg\)/);       // da nord → punta in basso
  assert.match(h, /<b>40<\/b>/);
  assert.match(h, /Tramontana/);
  assert.match(h, /class="vw vw-cella v3"/);
  assert.doesNotMatch(h, /[💨🌬️]/u);
  state.ventoUnita = "kn";
  h = ventoIcona(40, 0);
  assert.match(h, /<b>22<\/b>/);
  assert.match(h, /nodi/);
  assert.match(unitaToggle(), /data-vu="kn" class="on"/);
  assert.match(ventoIcona(2, 90), /Calma/);
  assert.match(ventoIcona(null, 90), /n\.d\./);
  state.ventoUnita = "kmh";
});
