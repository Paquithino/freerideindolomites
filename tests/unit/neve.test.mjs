import { test } from "node:test";
import assert from "node:assert/strict";
import { frazioneNeve, giorni, zeroTermico } from "../../js/quote.js";
import { snowRatio, correctedSnow, classify } from "../../js/modelli.js";
import { giudizio, SOGLIE } from "../../js/giudizio.js";

test("frazione di neve: tutta neve ≤ 0,5 °C, tutta pioggia ≥ 2,5 °C, lineare in mezzo", () => {
  assert.equal(frazioneNeve(-10), 1); assert.equal(frazioneNeve(0.5), 1);
  assert.equal(frazioneNeve(1.5), 0.5); assert.equal(frazioneNeve(2.5), 0); assert.equal(frazioneNeve(8), 0);
  assert.equal(frazioneNeve(null), 0);
});

test("rapporto neve/acqua: più freddo = neve più leggera, mai decrescente", () => {
  const T = [3, 0.5, 0, -1, -2, -4, -6, -8, -12];
  const r = T.map(snowRatio);
  for(let i = 1; i < r.length; i++) assert.ok(r[i] >= r[i - 1], `T=${T[i]}`);
  assert.equal(snowRatio(null), 0.7);
  assert.equal(correctedSnow(null, -5), null);
  assert.ok(Math.abs(correctedSnow(7, 2) - 7) < 1e-9, "sopra zero resta il valore Open-Meteo");
});

/* 24 ore sintetiche di un giorno */
function giornata(data, {mm = 0, T = -5, zero = 2000}){
  const H = {time: [], precipitation: [], temperature_2m: [], freezing_level_height: [], wind_gusts_10m: [], wind_speed_10m: []};
  for(let h = 0; h < 24; h++){
    H.time.push(`${data}T${String(h).padStart(2, "0")}:00`);
    H.precipitation.push(mm / 24); H.temperature_2m.push(T); H.freezing_level_height.push(zero);
    H.wind_gusts_10m.push(20 + h); H.wind_speed_10m.push(10);
  }
  return H;
}
const unisci = (...hs) => Object.fromEntries(Object.keys(hs[0]).map(k => [k, hs.flatMap(h => h[k])]));

test("neve per quota: tipo di precipitazione giusto per temperatura", () => {
  const H = unisci(giornata("2026-12-01", {mm: 20, T: -8}), giornata("2026-12-02", {mm: 20, T: -2}), giornata("2026-12-03", {mm: 20, T: 0}),
                   giornata("2026-12-04", {mm: 20, T: 1.5}), giornata("2026-12-05", {mm: 20, T: 6}), giornata("2026-12-06", {mm: 0}));
  const g = giorni(H);
  assert.equal(g["2026-12-01"].tipo, "polvere");
  assert.equal(g["2026-12-02"].tipo, "neve");
  assert.equal(g["2026-12-03"].tipo, "bagnata");
  assert.equal(g["2026-12-04"].tipo, "mista");
  assert.equal(g["2026-12-05"].tipo, "pioggia");
  assert.equal(g["2026-12-06"].tipo, null);
  assert.ok(g["2026-12-01"].cm > g["2026-12-03"].cm, "a -8 °C cade più neve che a 0 °C a parità di acqua");
  assert.equal(Math.round(g["2026-12-05"].cm), 0);
  assert.equal(Math.round(g["2026-12-05"].pioggia), 20);
  assert.equal(g["2026-12-01"].g, 43, "raffica massima del giorno");
});

test("neve per quota: un giorno con meno di 20 ore di dati viene scartato", () => {
  const H = giornata("2026-12-01", {mm: 10});
  for(const k in H) H[k] = H[k].slice(0, 12);
  assert.deepEqual(giorni(H), {});
});

test("quota neve: 300 m sotto lo zero termico durante la precipitazione", () => {
  const z = zeroTermico(unisci(giornata("2026-12-01", {mm: 10, zero: 1800}), giornata("2026-12-02", {mm: 0, zero: 2600})));
  assert.deepEqual(z["2026-12-01"], {zt: 1800, qn: 1500});
  assert.equal(z["2026-12-02"].qn, null, "senza precipitazioni non c'è quota neve");
});

test("regimi del vento: direzione da cui soffia", () => {
  assert.equal(classify(135, 40), "SE");
  assert.equal(classify(0, 40), "N");
  assert.equal(classify(-45, 40), "N", "gradi negativi normalizzati");
  assert.equal(classify(200, 40), "SW"); assert.equal(classify(270, 40), "W"); assert.equal(classify(60, 40), "NE");
  assert.equal(classify(135, 10), "CALM", "sotto 15 km/h è calma");
  assert.equal(classify(null, 40), "CALM");
});

/* ---------- giudizio della versione semplice ---------- */
const M = (o = {}) => ({p48: 0, n72: 0, w7: 10, temp: -5, ...o});
test("giudizio: valanghe forti hanno la precedenza anche con tanta neve", () => {
  for(const lv of [4, 5]){
    const g = giudizio(M({p48: 60}), {level: lv});
    assert.equal(g.cls, "bad"); assert.match(g.txt, /valanghe forte/i);
    assert.deepEqual(g.avvisi, [], "anche il giudizio 'forte' deve avere la lista avvisi (bug trovato dai test)");
  }
});
test("giudizio: soglie della neve", () => {
  assert.equal(giudizio(M({p48: SOGLIE.abbondante}), null).txt, "Neve fresca abbondante");
  assert.equal(giudizio(M({n72: SOGLIE.abbondante}), null).txt, "Bella nevicata in arrivo");
  assert.equal(giudizio(M({p48: SOGLIE.poca}), null).txt, "Un po' di neve fresca");
  assert.equal(giudizio(M({n72: SOGLIE.poca}), null).txt, "Un po' di neve in arrivo");
  assert.equal(giudizio(M({p48: 4.9, n72: 4.9}), null).txt, "Niente neve nuova");
  assert.equal(giudizio(M({p48: 25, n72: 40}), null).txt, "Neve fresca abbondante", "la neve già caduta conta prima di quella in arrivo");
});
test("giudizio: avvisi per valanghe marcate, vento e caldo", () => {
  const g = giudizio(M({p48: 30, w7: 60, temp: 5}), {level: 3});
  assert.equal(g.avvisi.length, 3);
  assert.equal(giudizio(M(), {level: 2}).avvisi.length, 0);
  assert.equal(giudizio(M({w7: null}), null).avvisi.length, 0, "vento mancante non genera avvisi");
});
