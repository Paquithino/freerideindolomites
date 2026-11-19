/* La calibrazione completa (scripts/calibra.mjs) con i dati neve del Centro Valanghe di Arabba,
   su una rete finta: i modelli "prevedono" la neve vera moltiplicata per fattori noti,
   quindi la calibrazione deve ritrovarli. Se le finestre orarie fossero sfasate di un giorno,
   i fattori uscirebbero sbagliati e questo test fallirebbe. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { FATTORI } from "../fixtures/rete-finta-calibra.mjs";

const dir = await mkdtemp(join(tmpdir(), "calibra-"));
const { stdout } = await promisify(execFile)(process.execPath, ["--import", "./tests/fixtures/rete-finta-calibra.mjs", "scripts/calibra.mjs"],
  {env: {...process.env, ARCHIVIO_DIR: dir, PAUSA_OPENMETEO: "0"}, maxBuffer: 1e7});
const res = JSON.parse(await readFile(join(dir, "calibrazione.json"), "utf8"));
test.after(() => rm(dir, {recursive: true, force: true}));

test("dati ARPAV: tutte le stazioni del Centro Valanghe entrano nella calibrazione", () => {
  const ve = res.stazioni.filter(s => s.rete === "Veneto");
  assert.equal(ve.length, 12, ve.map(s => s.name).join(", "));
  assert.ok(ve.some(s => s.name === "Arabba"), "stazione manuale di Arabba");
  assert.ok(res.perZona.ve && res.perZona.ve.giornate > 1000, `giornate Veneto: ${res.perZona.ve && res.perZona.ve.giornate}`);
  assert.match(stdout, /stazioni Veneto \(Centro Valanghe di Arabba\)/);
});

test("finestre allineate: la calibrazione ritrova i fattori nascosti nei modelli finti", () => {
  const nascosto = {icon: FATTORI.icon_seamless, icon2i: FATTORI.italia_meteo_arpae_icon_2i, ecmwf: FATTORI.ecmwf_ifs, gfs: FATTORI.gfs_seamless, mf: FATTORI.meteofrance_seamless};
  const gm = Math.exp(Object.values(nascosto).reduce((s, k) => s + Math.log(k), 0) / 5);
  for(const [id, k] of Object.entries(nascosto)){
    const atteso = gm / k, f = res.models[id].factor;
    assert.ok(Math.abs(f - atteso) < 0.05, `${id}: fattore ${f.toFixed(3)}, atteso ${atteso.toFixed(3)}`);
  }
});

test("inverno in corso senza dati: saltato senza errori", () => {
  assert.match(stdout, /nessun dato misurato: salto/);
  assert.match(res.fonti, /Centro Valanghe di Arabba/);
});

test("fattori per zona: zona Veneto calcolata e assegnata agli spot vicini, Friuli compreso", () => {
  assert.ok(res.zone && res.zone.ve, "zona Veneto");
  assert.equal(res.zone.ve.stazioni, 12);
  for(const m of Object.values(res.zone.ve.models)) assert.ok(m.factor >= 0.6 && m.factor <= 1.6);
  assert.ok(Object.values(res.spotZona).every(z => z === "ve"), "c'è solo la rete Veneto");
  assert.equal(res.spotZona.sappada, "ve", "Friuli → Veneto");
  assert.match(stdout, /zona Veneto: icon ×/);
});
