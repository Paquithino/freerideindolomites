import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, r0, r1, snowColor, scoreColor, packTimes, unpackTimes, fetchRetry } from "../../js/state.js";

test("esc: neutralizza tutti i caratteri HTML pericolosi", () => {
  assert.equal(esc(`<script>"x" & 'y'</script>`), "&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;");
  assert.equal(esc(null), ""); assert.equal(esc(undefined), ""); assert.equal(esc(0), "0");
});

test("arrotondamenti: valori mancanti diventano un trattino", () => {
  assert.equal(r0(12.6), 13); assert.equal(r0(null), "–"); assert.equal(r0(NaN), "–");
  assert.equal(r1(3.14159), "3,1"); assert.equal(r1(undefined), "–");
});

test("colori: niente colore sotto 1 cm, scala crescente sopra", () => {
  assert.equal(snowColor(0.4), null);
  const c = [1, 5, 10, 20, 35].map(snowColor);
  assert.equal(new Set(c).size, c.length, "ogni fascia ha un colore diverso");
  assert.equal(scoreColor(8), scoreColor(7)); assert.notEqual(scoreColor(1), scoreColor(8));
});

test("packTimes/unpackTimes: orari e giorni fanno andata e ritorno identici", () => {
  const ore = Array.from({length: 72}, (_, i) => new Date(Date.UTC(2026, 10, 17, i)).toISOString().slice(0, 16));
  const giorni = Array.from({length: 10}, (_, i) => new Date(Date.UTC(2026, 10, 17 + i)).toISOString().slice(0, 10));
  const pacc = {hourly: {time: packTimes(ore)}, daily: {time: packTimes(giorni)}};
  assert.deepEqual(pacc.hourly.time, {"@h": ore[0], n: 72});
  assert.deepEqual(pacc.daily.time, {"@d": giorni[0], n: 10});
  const back = unpackTimes(JSON.parse(JSON.stringify(pacc)));
  assert.deepEqual(back.hourly.time, ore); assert.deepEqual(back.daily.time, giorni);
});

test("packTimes: una serie con un buco resta lista (non si perdono dati)", () => {
  const s = ["2026-11-17T00:00", "2026-11-17T01:00", "2026-11-17T03:00"];
  assert.deepEqual(packTimes(s), s);
  assert.deepEqual(packTimes(["a", "b"]), ["a", "b"]);
});

test("fetchRetry: riprova su 503 e restituisce la risposta buona", async () => {
  const orig = globalThis.fetch, origTO = globalThis.setTimeout;
  let n = 0;
  globalThis.setTimeout = (f) => origTO(f, 0);           // niente attese vere nel test
  globalThis.fetch = async () => (++n < 3 ? new Response("no", {status: 503}) : new Response("ok", {status: 200}));
  try{
    const r = await fetchRetry("https://esempio.test/x");
    assert.equal(r.status, 200); assert.equal(n, 3);
  }finally{ globalThis.fetch = orig; globalThis.setTimeout = origTO; }
});

test("fetchRetry: dopo i tentativi l'errore riporta la causa di rete", async () => {
  const orig = globalThis.fetch, origTO = globalThis.setTimeout;
  globalThis.setTimeout = (f) => origTO(f, 0);
  globalThis.fetch = async () => { const e = new TypeError("fetch failed"); e.cause = {code: "UND_ERR_CONNECT_TIMEOUT"}; throw e; };
  try{ await assert.rejects(fetchRetry("https://esempio.test/x"), /UND_ERR_CONNECT_TIMEOUT/); }
  finally{ globalThis.fetch = orig; globalThis.setTimeout = origTO; }
});
