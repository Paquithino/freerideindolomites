/* =========================================================
   CALIBRAZIONE SUGLI INVERNI PASSATI
   Uso:  node scripts/calibra.mjs          (scrive in ARCHIVIO_DIR, default "archivio")
   Cosa fa:
     1. sceglie le stazioni nivometriche vicine agli spot dolomitici e sopra i 1.400 m:
        - Alto Adige: open data Provincia di Bolzano (CC0), altezza neve alle 8:00
        - Veneto: ARPAV (CC BY 4.0), altezza neve media giornaliera dal servizio "dati storici"
     2. scarica l'altezza neve misurata negli inverni passati
     3. scarica da Open-Meteo "Previous Runs" ciò che ogni modello prevedeva
        1, 2 e 3 giorni prima, alla posizione e alla quota di ogni stazione
     4. scarica il vento in quota (archivio Open-Meteo) per riconoscere i regimi
     5. calcola fattori e pesi dei modelli (js/calibrazione.js) e li verifica
        inverno per inverno; scrive calibrazione.json e un resoconto leggibile
   ========================================================= */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SPOTS, MODELS } from "../js/config.js";
import { correctedSnow, classify } from "../js/modelli.js";
import { calibra } from "../js/calibrazione.js";
import { parseElenco } from "../js/stazioni-arpav.js";

