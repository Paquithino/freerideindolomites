import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { prova, controllaWebcam } from "../../scripts/controlla-webcam.mjs";
import { SPOTS } from "../../js/config.js";
import { state } from "../../js/state.js";
import { camsHTML, camCard, camSrc } from "../../js/webcam.js";

/* finto server: ogni url restituisce quello che decidiamo noi */
let risposte, richieste, origFetch;
beforeEach(() => { origFetch = globalThis.fetch; risposte = {}; richieste = [];
  globalThis.fetch = async (url, opt) => { richieste.push({url, opt}); const f = risposte[url]; if(!f) throw Object.assign(new TypeError("fetch failed"), {cause: {code: "ENOTFOUND"}}); return f(); }; });
afterEach(() => { globalThis.fetch = origFetch; });
const img = (byte = 50000, headers = {}) => () => new Response(new Uint8Array(byte), {status: 200, headers: {"content-type": "image/jpeg", ...headers}});

test("immagine buona", async () => {
  risposte["https://c/ok.jpg"] = img();
  assert.deepEqual(await prova("https://c/ok.jpg", "img"), {ok: true});
});
test("immagine: 404, pagina html al posto dell'immagine, file vuoto", async () => {
  risposte["https://c/a"] = () => new Response("no", {status: 404});
  risposte["https://c/b"] = () => new Response("<html>", {status: 200, headers: {"content-type": "text/html; charset=utf-8"}});
  risposte["https://c/c"] = img(800);
  assert.match((await prova("https://c/a", "img")).why, /HTTP 404/);
  assert.match((await prova("https://c/b", "img")).why, /non è un'immagine \(text\/html\)/);
  assert.match((await prova("https://c/c", "img")).why, /immagine vuota/);
});
test("immagine ferma da giorni: resta visibile ma segnalata", async () => {
  const vecchia = new Date(Date.now() - 5 * 864e5).toUTCString();
  risposte["https://c/ferma.jpg"] = img(50000, {"last-modified": vecchia});
  const r = await prova("https://c/ferma.jpg", "img");
  assert.equal(r.ok, true); assert.ok(r.ferma); assert.match(r.why, /ferma da 5 giorni/);
});
test("server irraggiungibile: errore con la causa", async () => {
  const r = await prova("https://non-esiste/x.jpg", "img");
  assert.equal(r.ok, false); assert.match(r.why, /ENOTFOUND/);
});
test("le immagini si chiedono senza referer (come fa il sito)", async () => {
  risposte["https://c/ok.jpg"] = img();
  await prova("https://c/ok.jpg", "img");
  assert.ok(!("Referer" in richieste[0].opt.headers) && !("referer" in richieste[0].opt.headers));
});
test("panorama: incorporabile, bloccato da X-Frame-Options o da CSP", async () => {
  risposte["https://p/ok"] = () => new Response("<html>", {status: 200});
  risposte["https://p/xfo"] = () => new Response("<html>", {status: 200, headers: {"x-frame-options": "SAMEORIGIN"}});
  risposte["https://p/csp"] = () => new Response("<html>", {status: 200, headers: {"content-security-policy": "frame-ancestors 'self' https://panomax.com"}});
  risposte["https://p/cspok"] = () => new Response("<html>", {status: 200, headers: {"content-security-policy": "frame-ancestors *"}});
  assert.deepEqual(await prova("https://p/ok", "embed"), {ok: true});
  assert.equal((await prova("https://p/xfo", "embed")).noFrame, true);
  assert.equal((await prova("https://p/csp", "embed")).noFrame, true);
  assert.deepEqual(await prova("https://p/cspok", "embed"), {ok: true});
});
test("controllo completo: ogni webcam configurata viene provata una volta sola", async () => {
  const attese = new Set(SPOTS.flatMap(s => s.cams.map(c => c.img || c.embed).filter(Boolean)));
  for(const u of attese) risposte[u] = u.includes("panomax.com/") && !u.includes("panodata") ? () => new Response("<html>") : img();
  const righe = [];
  const r = await controllaWebcam(x => righe.push(x));
  assert.equal(Object.keys(r.cams).length, attese.size);
  assert.equal(richieste.length, attese.size);
  assert.match(righe[0], new RegExp(`${attese.size}/${attese.size} raggiungibili`));
});

/* ---------- come il sito usa il risultato ---------- */
const marmolada = SPOTS.find(s => s.id === "marmolada");
const [morta, ferma] = marmolada.cams.filter(c => c.img).map(c => c.img);
const pano = marmolada.cams.find(c => c.embed).embed;

test("sito: senza controllo mostra tutte le webcam", () => {
  state.camCheck = null;
  const h = camsHTML(marmolada);
  assert.equal((h.match(/class="cam"/g) || []).length, marmolada.cams.filter(c => c.img || c.embed).length);
});
test("sito: nasconde le morte, segnala le ferme, panorami bloccati in nuova scheda", () => {
  state.camCheck = {cams: {[morta]: {ok: false, why: "HTTP 404"}, [ferma]: {ok: true, ferma: "2026-11-10T08:00:00Z"}, [pano]: {ok: true, noFrame: true}}};
  const h = camsHTML(marmolada);
  assert.ok(!h.includes(morta)); assert.match(h, /ferma dal/);
  assert.match(h, /Una webcam è nascosta/);
  assert.match(h, new RegExp(`<a class="play" href="${pano.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}" target="_blank"`));
  state.camCheck = null;
});
test("sito: immagini con referrerpolicy no-referrer e aggiornamento ogni 5 minuti", () => {
  const h = camCard({t: "x", img: "https://c/x.jpg", src: "y"});
  assert.match(h, /referrerpolicy="no-referrer"/);
  assert.match(camSrc("https://c/x.jpg"), /\?_=\d+$/); assert.match(camSrc("https://c/x.jpg?a=1"), /&_=\d+$/);
});
