import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ORA, ORE_STORICO, msDaRoma, romaLocale, etichettaGiorno, daColonne, aColonne, taglia, inserisci, oreMancanti,
  riassuntoGiorno, andamentoNeve, oreDelGiorno, oreDaMeteo, fileStazione } from "../../js/storico.js";
import { aggiornaStorico, MAX_FILE_EUREGIO } from "../../scripts/storico.mjs";
import { oreStazione } from "../../js/stazioni-arpav.js";
import { urlOraEuregio } from "../../js/stazioni.js";

test("ora italiana: solare, legale e cambio d'ora", () => {
  assert.equal(new Date(msDaRoma("2026-11-20T10:00")).toISOString(), "2026-11-20T09:00:00.000Z");
  assert.equal(new Date(msDaRoma("2026-07-20T10:00")).toISOString(), "2026-07-20T08:00:00.000Z");
  assert.equal(romaLocale(Date.UTC(2026, 9, 25, 0)), "2026-10-25T02:00");    // ultima ora legale
  assert.equal(romaLocale(Date.UTC(2026, 9, 25, 1)), "2026-10-25T02:00");    // 02:00 ripetuta (solare)
  assert.equal(etichettaGiorno("2026-11-18"), "Mer 18 nov");
});

test("colonne: andata e ritorno, buchi restano vuoti, colonne vuote tolte", () => {
  const m = new Map(), t0 = Date.UTC(2026, 10, 20, 0);
  inserisci(m, t0, {t: -3.14, hs: 50});
  inserisci(m, t0 + 3 * ORA, {t: -5, hs: null});
  const j = aColonne(m, ["t", "hs", "w"], {id: "x"});
  assert.equal(j.inizio, "2026-11-20T00:00Z");
  assert.equal(j.ore, 4);
  assert.deepEqual(j.t, [-3.1, null, null, -5]);
  assert.deepEqual(j.hs, [50, null, null, null]);
  assert.equal(j.w, undefined);
  const back = daColonne(j);
  assert.equal(back.size, 2, "le ore vuote non diventano dati");
  assert.deepEqual(back.get(t0 + 3 * ORA), {t: -5});
});

test("finestra di 14 giorni: niente futuro, niente oltre il limite; ore mancanti contate", () => {
  const adesso = Date.UTC(2026, 10, 20, 9, 30), m = new Map();
  for(let h = -400; h <= 10; h++) inserisci(m, Date.UTC(2026, 10, 20, 9) + h * ORA, {t: h});
  taglia(m, adesso);
  assert.equal(m.size, ORE_STORICO + 1);
  assert.equal(Math.max(...m.keys()), Date.UTC(2026, 10, 20, 9));
  m.delete(Date.UTC(2026, 10, 20, 5));
  assert.deepEqual(oreMancanti(m, adesso), [Date.UTC(2026, 10, 20, 5)]);
});

test("inserisci: sovrascrive o riempie solo i buchi", () => {
  const m = new Map(), t = 0;
  inserisci(m, t, {t: 1});
  inserisci(m, t, {t: 2}, false);
  assert.equal(m.get(t).t, 1);
  inserisci(m, t, {t: 3, hs: 10});
  assert.deepEqual(m.get(t), {t: 3, hs: 10});
  inserisci(m, 5, {t: null, hs: NaN});
  assert.equal(m.has(5), false, "record senza valori non inseriti");
});

test("riassunto del giorno: neve fresca dall'aumento di altezza, min/max, vento; giorno vuoto = null", () => {
  const m = new Map();
  const g = "2026-11-18";
  // giorno prima: 80 cm a fine giornata
  for(let h = 0; h < 24; h++) inserisci(m, msDaRoma(`2026-11-17T${String(h).padStart(2, "0")}:00`), {hs: 80, t: -2});
  // nevica: da 80 a 105, poi si assesta a 100
  for(let h = 0; h < 24; h++) inserisci(m, msDaRoma(`${g}T${String(h).padStart(2, "0")}:00`), {hs: h < 12 ? 80 + h * 25 / 11 : 100, t: -h / 2, w: 10 + h, wx: 20 + h});
  const r = riassuntoGiorno(m, g);
  assert.equal(r.hs, 100);
  assert.equal(Math.round(r.nuova), 25);
  assert.equal(r.tmin, -11.5); assert.equal(r.tmax, -0);
  assert.equal(Math.round(r.wmed), 22); assert.equal(r.wmax, 43);
  const v = riassuntoGiorno(m, "2026-11-10");
  assert.equal(v.hs, null); assert.equal(v.nuova, null); assert.equal(v.ore, 0);
  const a = andamentoNeve(m, g, 3);
  assert.deepEqual(a.map(x => x.hs), [null, null, 80, 100]);
  const ore = oreDelGiorno(m, g);
  assert.equal(ore.length, 24); assert.equal(ore[0].ora, "00"); assert.equal(ore[23].r.hs, 100);
});

