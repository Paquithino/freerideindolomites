import { test } from "node:test";
import assert from "node:assert/strict";
import { state } from "../../js/state.js";
import { SPOTS } from "../../js/config.js";
import { avForSpot, bMax, elevText, paragrafi, stripTags, aspIt, testiHTML, gradiHTML, problemiHTML, intestazione,
         bollettiniPerServizio, avBlockHTML, aspectRose } from "../../js/valanghe.js";
import { VENETO, MALEVOLO } from "../fixtures/bollettini.mjs";

const spot = id => SPOTS.find(s => s.id === id);
function carica(av){ state.av = av; state.avDate = Object.fromEntries(Object.keys(av).map(k => [k, "2026-12-10"])); state.avErr = false; }

test("grado massimo del bollettino", () => {
  assert.equal(bMax(VENETO[0]), 3); assert.equal(bMax(VENETO[1]), 2); assert.equal(bMax({}), 0);
});

test("quote in italiano", () => {
  assert.equal(elevText({lowerBound: "2200"}), "sopra 2200 m");
  assert.equal(elevText({upperBound: "treeline"}), "sotto limite del bosco");
  assert.equal(elevText({lowerBound: "1800", upperBound: "2400"}), "1800 m – 2400 m");
  assert.equal(elevText(null), "tutte le quote");
  assert.equal(aspIt("W, NW, SW"), "O, NO, SO");
});

test("spot nella zona giusta: Cortina → Dolomiti Ampezzane, grado 3", () => {
  carica({"IT-34": VENETO});
  const a = avForSpot(spot("cortina"));
  assert.ok(a.exact); assert.equal(a.level, 3); assert.deepEqual(a.names, ["Dolomiti Ampezzane"]);
});

test("zona non trovata: si usa il grado più alto del servizio, dichiarandolo", () => {
  carica({"IT-34": [VENETO[1]]});
  const a = avForSpot(spot("cortina"));
  assert.equal(a.exact, false); assert.equal(a.level, 2);
  assert.match(avBlockHTML(spot("cortina")), /Zona non individuata/);
});

test("nessun bollettino: messaggio fuori stagione, non errore", () => {
  carica({});
  assert.equal(avForSpot(spot("cortina")), null);
  assert.match(avBlockHTML(spot("cortina")), /Nessun bollettino attivo/);
  state.avErr = true;
  assert.match(avBlockHTML(spot("cortina")), /non raggiungibile/);
});

test("testo completo: tutte le sezioni, paragrafi separati", () => {
  const h = testiHTML(VENETO[0]);
  for(const t of ["Situazione valanghe", "Manto nevoso", "Consigli per chi va in montagna", "Tendenza", "in diminuzione"]) assert.ok(h.includes(t), t);
  assert.equal((paragrafi("uno<br/><br/>due<br>tre").match(/<p>/g) || []).length, 3);
  const p = problemiHTML(VENETO[0]);
  assert.match(p, /valanghe medie/); assert.match(p, /stabilità debole/); assert.match(p, /alcuni punti pericolosi/);
  assert.match(p, /esposizioni N, NE, E, NO/);
  assert.match(gradiHTML(VENETO[0]), /Marcato.*sopra 2200 m/s);
  assert.match(problemiHTML(VENETO[1]), /pomeriggio/);
});

test("intestazione: validità, ente e lingua originale se non italiano", () => {
  assert.match(intestazione(VENETO[0], "IT-34"), /Valido da .* a .*ARPAV/);
  assert.doesNotMatch(intestazione(VENETO[0], "IT-34"), /testo originale/);
  assert.match(intestazione(MALEVOLO[0], "IT-32-BZ"), /testo originale in tedesco/);
});

test("sicurezza: HTML nei testi dei bollettini viene mostrato come testo, mai eseguito", () => {
  const tutto = testiHTML(MALEVOLO[0]) + gradiHTML(MALEVOLO[0]) + problemiHTML(MALEVOLO[0]) + intestazione(MALEVOLO[0], "IT-32-BZ");
  assert.doesNotMatch(tutto, /<script|onerror=|onmouseover=/i);
  assert.equal(stripTags("<b>ciao</b> <i>a</i>"), "ciao a");
  carica({"IT-32-BZ": MALEVOLO});
  const card = avBlockHTML(spot("sella")) + JSON.stringify(bollettiniPerServizio(SPOTS).map(s => s.nome));
  assert.doesNotMatch(card, /<script|<img src=x/i);
});

test("raggruppamento per servizio: spot assegnati al loro bollettino, gradi dal più alto", () => {
  carica({"IT-34": VENETO});
  const [sv] = bollettiniPerServizio(SPOTS);
  assert.equal(sv.nome, "Veneto");
  assert.deepEqual(sv.items.map(i => i.level), [3, 2]);
  const ids = sv.items[0].spots.map(s => s.id);
  assert.ok(ids.includes("cortina") && ids.includes("marmolada"), ids.join(","));
});

test("rosa delle esposizioni: 8 spicchi, evidenziati solo quelli indicati", () => {
  const svg = aspectRose(["N", "S"]);
  assert.equal((svg.match(/<path/g) || []).length, 8);
  assert.equal((svg.match(/#0369a1/g) || []).length, 2);
});
