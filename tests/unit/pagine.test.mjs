import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, cp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leggiPercorso, daHash, tutteLeRotte, metaPer, coverHTML, percorsoArea, AREE } from "../../js/pagine.js";
import { SPOTS } from "../../js/config.js";

test("indirizzi: ogni percorso porta alla vista giusta", () => {
  assert.deepEqual(leggiPercorso(""), {vista: "home", path: ""});
  assert.deepEqual(leggiPercorso("/index.html"), {vista: "home", path: ""});
  assert.equal(leggiPercorso("spot/").vista, "lista");
  assert.deepEqual(leggiPercorso("spot/veneto/"), {vista: "lista", area: "Veneto", path: "spot/veneto/"});
  assert.deepEqual(leggiPercorso("spot/friuli"), {vista: "lista", area: "Friuli VG", path: "spot/friuli/"}, "senza barra finale");
  assert.deepEqual(leggiPercorso("spot/cortina/"), {vista: "spot", id: "cortina", path: "spot/cortina/"});
  assert.equal(leggiPercorso("pianifica/").vista, "previsione", "vecchio nome della sezione");
  assert.equal(leggiPercorso("spot/non-esiste/").sconosciuto, true);
  assert.equal(leggiPercorso("qualcosa/").vista, "home");
});

test("vecchi link con #: diventano indirizzi veri", () => {
  assert.equal(daHash("#spot-cortina"), "spot/cortina/");
  assert.equal(daHash("#spot-inventato"), "");
  assert.equal(daHash("#pianifica"), "previsione/");
  assert.equal(daHash("#valanghe"), "valanghe/");
  assert.equal(daHash("#spot"), "");
  assert.equal(daHash(""), null);
  assert.equal(daHash("#contenuto"), null, "un'ancora qualsiasi non è una pagina");
});

test("nessuno spot ha l'id di una zona (gli indirizzi non si scontrano)", () => {
  for(const a of AREE) assert.ok(!SPOTS.some(s => s.id === a.slug), a.slug);
});

test("tutte le pagine: titolo e descrizione unici, lunghezze adatte a Google", () => {
  const rotte = tutteLeRotte();
  assert.equal(rotte.length, 1 + 1 + AREE.length + SPOTS.length + 3);
  const titoli = new Set(), desc = new Set();
  for(const r of rotte){
    const m = metaPer(r);
    assert.ok(m.title.length >= 25 && m.title.length <= 95, `${r.path}: titolo di ${m.title.length} caratteri`);
    assert.ok(m.description.length >= 70 && m.description.length <= 320, `${r.path}: descrizione di ${m.description.length} caratteri`);
    assert.ok(m.h1, r.path);
    titoli.add(m.title); desc.add(m.description);
  }
  assert.equal(titoli.size, rotte.length, "titoli duplicati");
  assert.equal(desc.size, rotte.length, "descrizioni duplicate");
});