test("dal meteo orario (ora italiana) ai record: neve corretta, altezza in cm", () => {
  const H = {time: ["2026-11-20T09:00", "2026-11-20T10:00"], temperature_2m: [-4, -5], snowfall: [1, 2], snow_c: [1.5, 2.5], snow_depth: [0.8, 0.82],
    wind_speed_700hPa: [30, 40], wind_direction_700hPa: [180, 190], wind_gusts_10m: [50, 60]};
  const o = oreDaMeteo(H, Date.UTC(2026, 10, 20, 8));
  assert.equal(o.length, 1, "solo le ore già passate");
  assert.deepEqual(o[0][1], {t: -4, n: 1.5, hs: 80, w: 30, d: 180, g: 50});
});

test("ARPAV: ore piene dalla serie ogni 30 minuti, vento in m/s convertito", () => {
  let liv = "", tmp = "", vv = "";
  const t0 = Date.UTC(2026, 11, 1, 0);
  for(let k = 0; k <= 8; k++){
    const s = new Date(t0 + k * 1800e3 + 3600e3).toISOString().replace(/[-T:]/g, "").slice(0, 12);
    liv += `<DATI ISTANTE="${s}"><VM>${100 + k}</VM></DATI>`; tmp += `<DATI ISTANTE="${s}"><VM>-${k}</VM></DATI>`; vv += `<DATI ISTANTE="${s}"><VM>5</VM></DATI>`;
  }
  const xml = `<STAZIONE><SENSORE><TYPE>LIVNEVE</TYPE>${liv}</SENSORE><SENSORE><TYPE>TEMP</TYPE>${tmp}</SENSORE><SENSORE><TYPE>VV</TYPE><DESC>Velocità vento media</DESC><UNIT>m/s</UNIT>${vv}</SENSORE></STAZIONE>`;
  const o = oreStazione(xml);
  assert.equal(o.length, 5);
  assert.equal(o[0][0], t0);
  assert.equal(o[2][1].w, 18);
});

/* robot: rete finta (Open-Meteo, file orari Euregio) e cartella temporanea */
function reteFinta(adesso, registro){
  return async (url) => {
    registro.push(url);
    if(url.includes("api.open-meteo.com")){
      const ore = [];
      const a0 = Math.floor(adesso / ORA) * ORA;
      for(let t = a0 - 15 * 24 * ORA; t <= a0 + 24 * ORA; t += ORA) ore.push(romaLocale(t));
      const h = {time: ore, temperature_2m: ore.map(() => -5), snowfall: ore.map(() => 0.2), snow_depth: ore.map(() => 0.5),
        wind_speed_700hPa: ore.map(() => 20), wind_direction_700hPa: ore.map(() => 270), wind_gusts_10m: ore.map(() => 30)};
      return {ok: true, status: 200, json: async () => [{hourly: h}]};
    }
    if(url.includes("avalanche.report")){
      if(/_0[0-5]-00_/.test(url)) return {ok: false, status: 404};   // alcuni file orari non esistono
      return {ok: true, status: 200, json: async () => ({features: [{properties: {"LWD-Nummer": "EU1", name: "Stazione EU", HS: 70, LT: -3, VW: 12, VW_MAX: 30, DW: 200}, geometry: {coordinates: [11.8, 46.5, 2200]}}]})};
    }
    return {ok: false, status: 404};
  };
}

