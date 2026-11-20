import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { griglia, quotaParte, campionaCampo, valoreIn, colore, tipoDa, lineaNeve, indiceAdesso, datiFinti } from "../../js/precip-dati.js";
import { aggiornaPrecipitazioni, scaricaGriglia, MODELLI, BLOCCO } from "../../scripts/precipitazioni.mjs";

test("griglia 0,1° su Dolomiti e Friuli: 13 × 31 = 403 punti, dentro i limiti di Open-Meteo", () => {
  const g = griglia();
  assert.equal(g.nLat, 13); assert.equal(g.nLon, 31); assert.equal(g.punti.length, 403);
  assert.deepEqual(g.punti[0], {lat: 45.9, lon: 10.9});
  assert.deepEqual(g.punti[402], {lat: 47.1, lon: 13.9});
  // ogni 3 ore al massimo: 8 giri × 403 punti
  assert.ok(8 * g.punti.length < 10000 / 2, "meno di metà del limite giornaliero gratuito");
});

test("neve o pioggia: parte nevosa da neve fresca (cm) e precipitazione (mm)", () => {
  assert.equal(quotaParte(1, 0.7), 10, "7 cm di neve = 10 mm d'acqua → tutta neve");
  assert.equal(quotaParte(2, 0), 0);
  assert.equal(quotaParte(2, 0.7), 5);
  assert.equal(quotaParte(0, 0), 0);
  assert.equal(tipoDa(1), "neve"); assert.equal(tipoDa(0.5), "mista"); assert.equal(tipoDa(0.1), "pioggia");
});

test("interpolazione bilineare e fuori griglia", () => {
  const g = {lat0: 46, lon0: 11, passo: 1, nLat: 2, nLon: 2};
  const riga = [0, 10, 20, 30];
  assert.equal(campionaCampo(g, riga, 46.5, 11.5), 15);
  assert.equal(campionaCampo(g, riga, 46, 12), 10);
  assert.equal(campionaCampo(g, riga, 45.9, 11.5), null);
  assert.equal(campionaCampo(g, [0, null, 20, 30], 46.5, 11.5), null, "punto mancante = nessun dato inventato");
});

test("colori: niente sotto 0,1 mm/h; neve blu/viola, pioggia verde/gialla", () => {
  assert.equal(colore(0.05, 1), null);
  const neve = colore(3, 1), pioggia = colore(3, 0);
  assert.ok(neve[2] > neve[1], "neve: più blu che verde");
  assert.ok(pioggia[0] > 200 && pioggia[1] > 100 && pioggia[2] < 100, "pioggia forte: giallo/arancio");
  assert.ok(colore(8, 0)[3] > colore(0.2, 0)[3], "più intensa = più coprente");
});

test("limite neve: linea tra neve e pioggia solo dove precipita", () => {
  const d = {griglia: {lat0: 46, lon0: 11, passo: 0.1, nLat: 2, nLon: 2}, p: [[20, 20, 20, 20]], s: [[10, 0, 10, 0]]};
  const l = lineaNeve(d, 0);
  assert.equal(l.length, 1);
  assert.ok(Math.abs(l[0][0].lon - 11.05) < 1e-9 && Math.abs(l[0][1].lon - 11.05) < 1e-9);
  assert.equal(lineaNeve({...d, p: [[0, 0, 0, 0]]}, 0).length, 0);
});

test("valore in un punto e ora attuale", () => {
  const adesso = Date.UTC(2026, 10, 21, 10, 20), d = datiFinti(adesso);
  assert.equal(d.ore[indiceAdesso(d.ore, adesso)], "2026-11-21T10:00Z");
  const v = valoreIn(d, 40, 46.5, 11.9);
  assert.ok(v && v.mm >= 0 && v.neve >= 0 && v.neve <= 1 && v.quotaNeve >= 0);
  assert.equal(valoreIn(d, 40, 44, 11), null);
});

