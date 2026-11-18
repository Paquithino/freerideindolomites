import { test } from "node:test";
import assert from "node:assert/strict";
import { viste, urlVista, peakvisorHTML, PV_BASE, statoPeakvisor } from "../../js/peakvisor.js";
import { state } from "../../js/state.js";
import { SPOTS } from "../../js/config.js";

test("url PeakVisor: coordinate e parametri nei limiti dell'API", () => {
  const u = new URL(urlVista({lat: 46.5405, lng: 12.1357, alt: 3500.4, yaw: 250, pitch: -120, hfov: 300}));
  assert.equal(u.origin + u.pathname, PV_BASE);
  assert.equal(u.searchParams.get("lat"), "46.54050");
  assert.equal(u.searchParams.get("alt"), "3500");
  assert.equal(u.searchParams.get("yaw"), "180.0");
  assert.equal(u.searchParams.get("pitch"), "-90.0");
  assert.equal(u.searchParams.get("hfov"), "140");
  assert.equal(new URL(urlVista({lat: 1, lng: 2})).searchParams.has("alt"), false, "senza alt la camera sta a terra");
});

test("ogni spot ha almeno due inquadrature, quella dall'alto sopra la vetta", () => {
  for(const s of SPOTS){
    const v = viste(s);
    assert.ok(v.length >= 2, s.id);
    const alto = v.find(x => x.nome === "Dall'alto");
    assert.ok(alto.alt > s.q.top, `${s.id}: ${alto.alt} ≤ ${s.q.top}`);
  }
});

test("inquadratura personalizzata in config viene per prima", () => {
  const s = {...SPOTS[0], pv: {nome: "Canale Holzer", lat: 46.5, lng: 11.8, alt: 2900, yaw: 30, pitch: -10, hfov: 60}};
  assert.equal(viste(s)[0].nome, "Canale Holzer");
  assert.match(peakvisorHTML(s), /Canale Holzer/);
});

test("il 3D non si carica da solo e cita PeakVisor", () => {
  const h = peakvisorHTML(SPOTS[0]);
  assert.doesNotMatch(h, /<iframe/);
  assert.match(h, /data-pvplay="https:\/\/peakvisor\.com\/embed\?/);
  assert.match(h, /© <a href="https:\/\/peakvisor\.com"/);
});

test("se il robot trova PeakVisor giù o non incorporabile: link in nuova scheda, niente riquadro vuoto", () => {
  const s = SPOTS[0];
  state.camCheck = null; assert.equal(statoPeakvisor(), "ok");
  state.camCheck = {cams: {}, peakvisor: {ok: true}}; assert.match(peakvisorHTML(s), /data-pvplay/);
  for(const [pv, testo, stato] of [[{ok: false, why: "HTTP 503"}, /non risponde/, "giu"], [{ok: true, noFrame: true}, /nuova scheda/, "esterno"]]){
    state.camCheck = {cams: {}, peakvisor: pv};
    assert.equal(statoPeakvisor(), stato);
    const h = peakvisorHTML(s);
    assert.doesNotMatch(h, /data-pvplay|data-pvfull/);
    assert.match(h, testo);
    assert.equal((h.match(/target="_blank"[^>]*>⛰/g) || []).length, viste(s).length, "un link per ogni inquadratura");
    assert.match(h, /© <a href="https:\/\/peakvisor\.com"/);
  }
  state.camCheck = null;
});