test("robot: primo avvio riempie 14 giorni dello spot, poi un giro aggiunge solo l'ultima ora", async () => {
  const dir = await mkdtemp(join(tmpdir(), "storico-"));
  try{
    const adesso = Date.UTC(2026, 10, 20, 9, 10), reg = [];
    const spots = [{id: "s1", lat: 46.5, lon: 11.8, elev: 2000}];
    const oraLoc = [romaLocale(Date.UTC(2026, 10, 20, 8)), romaLocale(Date.UTC(2026, 10, 20, 9)), romaLocale(Date.UTC(2026, 10, 20, 10))];
    const wx = {s1: {hourly: {time: oraLoc, temperature_2m: [-1, -2, -3], snow_c: [0, 1, 2], snow_depth: [0.6, 0.61, 0.62], wind_speed_700hPa: [10, 11, 12], wind_direction_700hPa: [0, 0, 0], wind_gusts_10m: [5, 5, 5]}}};
    const st = {id: "EU1", name: "Stazione EU", operator: "", hs: 71, lt: -4, date: new Date(adesso).toISOString(), elev: 2200, lat: 46.5, lon: 11.8};
    const ar = {id: "ARPAV-1", name: "Faloria", operator: "ARPAV", hs: 90, lt: -6, date: new Date(adesso).toISOString(), ore: [[Date.UTC(2026, 10, 20, 7), {hs: 88, t: -5}]]};
    const r = await aggiornaStorico({spots, wx, stazioni: [st, ar], perSpot: () => [st, ar], dir, fetchFn: reteFinta(adesso, reg), adesso});
    const s1 = r.spot.s1;
    assert.equal(s1.size, ORE_STORICO + 1, "14 giorni pieni + l'ora attuale");
    assert.equal(s1.get(Date.UTC(2026, 10, 20, 9)).t, -2, "l'ultimo meteo vince sul riempimento");
    assert.equal(s1.has(Date.UTC(2026, 10, 20, 10)), false, "niente ore future");
    assert.equal(r.stazioni["ARPAV-1"].get(Date.UTC(2026, 10, 20, 7)).hs, 88);
    const eu = r.stazioni.EU1;
    assert.equal(eu.get(Date.UTC(2026, 10, 20, 9)).hs, 71, "misura attuale");
    assert.equal(reg.filter(u => u.includes("avalanche.report")).length, MAX_FILE_EUREGIO, "file orari a gruppi, non tutti insieme");
    assert.ok(r.indice.euregioAssenti.length >= 1, "i file assenti si ricordano");
    const file = JSON.parse(await readFile(join(dir, "storico/spot/s1.json"), "utf8"));
    assert.equal(file.ore, ORE_STORICO + 1); assert.match(file.inizio, /Z$/);
    assert.ok(JSON.parse(await readFile(join(dir, `storico/stazioni/${fileStazione("ARPAV-1")}.json`), "utf8")).hs);
    // secondo giro un'ora dopo: niente Open-Meteo per lo storico (le ore ci sono già)
    const reg2 = [];
    const r2 = await aggiornaStorico({spots, wx, stazioni: [st], perSpot: () => [st], dir, fetchFn: reteFinta(adesso + ORA, reg2), adesso: adesso + ORA});
    assert.equal(reg2.filter(u => u.includes("open-meteo")).length, 0);
    assert.equal(r2.spot.s1.size, ORE_STORICO + 1, "la finestra scorre: entra un'ora, ne esce una");
    const giaAssenti = new Set(r.indice.euregioAssenti.map(urlOraEuregio));
    assert.equal(reg2.filter(u => giaAssenti.has(u)).length, 0, "i file assenti non si richiedono di nuovo");
  }finally{ await rm(dir, {recursive: true, force: true}); }
});

test("robot: Open-Meteo giù al primo avvio → nessun dato inventato, riprova al giro dopo", async () => {
  const dir = await mkdtemp(join(tmpdir(), "storico-"));
  try{
    const adesso = Date.UTC(2026, 10, 20, 9), msgs = [];
    const r = await aggiornaStorico({spots: [{id: "s1", lat: 46, lon: 11, elev: 2000}], wx: {}, perSpot: () => [], dir, adesso,
      fetchFn: async () => ({ok: false, status: 503}), log: (...a) => msgs.push(a.join(" "))});
    assert.equal(r.spot.s1.size, 0);
    assert.ok(msgs.some(m => /riprovo al prossimo giro/.test(m)));
  }finally{ await rm(dir, {recursive: true, force: true}); }
});