/* Open-Meteo finta: una risposta per blocco di punti */
function reteFinta({modelloKo = [], oreModello = {}, meta = null} = {}){
  const reg = [];
  const f = async url => {
    reg.push(url);
    if(url.includes("/static/meta.json")) return meta ? {ok: true, json: async () => meta} : {ok: false, status: 404};
    const q = new URL(url).searchParams, m = q.get("models"), n = q.get("latitude").split(",").length;
    if(modelloKo.includes(m)) return {ok: false, status: 502};
    const t0 = Date.UTC(2026, 10, 20, 10) - 24 * 3600e3, tot = 96, validi = oreModello[m] ?? tot;
    const time = Array.from({length: tot}, (_, k) => new Date(t0 + k * 3600e3).toISOString().slice(0, 16));
    const serie = v => time.map((_, k) => k < validi ? v : null);
    return {ok: true, json: async () => Array.from({length: n}, () => ({elevation: 1500, hourly: {time, precipitation: serie(2), snowfall: serie(0.7), freezing_level_height: serie(1800)}}))};
  };
  return {f, reg};
}

test("robot: ICON-2I, griglia a blocchi, file compatto con ore UTC", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prec-"));
  try{
    const {f, reg} = reteFinta({meta: {last_run_initialisation_time: Date.UTC(2026, 10, 20, 0) / 1000}});
    const r = await aggiornaPrecipitazioni({dir, fetchFn: f, adesso: Date.UTC(2026, 10, 20, 10, 30)});
    assert.equal(r.stato, "nuovo");
    assert.equal(reg.filter(u => u.includes("/v1/forecast")).length, Math.ceil(403 / BLOCCO));
    const d = JSON.parse(await readFile(join(dir, "precipitazioni/ultimo.json"), "utf8"));
    assert.equal(d.modello, MODELLI[0].id); assert.equal(d.corsa, "2026-11-20T00:00:00.000Z");
    assert.equal(d.ore.length, 96); assert.match(d.ore[0], /Z$/);
    assert.equal(d.p[0].length, 403); assert.equal(d.p[0][0], 20); assert.equal(d.s[0][0], 5); assert.equal(d.f[0][0], 18);
    // un'ora dopo: non riscarica
    const {f: f2, reg: reg2} = reteFinta();
    const r2 = await aggiornaPrecipitazioni({dir, fetchFn: f2, adesso: Date.UTC(2026, 10, 20, 11, 30)});
    assert.equal(r2.stato, "riuso"); assert.equal(reg2.length, 0);
    // 3 ore dopo ma stessa corsa del modello: non spende le 403 chiamate
    const {f: f3, reg: reg3} = reteFinta({meta: {last_run_initialisation_time: Date.UTC(2026, 10, 20, 0) / 1000}});
    const r3 = await aggiornaPrecipitazioni({dir, fetchFn: f3, adesso: Date.UTC(2026, 10, 20, 13, 40)});
    assert.equal(r3.stato, "riuso"); assert.equal(reg3.filter(u => u.includes("/v1/forecast")).length, 0);
  }finally{ await rm(dir, {recursive: true, force: true}); }
});

test("robot: ICON-2I giù → ICON-D2; modello troppo corto (< 48 h) scartato; tutto giù → ripubblica il vecchio", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prec-"));
  try{
    const adesso = Date.UTC(2026, 10, 20, 10, 30);
    const {f} = reteFinta({modelloKo: [MODELLI[0].id], oreModello: {icon_d2: 24 + 30}});
    const r = await aggiornaPrecipitazioni({dir, fetchFn: f, adesso, forza: true});
    assert.equal(r.dati.modello, "ecmwf_ifs025", "ICON-D2 con 30 ore avanti non basta");
    const {f: giu} = reteFinta({modelloKo: MODELLI.map(m => m.id)});
    const r2 = await aggiornaPrecipitazioni({dir, fetchFn: giu, adesso: adesso + 4 * 3600e3});
    assert.equal(r2.stato, "riuso");
    const vuota = await mkdtemp(join(tmpdir(), "prec-"));
    const r3 = await aggiornaPrecipitazioni({dir: vuota, fetchFn: giu, adesso});
    assert.equal(r3.stato, "vuoto");
    await rm(vuota, {recursive: true, force: true});
  }finally{ await rm(dir, {recursive: true, force: true}); }
});

test("scaricaGriglia: risposta con punti mancanti = errore (niente griglia storta)", async () => {
  const f = async () => ({ok: true, json: async () => [{elevation: 1, hourly: {time: [], precipitation: [], snowfall: [], freezing_level_height: []}}]});
  await assert.rejects(() => scaricaGriglia(MODELLI[0], f));
});