const OUT = process.env.ARCHIVIO_DIR || "archivio";
const BZ = "https://geoservices.buergernetz.bz.it/services/meteo/v1";   // indirizzo nuovo (il vecchio daten.buergernetz.bz.it è stato dismesso)
const PREV = "https://previous-runs-api.open-meteo.com/v1/forecast";
const HIST = "https://historical-forecast-api.open-meteo.com/v1/forecast";
const ARPAV_XML = "https://meteo.arpa.veneto.it/meteo/dati_meteo/xml/";
const ARPAV_STORICI = "https://api.arpa.veneto.it/REST/v1/meteo_storici_tabella";
const MAX_STAZIONI = 14, MAX_KM = 15, QUOTA_MIN = 1400;
const PAUSA_OPENMETEO = 20e3;   // 20 s tra una richiesta e l'altra: restiamo ben sotto i limiti al minuto

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- inverni da analizzare (l'archivio dei modelli parte da gennaio 2024) ---------- */
function stagioni(){
  const ieri = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const s = [
    {id: "2023-24", from: "2024-01-01", to: "2024-04-30"},
    {id: "2024-25", from: "2024-11-15", to: "2025-04-30"},
    {id: "2025-26", from: "2025-11-15", to: "2026-04-30"}
  ];
  // l'inverno in corso, se ha già almeno 10 giorni
  const y = +ieri.slice(0, 4), m = +ieri.slice(5, 7);
  const start = m >= 11 ? `${y}-11-01` : m <= 5 ? `${y - 1}-11-01` : null;
  if(start && !s.some(x => x.from <= start && x.to >= start) && (Date.parse(ieri) - Date.parse(start)) / 864e5 >= 10){
    s.push({id: `${start.slice(0, 4)}-${String(+start.slice(2, 4) + 1).padStart(2, "0")}`, from: start, to: ieri, inCorso: true});
  }
  return s;
}

const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function giorni(from, to){ const out = []; for(let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }

function distKm(a, b, c, d){
  const R = 6371, t = x => x * Math.PI / 180;
  const h = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function getJson(url, tentativi = 4){
  let last;
  for(let i = 0; i < tentativi; i++){
    try{
      const r = await fetch(url, {signal: AbortSignal.timeout(60e3)});   // massimo 60 s per richiesta
      if(r.ok) return await r.json();
      last = new Error(`HTTP ${r.status} da ${new URL(url).host}: ${(await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}`);
      if(r.status === 429){ log("  troppe richieste, aspetto 65 s"); await sleep(65e3); continue; }
      if(r.status < 500) throw last;
    }catch(e){
      last = e.cause ? new Error(e.message + " (" + (e.cause.code || e.cause.message) + ")") : e;
      if(/HTTP 4\d\d/.test(last.message) && !/429/.test(last.message)) throw last;
    }
    await sleep(5000 * (i + 1));
  }
  throw last;
}

/* ---------- 1. stazioni Alto Adige con sensore neve ---------- */
async function scegliStazioni(){
  const geo = await getJson(`${BZ}/stations?coord_sys=EPSG:4326`);
  const lista = (geo.features || []).map(f => {
    const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
    let lon = +c[0], lat = +c[1];
    if(!(lat > 45 && lat < 48)){ lat = +(p.LAT ?? p.lat); lon = +(p.LONG ?? p.LON ?? p.lon); }
    return {code: p.SCODE, name: p.NAME_I || p.NAME_D || p.SCODE, alt: +(p.ALT ?? p.alt), lat, lon};
  }).filter(s => s.code && isFinite(s.lat) && isFinite(s.lon) && s.alt >= QUOTA_MIN);
  const dolomiti = SPOTS.filter(s => s.area !== "Friuli VG");
  const vicine = lista.map(s => ({...s, km: Math.min(...dolomiti.map(p => distKm(p.lat, p.lon, s.lat, s.lon)))}))
    .filter(s => s.km <= MAX_KM).sort((a, b) => a.km - b.km);
  // teniamo solo quelle che misurano l'altezza neve (HS)
  log(`stazioni Alto Adige candidate: ${vicine.length}`);
  const conNeve = [];
  for(const s of vicine){
    if(conNeve.length >= MAX_STAZIONI) break;
    try{
      const sens = await getJson(`${BZ}/sensors?station_code=${encodeURIComponent(s.code)}&sensor_code=HS`, 2);
      if((Array.isArray(sens) ? sens : [sens]).some(x => x && (x.TYPE === "HS" || x.type === "HS"))) conNeve.push(s);
    }catch(e){}
  }
  return conNeve;
}

/* ---------- 2. altezza neve misurata alle 8:00 di ogni giorno ---------- */
// "2024-01-15T08:00:00CET" -> chiave locale "2024-01-15T08:00"
const localKey = s => { const m = String(s).match(/(\d{4}-\d\d-\d\d)[T ](\d\d):(\d\d)/); return m ? `${m[1]}T${m[2]}:${m[3]}` : null; };
const toMin = k => Date.parse(k + ":00Z") / 60000;   // minuti "locali" (solo per confronti)

async function neveAlle8(code, from, to){
  const punti = [];
  // a blocchi di un mese per tenere piccole le risposte
  for(let d = from; d <= to; ){
    const fine = [addDays(d, 30), to].sort()[0];
    const url = `${BZ}/timeseries?station_code=${encodeURIComponent(code)}&sensor_code=HS&output_format=JSON&date_from=${d.replace(/-/g, "")}0000&date_to=${fine.replace(/-/g, "")}2359`;
    try{
      const j = await getJson(url, 3);
      for(const x of (Array.isArray(j) ? j : j.data || [])){
        const k = localKey(x.DATE ?? x.date), v = parseFloat(x.VALUE ?? x.value);
        if(k && isFinite(v) && v >= 0 && v < 800) punti.push({t: toMin(k), v});
      }
    }catch(e){ log(`  ${code} ${d}: ${e.message}`); }
    d = addDays(fine, 1);
    await sleep(150);
  }
  const hs = {};
  for(const g of giorni(from, addDays(to, 1))){
    const t = toMin(g + "T08:00");
    const w = punti.filter(p => Math.abs(p.t - t) <= 60).map(p => p.v).sort((a, b) => a - b);
    hs[g] = w.length ? w[Math.floor(w.length / 2)] : null;
  }
  return hs;
}

const memoAnni = {};
/* ---------- 1b-2b. Veneto: stazioni ARPAV e altezza neve media giornaliera ---------- */
async function getTextLatin1(url){
  const r = await fetch(url, {signal: AbortSignal.timeout(60e3)});
  if(!r.ok) throw new Error(`HTTP ${r.status} da ${new URL(url).host}`);
  return new TextDecoder("latin1").decode(await r.arrayBuffer());
}
async function scegliStazioniVeneto(){
  const elenco = parseElenco(await getTextLatin1(ARPAV_XML + "stazioni_neve.xml"));
  const dolomiti = SPOTS.filter(s => s.area !== "Friuli VG");
  const vicine = elenco.filter(s => s.elev >= QUOTA_MIN)
    .map(s => ({...s, km: Math.min(...dolomiti.map(p => distKm(p.lat, p.lon, s.lat, s.lon)))}))
    .filter(s => s.km <= MAX_KM).sort((a, b) => a.km - b.km);
  log(`stazioni Veneto candidate: ${vicine.length}`);
  const out = [];
  for(const s of vicine){
    if(out.length >= MAX_STAZIONI) break;
    try{
      // il codice del sensore "altezza neve" (LIVNEVE) sta nel file in tempo reale della stazione
      const xml = await getTextLatin1(ARPAV_XML + s.code);
      const b = (xml.match(/<SENSORE>[\s\S]*?<\/SENSORE>/g) || []).find(x => /<TYPE>\s*LIVNEVE\s*<\/TYPE>/.test(x));
      const id = b && (b.match(/<ID>\s*(\d+)\s*<\/ID>/) || [])[1];
      if(id) out.push({code: "ARPAV-" + s.id, name: s.name, alt: s.elev, lat: s.lat, lon: s.lon, km: s.km, sensore: id});
    }catch(e){ log(`  ${s.name}: ${e.message}`); }
    await sleep(200);
  }
  return out;
}
/* stazioni ARPAV in quota con pluviometro (precipitazione) e temperatura, vicine agli spot */
async function scegliPluviometriVeneto(){
  let elenco = [];
  try{ elenco = parseElenco(await getTextLatin1(ARPAV_XML + "stazioni.xml")); }catch(e){ log("  elenco stazioni ARPAV:", e.message); }
  const dolomiti = SPOTS.filter(s => s.area !== "Friuli VG");
  const vicine = elenco.filter(s => s.elev >= QUOTA_MIN)
    .map(s => ({...s, km: Math.min(...dolomiti.map(p => distKm(p.lat, p.lon, s.lat, s.lon)))}))
    .filter(s => s.km <= MAX_KM).sort((a, b) => a.km - b.km);
  log(`pluviometri Veneto candidati: ${vicine.length}`);
  const out = [];
  for(const s of vicine){
    if(out.length >= MAX_STAZIONI) break;
    try{
      const xml = await getTextLatin1(ARPAV_XML + s.code);
      const sens = (xml.match(/<SENSORE>[\s\S]*?<\/SENSORE>/g) || []);
      const idOf = t => { const b = sens.find(x => new RegExp(`<TYPE>\\s*${t}\\s*</TYPE>`).test(x)); return b && (b.match(/<ID>\s*(\d+)\s*<\/ID>/) || [])[1]; };
      const prec = idOf("PREC"), temp = idOf("TEMP");
      if(prec) out.push({code: "ARPAV-" + s.id, name: s.name, alt: s.elev, lat: s.lat, lon: s.lon, km: s.km, prec, temp});
    }catch(e){ log(`  ${s.name}: ${e.message}`); }
    await sleep(200);
  }
  return out;
}

/* serie giornaliera di un sensore ARPAV dal servizio dati storici (un file per sensore e per anno):
   valore semplice (precipitazione) oppure MEDIO (temperatura, altezza neve) */
async function serieArpav(codseq, from, to, controllo){
  const out = {};
  for(let y = +from.slice(0, 4); y <= +addDays(to, 1).slice(0, 4); y++){
    const key = codseq + "-" + y;
    if(!memoAnni[key]){
      try{
        const j = await getJson(`${ARPAV_STORICI}?codseq=${codseq}&anno=${y}`, 3);
        const rec = (j && j.data) || [];
        if(rec.length && controllo && !rec.some(controllo)) throw new Error(`il sensore ${codseq} non è quello atteso (${rec[0].nome_sensore})`);
        const m = {};
        for(const r of rec){
          let v = r.valore; try{ v = typeof v === "string" && v.trim().startsWith("{") ? JSON.parse(v) : v; }catch(e){}
          const x = v && typeof v === "object" ? (v.MEDIO ?? v.MEDIA ?? null) : parseFloat(v);
          if(x != null && isFinite(x)) m[String(r.dataora).slice(0, 10)] = +x;
        }
        memoAnni[key] = m;
      }catch(e){ log(`  ARPAV ${codseq} ${y}: ${e.message}`); memoAnni[key] = {}; }
      await sleep(200);
    }
    Object.assign(out, memoAnni[key]);
  }
  return out;
}

/* altezza neve media di ogni giorno (cm) dal servizio dati storici ARPAV: un file per sensore e per anno */
async function neveGiornalieraVeneto(sensore, from, to){
  const hs = {};
  for(let y = +from.slice(0, 4); y <= +addDays(to, 1).slice(0, 4); y++){
    const key = sensore + "-" + y;
    if(!memoAnni[key]){
      try{
        const j = await getJson(`${ARPAV_STORICI}?codseq=${sensore}&anno=${y}`, 3);
        const rec = (j && j.data) || [];
        // controllo che sia davvero l'altezza neve (e non un altro sensore)
        if(rec.length && !rec.some(r => /neve/i.test(r.nome_sensore || "") || /NEVE|HS/i.test(r.tipo || ""))){
          throw new Error(`il sensore ${sensore} non è l'altezza neve (${rec[0].nome_sensore})`);
        }
        const m = {};
        for(const r of rec){
          let v = r.valore; try{ v = typeof v === "string" ? JSON.parse(v) : v; }catch(e){}
          const x = v && typeof v === "object" ? (v.MEDIO ?? v.MEDIA ?? null) : parseFloat(v);
          if(x != null && isFinite(x) && x >= 0 && x < 800) m[String(r.dataora).slice(0, 10)] = +x;
        }
        memoAnni[key] = m;
      }catch(e){ log(`  ARPAV ${sensore} ${y}: ${e.message}`); memoAnni[key] = {}; }
      await sleep(200);
    }
    Object.assign(hs, memoAnni[key]);
  }
  const out = {};
  for(const g of giorni(from, addDays(to, 1))) out[g] = hs[g] ?? null;
  return out;
}

/* ---------- 3. previsioni passate dei modelli ---------- */
const LEADS = [1, 2, 3];
async function previsioni(stazioni, modello, st, ora = 8, pioggia = false){
  // neve (cm, ricalcolata con il nostro rapporto neve/acqua) oppure precipitazione (mm d'acqua)
  const VAR = pioggia ? "precipitation" : "snowfall";
  const hourly = LEADS.flatMap(L => [`${VAR}_previous_day${L}`, `temperature_2m_previous_day${L}`]).join(",");
  for(const name of modello.names){
    const q = new URLSearchParams({
      latitude: stazioni.map(s => s.lat).join(","), longitude: stazioni.map(s => s.lon).join(","),
      elevation: stazioni.map(s => s.alt).join(","), hourly, models: name,
      start_date: st.from, end_date: addDays(st.to, 1), timezone: "Europe/Rome"
    });
    try{
      let data = await getJson(`${PREV}?${q}`);
      await sleep(PAUSA_OPENMETEO);
      if(!Array.isArray(data)) data = [data];
      // per stazione: {giorno: {1: cm, 2: cm, 3: cm}} con la finestra 8:00 → 8:00 del giorno dopo
      return data.map(d => {
        const H = d.hourly || {}, out = {};
        for(const L of LEADS){
          const sf = H[`${VAR}_previous_day${L}`], tt = H[`temperature_2m_previous_day${L}`];
          if(!sf) continue;
          const acc = {};
          (H.time || []).forEach((t, i) => {
            // il valore delle 9:00 è la neve caduta tra le 8 e le 9: appartiene alla finestra che parte alle 8
            // (per il Veneto la finestra va da mezzogiorno a mezzogiorno: ora = 12)
            const k = toMin(t.slice(0, 16)) - 60;
            const g = new Date((k - ora * 60) * 60000).toISOString().slice(0, 10);
            const v = pioggia ? sf[i] : correctedSnow(sf[i], tt ? tt[i] : null);
            const a = acc[g] = acc[g] || {s: 0, n: 0};
            if(v != null){ a.s += v; a.n++; }
          });
          for(const g in acc) if(acc[g].n >= 20){ (out[g] = out[g] || {})[L] = acc[g].s; }
        }
        return out;
      });
    }catch(e){
      log(`  ${modello.id} (${name}) ${st.id}: ${e.message}`);
      await sleep(PAUSA_OPENMETEO);
    }
  }
  return null;
}

/* ---------- 4. regime dei venti (vento a 700 hPa, pesato sulle ore con precipitazione) ---------- */
async function regimi(stazioni, st, ora = 8){
  const q = new URLSearchParams({
    latitude: stazioni.map(s => s.lat).join(","), longitude: stazioni.map(s => s.lon).join(","),
    hourly: "precipitation,wind_speed_700hPa,wind_direction_700hPa", models: "icon_seamless",
    start_date: st.from, end_date: addDays(st.to, 1), timezone: "Europe/Rome"
  });
  try{
    let data = await getJson(`${HIST}?${q}`);
    await sleep(PAUSA_OPENMETEO);
    if(!Array.isArray(data)) data = [data];
    return data.map(d => {
      const H = d.hourly || {}, acc = {}, out = {};
      (H.time || []).forEach((t, i) => {
        const k = toMin(t.slice(0, 16)) - 60, g = new Date((k - ora * 60) * 60000).toISOString().slice(0, 10);
        const sp = H.wind_speed_700hPa[i], dr = H.wind_direction_700hPa[i]; if(sp == null || dr == null) return;
        const p = H.precipitation[i] || 0, w = 0.05 + p, rad = dr * Math.PI / 180;
        const a = acc[g] = acc[g] || {u: 0, v: 0, w: 0};
        a.u += -sp * Math.sin(rad) * w; a.v += -sp * Math.cos(rad) * w; a.w += w;
      });
      for(const g in acc){ const a = acc[g], u = a.u / a.w, v = a.v / a.w;
        out[g] = classify((Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360, Math.hypot(u, v)); }
      return out;
    });
  }catch(e){ log(`  regimi ${st.id}: ${e.message}`); return null; }
}

/* risultati di una sola zona: nevicate grosse per modello e regimi dei venti */
function zona(righe){
  if(righe.length < 100) return {giornate: righe.length};
  const c = calibra(righe, MODELS.map(m => m.id));
  return {giornate: righe.length, grosse: Object.fromEntries(Object.entries(c.models).map(([k, m]) => [k, m.grosse])), regimi: c.regimi, verifica1: c.verifica[1]};
}

/* ---------- resoconto leggibile ---------- */
const f1 = v => v == null ? "–" : (Math.round(v * 10) / 10).toLocaleString("it-IT");
const f2 = v => v == null ? "–" : (Math.round(v * 100) / 100).toLocaleString("it-IT");
function resoconto(res, staz, righe){
  const lab = id => (MODELS.find(m => m.id === id) || {}).label || id;
  let md = `# Calibrazione dei modelli\n\nGenerata il ${res.generated.slice(0, 10)} su ${staz.length} stazioni nivometriche (Alto Adige: open data Provincia di Bolzano, CC0; Veneto: ARPAV, CC BY 4.0) e ${righe.length} giornate negli inverni ${res.stagioni.join(", ")}.\n\n`;
  md += `Neve misurata = aumento dell'altezza neve tra le 8:00 di un giorno e le 8:00 del giorno dopo (la neve che "resta", al netto dell'assestamento). Contano le giornate con almeno 1 cm misurato o previsto.\n\n`;
  md += `## Modelli\n\n| Modello | Giornate con neve | Nevicate ≥5 cm | Fattore relativo | Errore medio (cm) | Peso |\n|---|---|---|---|---|---|\n`;
  for(const id in res.models){ const m = res.models[id];
    md += `| ${lab(id)} | ${m.n} | ${m.nevicate} | ${m.ok ? "×" + f2(m.factor) : "neutro (pochi dati)"} | ${f1(m.mae)} | ${f2(m.weight)} |\n`; }
  md += `\nFattore relativo: corregge le differenze tra modelli (la media è 1). Peso > 1: sbaglia meno della media. Scala comune non applicata: ×${f2(res.scala)} (la neve misurata come aumento dell'altezza neve è sempre un po' meno di quella caduta).\n\n`;
  md += `## Nevicate di almeno 10 cm\n\nQuanta neve prevedeva ogni modello rispetto a quella misurata (1 = giusto, 0,7 = il 30% in meno).\n\n| Modello | 1 giorno prima | 2 giorni prima | 3 giorni prima |\n|---|---|---|---|\n`;
  for(const id in res.models){ const g = res.models[id].grosse;
    md += `| ${lab(id)} | ${[1, 2, 3].map(L => g[L].n ? `${f2(g[L].rapporto)} (${g[L].n})` : "–").join(" | ")} |\n`; }
  md += `\n## Verifica fuori campione\n\nPer ogni inverno i fattori sono calcolati sugli altri inverni e messi alla prova su quello. "Prima" = mediana semplice dei modelli, "dopo" = Previsione FreeRide calibrata.\n\n| Anticipo | Giornate | Errore medio prima → dopo | Nevicate ≥10 cm prese | Neve prevista nelle nevicate ≥10 cm | Falsi allarmi |\n|---|---|---|---|---|---|\n`;
  for(const L in res.verifica){ const v = res.verifica[L];
    md += `| ${L} giorno/i | ${v.calibrato.n} | ${f1(v.grezzo.mae)} → ${f1(v.calibrato.mae)} cm | ${v.grezzo.prese} → ${v.calibrato.prese} su ${v.calibrato.nevicateGrosse} | ${f2(v.grezzo.grosseRapporto)} → ${f2(v.calibrato.grosseRapporto)} | ${v.grezzo.falsiAllarmi} → ${v.calibrato.falsiAllarmi} |\n`; }
  md += `\n## Regimi dei venti (stazioni dell'Alto Adige)\n\nRapporto tra neve misurata e prevista (mediana dei modelli, 1 giorno prima): sopra 1 i modelli sottostimano.\n\n| Regime | Giornate | Misurata (cm) | Prevista (cm) | Rapporto |\n|---|---|---|---|---|\n`;
  for(const k in res.regimi){ const g = res.regimi[k]; md += `| ${k} | ${g.giorni} | ${Math.round(g.misurata)} | ${Math.round(g.prevista)} | ${f2(g.rapporto)} |\n`; }
  for(const id in (res.perZona || {})){ const z = res.perZona[id];
    md += `\n## Zona: ${z.nome} (${z.giornate} giornate)\n\n`;
    if(!z.grosse){ md += "Troppe poche giornate per un'analisi separata.\n"; continue; }
    md += `Nevicate di almeno 10 cm: neve prevista rispetto a quella misurata.\n\n| Modello | 1 giorno | 2 giorni | 3 giorni |\n|---|---|---|---|\n`;
    for(const mid in z.grosse){ const g = z.grosse[mid]; md += `| ${lab(mid)} | ${[1, 2, 3].map(L => g[L].n ? `${f2(g[L].rapporto)} (${g[L].n})` : "–").join(" | ")} |\n`; }
    md += `\nRegimi dei venti (rapporto misurata / prevista, 1 giorno prima):\n\n| Regime | Giornate | Misurata (cm) | Prevista (cm) | Rapporto |\n|---|---|---|---|---|\n`;
    for(const k in z.regimi){ const g = z.regimi[k]; md += `| ${k} | ${g.giorni} | ${Math.round(g.misurata)} | ${Math.round(g.prevista)} | ${f2(g.rapporto)} |\n`; }
  }
  const pv = res.pioggiaVeneto;
  if(pv) for(const [k, z] of [["tutte le giornate", pv.tutte], ["solo giornate fredde (temperatura media ≤ 0 °C, precipitazione nevosa)", pv.fredde]]){
    md += `\n## Veneto – precipitazione, ${k} (${z.giornate} giornate)\n\nMillimetri d'acqua previsti rispetto a quelli misurati dai pluviometri ARPAV in quota (giorno 0 → 24). Attenzione: con neve e vento i pluviometri catturano meno di quanto cade, quindi i valori assoluti tendono a far sembrare i modelli "generosi"; il confronto tra modelli e tra regimi resta valido.\n\n`;
    if(!z.grosse){ md += "Troppe poche giornate.\n"; continue; }
    md += `Giornate con almeno 10 mm misurati:\n\n| Modello | 1 giorno | 2 giorni | 3 giorni |\n|---|---|---|---|\n`;
    for(const mid in z.grosse){ const g = z.grosse[mid]; md += `| ${lab(mid)} | ${[1, 2, 3].map(L => g[L].n ? `${f2(g[L].rapporto)} (${g[L].n})` : "–").join(" | ")} |\n`; }
    md += `\nRegimi dei venti (mm misurati / previsti, 1 giorno prima):\n\n| Regime | Giornate | Misurata (mm) | Prevista (mm) | Rapporto |\n|---|---|---|---|---|\n`;
    for(const r in z.regimi){ const g = z.regimi[r]; md += `| ${r} | ${g.giorni} | ${Math.round(g.misurata)} | ${Math.round(g.prevista)} | ${f2(g.rapporto)} |\n`; }
  }
  md += `\n## Stazioni usate\n\n${staz.map(s => `- ${s.rete ? s.rete + " – " : ""}${s.name} (${s.code}), ${s.alt} m, ${f1(s.km)} km dallo spot più vicino`).join("\n")}\n`;
  md += `\nAlto Adige: altezza neve alle 8:00, finestra di confronto 8:00 → 8:00. Veneto: altezza neve media giornaliera (dati storici ARPAV), finestra 12:00 → 12:00.\n`;
  return md;
}

/* ---------- main ---------- */
async function main(){
  const t0 = Date.now();
  const st = stagioni();
  log("inverni:", st.map(s => `${s.id} (${s.from} → ${s.to})`).join(", "));
  // le due reti di stazioni: Alto Adige (altezza neve alle 8:00) e Veneto (media giornaliera, finestra 12 → 12)
  const reti = [];
  try{
    const bz = await scegliStazioni();
    if(bz.length){ reti.push({id: "bz", nome: "Alto Adige", staz: bz, ora: 8, cache: s => `${s.id}.json`,
      oss: (x, s) => neveAlle8(x.code, s.from, s.to)}); log("stazioni Alto Adige:", bz.map(s => `${s.name} ${s.alt} m`).join(", ")); }
  }catch(e){ log("Alto Adige non disponibile:", e.message); }
  try{
    const ve = await scegliStazioniVeneto();
    if(ve.length){ reti.push({id: "ve", nome: "Veneto", staz: ve, ora: 12, cache: s => `${s.id}-veneto.json`,
      oss: (x, s) => neveGiornalieraVeneto(x.sensore, s.from, s.to)}); log("stazioni Veneto:", ve.map(s => `${s.name} ${s.alt} m`).join(", ")); }
  }catch(e){ log("Veneto non disponibile:", e.message); }
  // Veneto, piano B: lo storico dell'altezza neve ARPAV non è pubblicato, la precipitazione sì.
  // Confrontiamo i mm d'acqua previsti con quelli misurati (giorno solare 0 → 24): non entra nei
  // fattori della neve, serve per capire quale modello va meglio sul versante sud e con quale vento.
  try{
    const vp = await scegliPluviometriVeneto();
    if(vp.length){ reti.push({id: "vep", nome: "Veneto (precipitazione)", pioggia: true, staz: vp, ora: 0, cache: s => `${s.id}-veneto-pioggia.json`,
      oss: async (x, s) => {
        const mm = await serieArpav(x.prec, s.from, s.to, r => r.tipo === "PREC" || /precipit/i.test(r.nome_sensore || ""));
        const tm = x.temp ? await serieArpav(x.temp, s.from, s.to) : {};
        return {mm, tm};
      }}); log("pluviometri Veneto:", vp.map(s => `${s.name} ${s.alt} m`).join(", ")); }
  }catch(e){ log("pluviometri Veneto non disponibili:", e.message); }
  if(!reti.length) throw new Error("Nessuna stazione con sensore neve trovata: i servizi dati potrebbero essere cambiati");

  const righe = [];
  const CACHE = join(OUT, "calibrazione-cache");
  mkdirSync(CACHE, {recursive: true});
  const oggi = new Date().toISOString().slice(0, 10);
  for(const s of st) for(const rete of reti){
    const staz = rete.staz, codici = staz.map(x => x.code).join(",");
    // gli inverni conclusi non cambiano più: se li abbiamo già calcolati con le stesse stazioni, li riusiamo
    const cf = join(CACHE, rete.cache(s));
    if(!s.inCorso && existsSync(cf)){
      try{
        const c = JSON.parse(readFileSync(cf, "utf8"));
        if(c.stazioni === codici){ righe.push(...c.righe.map(r => ({rete: rete.id, ...r}))); log(`— ${rete.nome} ${s.id}: già calcolato, riuso ${c.righe.length} giornate`); continue; }
      }catch(e){}
    }
    log(`— ${rete.nome}, inverno ${s.id}`);
    const nPrima = righe.length;
    const oss = new Array(staz.length);
    let fatte = 0; const tS = Date.now();
    for(let i = 0; i < staz.length; i += 4){
      await Promise.all(staz.slice(i, i + 4).map(async (x, j) => {
        oss[i + j] = await rete.oss(x, s);
        log(`  neve misurata ${++fatte}/${staz.length}: ${x.name}`);
      }));
    }
    const conDati = oss.filter(o => Object.values(rete.pioggia ? o.mm : o).some(v => v != null)).length;
    log(`  neve misurata: ${conDati}/${staz.length} stazioni con dati (${Math.round((Date.now() - tS) / 1000)} s)`);
    if(!conDati){ log("  nessun dato misurato: salto le previsioni di questo inverno"); continue; }
    const prev = {};
    for(const m of MODELS){
      const tM = Date.now();
      const p = await previsioni(staz, m, s, rete.ora, !!rete.pioggia);
      if(p){ prev[m.id] = p; log(`  ${m.id}: ok (${Math.round((Date.now() - tM) / 1000)} s)`); }
    }
    const tR = Date.now();
    const reg = await regimi(staz, s, rete.ora);
    log(`  regimi dei venti: ${reg ? "ok" : "non disponibili"} (${Math.round((Date.now() - tR) / 1000)} s)`);
    staz.forEach((x, i) => {
      for(const g of giorni(s.from, s.to)){
        let obs, tm = null;
        if(rete.pioggia){
          obs = oss[i].mm[g]; tm = oss[i].tm[g] ?? null;
          if(obs == null || obs < 0 || obs > 300) continue;
        }else{
          const h0 = oss[i][g], h1 = oss[i][addDays(g, 1)];
          obs = h0 == null || h1 == null ? null : (h1 - h0 > 150 ? null : Math.max(0, h1 - h0));
          if(obs == null) continue;
        }
        const fc = {};
        for(const mid in prev){ const v = prev[mid][i] && prev[mid][i][g]; if(v) fc[mid] = v; }
        if(!Object.keys(fc).length) continue;
        righe.push({rete: rete.id, date: g, station: x.code, season: s.id, obs, ...(tm != null ? {tm} : {}), regime: reg && reg[i] ? reg[i][g] || null : null, fc});
      }
    });
    log(`  giornate valide finora: ${righe.length}`);
    // salvo subito l'inverno appena calcolato (solo se concluso): se il giro si interrompe, il prossimo riparte da qui
    if(!s.inCorso && s.to < oggi && righe.length > nPrima){
      writeFileSync(cf, JSON.stringify({stazioni: codici, righe: righe.slice(nPrima).map(({rete: _r, ...r}) => r)}));
    }
  }
  const staz = reti.flatMap(r => r.staz.map(x => ({...x, rete: r.nome})));
  const righePioggia = righe.filter(r => r.rete === "vep");
  righe.splice(0, righe.length, ...righe.filter(r => r.rete !== "vep"));
  if(righe.length < 50) throw new Error(`Troppe poche giornate valide (${righe.length}): non scrivo la calibrazione`);

  const res = {generated: new Date().toISOString(), ...calibra(righe, MODELS.map(m => m.id)),
    stazioni: staz.map(({code, name, alt, lat, lon, km, rete}) => ({code, name, alt, lat, lon, km, rete})),
    perZona: Object.fromEntries(reti.filter(r => !r.pioggia).map(r => [r.id, {nome: r.nome, ...zona(righe.filter(x => x.rete === r.id))}])),
    // Veneto: precipitazione (mm), tutte le giornate e solo quelle fredde (temperatura media ≤ 0 °C: precipitazione nevosa in quota)
    pioggiaVeneto: righePioggia.length ? {tutte: zona(righePioggia), fredde: zona(righePioggia.filter(r => r.tm != null && r.tm <= 0))} : null,
    fonti: "Altezza neve: Provincia autonoma di Bolzano, open data meteo (CC0); ARPA Veneto, dati storici (CC BY 4.0). Previsioni passate e vento: Open-Meteo.com Previous Runs e Historical Forecast API (CC BY 4.0)."};
  mkdirSync(OUT, {recursive: true});
  writeFileSync(join(OUT, "calibrazione.json"), JSON.stringify(res, null, 1));
  writeFileSync(join(OUT, "calibrazione.md"), resoconto(res, staz, righe));
  if(righePioggia.length) writeFileSync(join(OUT, "calibrazione-pioggia-veneto.json"), JSON.stringify(righePioggia));
  const r1 = x => Math.round(x * 10) / 10;
  writeFileSync(join(OUT, "calibrazione-giornate.json"), JSON.stringify(righe.map(r => ({...r, obs: r1(r.obs),
    fc: Object.fromEntries(Object.entries(r.fc).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([L, x]) => [L, r1(x)]))]))}))));
  for(const id in res.models){ const m = res.models[id]; log(`${id.padEnd(7)} giornate ${String(m.n).padStart(4)}  fattore ×${m.factor.toFixed(2)}  peso ${m.weight.toFixed(2)}  errore ${m.mae == null ? "–" : m.mae.toFixed(1)} cm  nevicate ≥10 cm a 1 g: ${m.grosse[1].rapporto == null ? "–" : m.grosse[1].rapporto.toFixed(2)}`); }
  for(const L in res.verifica){ const v = res.verifica[L]; log(`verifica ${L} g: errore ${v.grezzo.mae?.toFixed(1)} → ${v.calibrato.mae?.toFixed(1)} cm su ${v.calibrato.n} giornate`); }
  log(`scritto ${OUT}/calibrazione.json e calibrazione.md in ${Math.round((Date.now() - t0) / 1000)} s`);
}

main().catch(e => { console.error("ERRORE:", e.message); process.exit(1); });