test("copertina: un solo h1, pillole delle sezioni con quella attiva, spot con ritorno alla sua zona", () => {
  const h = coverHTML({vista: "valanghe", path: "valanghe/"}, "Giovedì");
  assert.equal((h.match(/<h1/g) || []).length, 1);
  assert.match(h, /<a href="valanghe\/" class="on" aria-current="page">Valanghe/);
  const s = coverHTML({vista: "spot", id: "cortina", path: "spot/cortina/"}, "", {fav: true});
  assert.match(s, /<h1>Cortina d&#39;Ampezzo<\/h1>/);
  assert.match(s, new RegExp(`href="${percorsoArea("Veneto")}" data-back`));
  assert.match(s, /data-fav="cortina"/);
  assert.match(coverHTML({vista: "home", path: ""}, ""), /<h1 class="sr">/, "in home il titolo c'è per Google ma non si vede");
  assert.doesNotMatch(s + h, /href="#/, "niente link con # (con il tag <base> porterebbero alla home)");
});

/* ---------- generatore delle pagine statiche ---------- */
const dir = await mkdtemp(join(tmpdir(), "pagine-"));
await mkdir(join(dir, "html"), {recursive: true});
await cp("index.html", join(dir, "index.html")); await cp("html/info.html", join(dir, "html/info.html")); await cp("html/precipitazioni.html", join(dir, "html/precipitazioni.html"));
await mkdir(join(dir, "dati"));
await promisify(execFile)(process.execPath, ["scripts/aggiorna-dati.mjs", "--demo"], {env: {...process.env, OUT_FILE: join(dir, "dati/ultimo.json"), ARCHIVIO_DIR: join(dir, "arch")}});
const { stdout } = await promisify(execFile)(process.execPath, ["scripts/genera-pagine.mjs", dir], {env: {...process.env, SITO_URL: "https://www.esempio.it/"}});
const leggi = p => readFile(join(dir, p), "utf8");
test.after(() => rm(dir, {recursive: true, force: true}));

test("generatore: una pagina per ogni indirizzo, più guida, 404, sitemap e robots", async () => {
  assert.match(stdout, /pagine create: 37/);
  for(const r of tutteLeRotte()) assert.ok((await stat(join(dir, r.path, "index.html"))).isFile(), r.path);
  for(const f of ["guida/index.html", "precipitazioni/index.html", "404.html", "sitemap.xml", "robots.txt"]) assert.ok((await stat(join(dir, f))).isFile(), f);
  const sm = await leggi("sitemap.xml");
  assert.equal((sm.match(/<loc>/g) || []).length, tutteLeRotte().length + 2);
  assert.match(sm, /<loc>https:\/\/www\.esempio\.it\/precipitazioni\/<\/loc>/);
  const pc = await leggi("precipitazioni/index.html");
  assert.match(pc, /<title>Animazione precipitazioni e neve Dolomiti – ora per ora \| FreeRide in Dolomites<\/title>/);
  assert.match(pc, /<link rel="canonical" href="https:\/\/www\.esempio\.it\/precipitazioni\/"/);
  assert.doesNotMatch(pc, /"\.\.\/(assets|js|css)\//);
  assert.match(sm, /<loc>https:\/\/www\.esempio\.it\/spot\/cortina\/<\/loc>/);
  assert.match(await leggi("robots.txt"), /Sitemap: https:\/\/www\.esempio\.it\/sitemap\.xml/);
});

test("generatore: pagina spot con titolo, canonico, base, h1 e testo già scritto", async () => {
  const h = await leggi("spot/cortina/index.html");
  assert.match(h, /<base href="\/">/);
  assert.match(h, /<title>Cortina d&#39;Ampezzo: neve, meteo e valanghe per il freeride \| FreeRide in Dolomites<\/title>/);
  assert.match(h, /<link rel="canonical" href="https:\/\/www\.esempio\.it\/spot\/cortina\/"/);
  assert.match(h, /<meta property="og:url" content="https:\/\/www\.esempio\.it\/spot\/cortina\/">/);
  assert.equal((h.match(/<h1/g) || []).length, 1);
  assert.match(h, /<section class="view on" id="v-detail">/);
  assert.match(h, /Previsioni · prossimi 10 giorni/);
  assert.match(h, /Ultime 48 ore: <b>\d+ cm<\/b>/);
  assert.match(h, /<h2 class="gh" id="s-dati-t">.*Dati raccolti<\/h2>[\s\S]*Previsioni<\/h2>[\s\S]*Valanghe<\/h2>/);
  assert.match(h, /href="spot\/arabba\/"/, "link agli altri spot della zona");
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const tipi = ld["@graph"].map(x => x["@type"]);
  assert.ok(tipi.includes("Place") && tipi.includes("BreadcrumbList") && tipi.includes("WebPage"), tipi.join(","));
});

test("generatore: liste di zona con link veri, home con In breve, 404 non indicizzata", async () => {
  const v = await leggi("spot/veneto/index.html");
  assert.equal((v.match(/<a class="card" href="spot\//g) || []).length, SPOTS.filter(s => s.area === "Veneto").length);
  assert.match(await leggi("index.html"), /In breve/);
  const nf = await leggi("404.html");
  assert.match(nf, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(nf, /rel="canonical"/);
});

test("generatore: sito in una sottocartella (GitHub Pages)", async () => {
  const d2 = await mkdtemp(join(tmpdir(), "pagine2-"));
  await mkdir(join(d2, "html")); await cp("index.html", join(d2, "index.html")); await cp("html/info.html", join(d2, "html/info.html"));
  await promisify(execFile)(process.execPath, ["scripts/genera-pagine.mjs", d2], {env: {...process.env, SITO_URL: "https://utente.github.io/repo"}});
  const h = await readFile(join(d2, "valanghe/index.html"), "utf8");
  assert.match(h, /<base href="\/repo\/">/);
  assert.match(h, /href="https:\/\/utente\.github\.io\/repo\/valanghe\/"/);
  const g = await readFile(join(d2, "guida/index.html"), "utf8");
  assert.match(g, /<base href="\/repo\/">/);
  assert.doesNotMatch(g, /"\.\.\/(assets|js|css)\//, "la guida non deve puntare alla cartella sopra la radice");
  await rm(d2, {recursive: true, force: true});
});
