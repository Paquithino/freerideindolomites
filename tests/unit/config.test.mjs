import { test } from "node:test";
import assert from "node:assert/strict";
import { SPOTS, AREAS, MODELS, PROVIDERS, PROV_NAME, WORKER_URL } from "../../js/config.js";

/* Controlli di coerenza sulla configurazione: errori qui = schede rotte nel sito */
test("ogni spot ha un id unico e in formato url", () => {
  const ids = SPOTS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length, "id duplicati");
  for(const id of ids) assert.match(id, /^[a-z0-9-]+$/, id);
});

test("coordinate dentro Dolomiti / Friuli / Carinzia", () => {
  for(const s of SPOTS){
    assert.ok(s.lat > 45.9 && s.lat < 47.0, `${s.id} lat ${s.lat}`);
    assert.ok(s.lon > 10.6 && s.lon < 13.8, `${s.id} lon ${s.lon}`);
    assert.ok(s.elev >= 1000 && s.elev <= 3400, `${s.id} quota ${s.elev}`);
  }
});

test("area valida per ogni spot (i filtri della home devono trovarlo)", () => {
  const ok = AREAS.filter(a => a !== "Tutti" && a !== "★ Preferiti");
  for(const s of SPOTS) assert.ok(ok.includes(s.area), `${s.id}: area "${s.area}"`);
  for(const a of ok) assert.ok(SPOTS.some(s => s.area === a), `area vuota: ${a}`);
});

test("quote vetta > metà > base, metà a metà strada (±200 m)", () => {
  for(const s of SPOTS){
    assert.ok(s.q, `${s.id} senza quote`);
    const {top, mid, base} = s.q;
    assert.ok(top > mid && mid > base, `${s.id}: ${top}/${mid}/${base}`);
    assert.ok(Math.abs(mid - (top + base) / 2) <= 200, `${s.id}: metà ${mid} lontana dal centro`);
    assert.ok(top - base >= 300, `${s.id}: dislivello troppo piccolo`);
  }
});

test("bollettino valanghe: servizio esistente e un modo per trovare la zona", () => {
  for(const s of SPOTS){
    assert.ok(s.av && s.av.p.length, `${s.id} senza servizio valanghe`);
    for(const p of s.av.p) assert.ok(PROVIDERS.includes(p) && PROV_NAME[p], `${s.id}: servizio ${p}`);
    assert.ok(s.av.ids.length + s.av.kw.length > 0, `${s.id}: né id né parole chiave per la zona`);
  }
});

test("webcam: url https, titolo, fonte citata per le immagini", () => {
  for(const s of SPOTS) for(const c of s.cams){
    const url = c.img || c.embed || c.u;
    assert.ok(url, `${s.id}: webcam senza url`);
    assert.match(url, /^https:\/\//, `${s.id}: ${url}`);
    assert.ok(c.t && c.t.length > 2, `${s.id}: webcam senza titolo`);
    if(c.img || c.embed) assert.ok(c.src, `${s.id}: "${c.t}" senza credito al gestore (©)`);
  }
});

test("modelli: id unici e almeno un nome Open-Meteo", () => {
  assert.equal(new Set(MODELS.map(m => m.id)).size, MODELS.length);
  for(const m of MODELS) assert.ok(m.names.length && m.label, m.id);
});

test("nessuna chiave o segreto nel repository pubblico", () => {
  assert.equal(typeof WORKER_URL, "string");
  const testo = JSON.stringify(SPOTS);
  assert.doesNotMatch(testo, /(api[_-]?key|token|secret|password)=/i);
});
