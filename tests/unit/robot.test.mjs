/* Il "robot" (scripts/aggiorna-dati.mjs) in modalità dimostrativa: genera il file letto dal sito.
   Gira in una cartella temporanea, non tocca public/dati né l'archivio vero. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { unpackTimes } from "../../js/state.js";
import { SPOTS } from "../../js/config.js";

const run = promisify(execFile);
const dir = await mkdtemp(join(tmpdir(), "freeride-"));
const OUT = join(dir, "ultimo.json");
const { stdout } = await run(process.execPath, ["scripts/aggiorna-dati.mjs", "--demo"], {env: {...process.env, OUT_FILE: OUT, ARCHIVIO_DIR: join(dir, "archivio")}});
const raw = await readFile(OUT, "utf8");
const snap = unpackTimes(JSON.parse(raw));
test.after(() => rm(dir, {recursive: true, force: true}));

test("robot: scrive il file e lo dichiara nel log", () => {
  assert.match(stdout, /scritto .*ultimo\.json/);
  assert.match(stdout, /fatto in/);
});
test("snapshot: campi principali e data recente", () => {
  for(const k of ["generated", "aggiornato", "wx", "ens", "quote", "av", "stations", "sources"]) assert.ok(k in snap, k);
  assert.equal(snap.demo, true);
  assert.ok(Date.now() - Date.parse(snap.generated) < 5 * 60e3);
});
test("snapshot: meteo e neve per quota per tutti gli spot", () => {
  for(const s of SPOTS){
    const w = snap.wx[s.id];
    assert.ok(w && w.hourly && w.daily, s.id);
    assert.equal(w.hourly.time.length, w.hourly.temperature_2m.length, `${s.id}: orari e valori di lunghezza diversa`);
    assert.ok(snap.quote[s.id] && snap.quote[s.id].lv.top && snap.quote[s.id].lv.base, `${s.id} quote`);
  }
});
test("snapshot: leggero (sotto 1,5 MB) e con orari compressi", () => {
  assert.ok(raw.length < 1.5e6, `${(raw.length / 1e6).toFixed(2)} MB`);
  assert.match(raw, /"@h":/);
  // tutti i numeri arrotondati a un decimale (tranne i fattori di calibrazione)
  const troppi = [];
  const senzaCal = JSON.parse(raw); delete senzaCal.cal;
  JSON.parse(JSON.stringify(senzaCal), (k, v) => { if(typeof v === "number" && Math.abs(v * 10 - Math.round(v * 10)) > 1e-6) troppi.push(k + "=" + v); return v; });
  assert.equal(troppi.length, 0, troppi.slice(0, 5).join(", "));
});
test("snapshot: il pericolo valanghe non viene mai simulato", () => {
  assert.deepEqual(snap.av, {});
});
test("archivio giornaliero: scritto con la previsione di ogni spot", async () => {
  const files = await readdir(join(dir, "archivio"));
  assert.equal(files.length, 1);
  const a = JSON.parse(await readFile(join(dir, "archivio", files[0]), "utf8"));
  assert.equal(Object.keys(a.spots).length, SPOTS.length);
  assert.ok(a.spots[SPOTS[0].id].forecast.length >= 5);
});
