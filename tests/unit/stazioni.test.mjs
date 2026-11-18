import { test } from "node:test";
import assert from "node:assert/strict";
import { istanteMs, parseElenco, serie, parseStazione } from "../../js/stazioni-arpav.js";
import { state } from "../../js/state.js";
import { SPOTS } from "../../js/config.js";
import { stationsFor, bestStation, stationsHTML } from "../../js/stazioni.js";

test("ARPAV: orario solare (UTC+1) convertito in UTC", () => {
  assert.equal(new Date(istanteMs("202612011200")).toISOString(), "2026-12-01T11:00:00.000Z");
  assert.equal(new Date(istanteMs("202601010030")).toISOString(), "2025-12-31T23:30:00.000Z", "passaggio d'anno");
});

const ELENCO = `<?xml version="1.0" encoding="ISO-8859-1"?><STAZIONI>
<STAZIONE><IDSTAZ>183</IDSTAZ><NOME><![CDATA[Faloria]]></NOME><X>12.17</X><Y>46.53</Y><QUOTA>2240</QUOTA><LINKSTAZ>0183.xml</LINKSTAZ></STAZIONE>
<STAZIONE><IDSTAZ>9</IDSTAZ><NOME>Senza coordinate</NOME><X></X><Y>abc</Y><QUOTA>1</QUOTA><LINKSTAZ>0009.xml</LINKSTAZ></STAZIONE>
</STAZIONI>`;
test("ARPAV: elenco stazioni, CDATA letto e stazioni senza coordinate scartate", () => {
  const e = parseElenco(ELENCO);
  assert.equal(e.length, 1);
  assert.deepEqual(e[0], {code: "0183.xml", id: "183", name: "Faloria", lon: 12.17, lat: 46.53, elev: 2240});
});

/* 3 giorni di dati ogni ora: neve che cresce di 10 cm al giorno, con un dato mancante (">>") e uno con la virgola */
function fileStazione(){
  let liv = "", tmp = "";
  const t0 = Date.UTC(2026, 11, 1, 0);
  for(let h = 0; h <= 72; h++){
    const d = new Date(t0 + h * 3600e3 + 3600e3);   // +1h: l'ora nel file è solare
    const s = d.toISOString().replace(/[-T:]/g, "").slice(0, 12);
    const v = h === 40 ? ">>" : h === 41 ? String(100 + h * 10 / 24).replace(".", ",") : (100 + h * 10 / 24).toFixed(1);
    liv += `<DATI ISTANTE="${s}"><VM>${v}</VM></DATI>`;
    tmp += `<DATI ISTANTE="${s}"><VM>${(-5 + h / 72).toFixed(1)}</VM></DATI>`;
  }
  return `<STAZIONE><SENSORI><SENSORE><ID>1</ID><TYPE>LIVNEVE</TYPE>${liv}</SENSORE><SENSORE><ID>2</ID><TYPE>TEMP</TYPE>${tmp}</SENSORE></SENSORI></STAZIONE>`;
}
test("ARPAV: serie ignora i dati mancanti e legge la virgola decimale", () => {
  const s = serie(fileStazione(), "LIVNEVE");
  assert.equal(s.length, 72);
  assert.ok(s.every(p => isFinite(p.v)));
  assert.deepEqual(serie(fileStazione(), "PREC"), []);
});
test("ARPAV: neve al suolo e differenze a 24/48/72 ore", () => {
  const st = parseStazione(fileStazione(), {id: "183", name: "Faloria", lat: 46.53, lon: 12.17, elev: 2240});
  assert.equal(st.id, "ARPAV-183"); assert.equal(st.operator, "ARPAV");
  assert.ok(Math.abs(st.hs - 130) < 0.6, `hs ${st.hs}`);
  assert.ok(Math.abs(st.d24 - 10) < 0.6, `d24 ${st.d24}`);
  assert.ok(Math.abs(st.d48 - 20) < 0.6, `d48 ${st.d48}`);
  assert.ok(Math.abs(st.lt - -4) < 0.05, `temp ${st.lt}`);
  assert.equal(st.date, "2026-12-04T00:00:00.000Z");
});
test("ARPAV: stazione senza sensore neve = nessuna riga", () => {
  assert.equal(parseStazione("<STAZIONE></STAZIONE>", {id: 1}), null);
});

test("stazioni per spot: solo vicine, ordinate per distanza e dislivello", () => {
  const c = SPOTS.find(s => s.id === "cortina");
  state.stations = [
    {id: "lontana", name: "Lontana", lat: 46.0, lon: 11.0, elev: 2400, hs: 50, operator: "X"},
    {id: "vicina-bassa", name: "Vicina bassa", lat: c.lat + 0.01, lon: c.lon, elev: 1200, hs: 20, operator: "ARPAV"},
    {id: "vicina-alta", name: "Vicina alta", lat: c.lat + 0.03, lon: c.lon, elev: 2350, hs: 90, operator: "ARPAV"}
  ];
  const l = stationsFor(c);
  assert.ok(!l.some(s => s.id === "lontana"));
  assert.equal(bestStation(c).id, "vicina-alta", "a parità di zona conta di più la quota simile");
  assert.match(stationsHTML(c), /ARPAV Veneto/, "credito ARPAV mostrato");
});
