/* Versione inglese: indirizzi, traduzioni, dizionario completo */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { t, url, percorsoLogico, impostaLingua, linguaDaPercorso, traduciHTML, num } from "../../js/i18n.js";
import EN from "../../js/lingua-en.js";
import { badgeLingua } from "../../js/badge-lingua.js";

test("indirizzi: italiano ↔ inglese", () => {
  assert.equal(url("", "en"), "en/");
  assert.equal(url("previsione/", "en"), "en/forecast/");
  assert.equal(url("valanghe/", "en"), "en/avalanches/");
  assert.equal(url("webcam/", "en"), "en/webcams/");
  assert.equal(url("guida/", "en"), "en/guide/");
  assert.equal(url("contatti/", "en"), "en/contact/");
  assert.equal(url("precipitazioni/?spot=cortina", "en"), "en/precipitation/?spot=cortina");
  assert.equal(url("spot/cortina/", "en"), "en/spot/cortina/");
  assert.equal(url("spot/cortina/", "it"), "spot/cortina/");
  assert.deepEqual(percorsoLogico("en/forecast/"), {lingua: "en", percorso: "previsione/"});
  assert.deepEqual(percorsoLogico("en/"), {lingua: "en", percorso: ""});
  assert.deepEqual(percorsoLogico("/en/spot/sella/"), {lingua: "en", percorso: "spot/sella/"});
  assert.deepEqual(percorsoLogico("valanghe/"), {lingua: "it", percorso: "valanghe/"});
  assert.equal(linguaDaPercorso("entrata/"), "it", "solo il prefisso en/ conta");
});

test("t(): traduce in inglese, lascia l'italiano se manca, inserisce i valori", () => {
  impostaLingua("it");
  assert.equal(t("Oggi"), "Oggi");
  assert.equal(t("{n} giorni fa", {n: 3}), "3 giorni fa");
  impostaLingua("en");
  assert.equal(t("Oggi"), "Today");
  assert.equal(t("{n} giorni fa", {n: 3}), "3 days ago");
  assert.equal(t("testo che non c'è"), "testo che non c'è");
  assert.equal(num(12450), "12,450");
  assert.match(traduciHTML('<a href="x" aria-label="Apri il menu">Previsione</a>'), /aria-label="Open menu">Forecast</);
  impostaLingua("it");
  assert.equal(num(12450), "12.450");
});

test("dizionario: ogni testo passato a t() nel codice ha la traduzione inglese", () => {
  const re = /\b(?:t|tr)\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\$]|\\.)*`)/g, mancano = [];
  for(const f of readdirSync("js").filter(f => f.endsWith(".js") && f !== "lingua-en.js" && f !== "i18n.js")){
    for(const m of readFileSync("js/" + f, "utf8").matchAll(re)){
      const k = m[1][0] === "`" ? m[1].slice(1, -1) : JSON.parse(m[1][0] === "'" ? '"' + m[1].slice(1, -1).replace(/"/g, '\\"') + '"' : m[1]);
      if(EN[k] == null) mancano.push(`${f}: ${k}`);
    }
  }
  assert.deepEqual(mancano, []);
});

test("dizionario: i segnaposto {nome} sono gli stessi in italiano e in inglese", () => {
  const sp = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");
  const diversi = Object.entries(EN).filter(([k, v]) => sp(k) !== sp(v)).map(([k]) => k);
  assert.deepEqual(diversi, []);
});

test("badge lingua: due link alla stessa pagina, la lingua attuale evidenziata", () => {
  impostaLingua("it");
  const b = badgeLingua("valanghe/");
  assert.match(b, /href="valanghe\/"[^>]*data-lingua="it" class="on" aria-current="true"/);
  assert.match(b, /href="en\/avalanches\/"[^>]*data-lingua="en" class=""/);
  impostaLingua("en");
  assert.match(badgeLingua(""), /href="en\/"[^>]*data-lingua="en" class="on"/);
  assert.match(badgeLingua(""), /href="\.\/"[^>]*data-lingua="it"/);
  impostaLingua("it");
});

test("pagine inglesi a parte: create dallo script e senza testi italiani rimasti", () => {
  for(const f of ["info", "contatti", "precipitazioni"]){
    const h = readFileSync(`html/en/${f}.html`, "utf8");
    assert.match(h, /^<!DOCTYPE html>/);
    assert.match(h, /<html lang="en">/);
    assert.match(h, /href="\.\.\/\.\.\/css\/style\.css"/);
    assert.match(h, /data-lingua-badge/);
    assert.doesNotMatch(h, /href="(previsione|valanghe|guida|contatti|precipitazioni)\//, f + ": link italiani");
    assert.doesNotMatch(h, />(Vai al contenuto|Previsione|Valanghe|Guida|Contatti|Tutti i diritti riservati)</, f + ": testi italiani");
  }
});
