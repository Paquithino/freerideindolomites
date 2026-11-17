/* =========================================================
   CALIBRAZIONE SUGLI INVERNI PASSATI
   Uso:  node scripts/calibra.mjs          (scrive in ARCHIVIO_DIR, default "archivio")
   Cosa fa:
     1. sceglie le stazioni nivometriche della Provincia di Bolzano (open data CC0)
        vicine agli spot dolomitici e sopra i 1.400 m
     2. scarica l'altezza neve misurata negli inverni passati
     3. scarica da Open-Meteo "Previous Runs" ciò che ogni modello prevedeva
        1, 2 e 3 giorni prima, alla posizione e alla quota di ogni stazione
     4. scarica il vento in quota (archivio Open-Meteo) per riconoscere i regimi
     5. calcola fattori e pesi dei modelli (js/calibrazione.js) e li verifica
        inverno per inverno; scrive calibrazione.json e un resoconto leggibile
   ========================================================= */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SPOTS, MODELS } from "../js/config.js";
import { correctedSnow, classify } from "../js/modelli.js";
import { calibra } from "../js/calibrazione.js";

const OUT = process.env.ARCHIVIO_DIR || "archivio";
const BZ = "http://daten.buergernetz.bz.it/services/meteo/v1";
const PREV = "https://previous-runs-api.open-meteo.com/v1/forecast";
const HIST = "https://historical-forecast-api.open-meteo.com/v1/forecast";
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
    s.push({id: `${start.slice(0, 4)}-${String(+start.slice(2, 4) + 1).padStart(2, "0")}`, from: start, to: ieri});
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
      const r = await fetch(url);
      if(r.ok) return await r.json();
      last = new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
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
    await sleep(300);
  }
  const hs = {};
  for(const g of giorni(from, addDays(to, 1))){
    const t = toMin(g + "T08:00");
    const w = punti.filter(p => Math.abs(p.t - t) <= 60).map(p => p.v).sort((a, b) => a - b);
    hs[g] = w.length ? w[Math.floor(w.length / 2)] : null;
  }
  return hs;
}

/* ---------- 3. previsioni passate dei modelli ---------- */
const LEADS = [1, 2, 3];
async function previsioni(stazioni, modello, st){
  const hourly = LEADS.flatMap(L => [`snowfall_previous_day${L}`, `temperature_2m_previous_day${L}`]).join(",");
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
          const sf = H[`snowfall_previous_day${L}`], tt = H[`temperature_2m_previous_day${L}`];
          if(!sf) continue;
          const acc = {};
          (H.time || []).forEach((t, i) => {
            // il valore delle 9:00 è la neve caduta tra le 8 e le 9: appartiene alla finestra che parte alle 8
            const k = toMin(t.slice(0, 16)) - 60;
            const g = new Date((k - 8 * 60) * 60000).toISOString().slice(0, 10);
            const v = correctedSnow(sf[i], tt ? tt[i] : null);
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
async function regimi(stazioni, st){
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
        const k = toMin(t.slice(0, 16)) - 60, g = new Date((k - 8 * 60) * 60000).toISOString().slice(0, 10);
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

/* ---------- resoconto leggibile ---------- */
const f1 = v => v == null ? "–" : (Math.round(v * 10) / 10).toLocaleString("it-IT");
const f2 = v => v == null ? "–" : (Math.round(v * 100) / 100).toLocaleString("it-IT");
function resoconto(res, staz, righe){
  const lab = id => (MODELS.find(m => m.id === id) || {}).label || id;
  let md = `# Calibrazione dei modelli\n\nGenerata il ${res.generated.slice(0, 10)} su ${staz.length} stazioni nivometriche dell'Alto Adige (open data Provincia di Bolzano, CC0) e ${righe.length} giornate negli inverni ${res.stagioni.join(", ")}.\n\n`;
  md += `Neve misurata = aumento dell'altezza neve tra le 8:00 di un giorno e le 8:00 del giorno dopo (la neve che "resta", al netto dell'assestamento). Contano le giornate con almeno 1 cm misurato o previsto.\n\n`;
  md += `## Modelli\n\n| Modello | Giornate | Fattore | Errore medio (cm) | Peso | Fattore a 1 / 2 / 3 giorni |\n|---|---|---|---|---|---|\n`;
  for(const id in res.models){ const m = res.models[id];
    md += `| ${lab(id)} | ${m.n} | ${m.ok ? "×" + f2(m.factor) : "neutro (pochi dati)"} | ${f1(m.mae)} | ${f2(m.weight)} | ${[1, 2, 3].map(L => "×" + f2(m.perAnticipo[L].factor)).join(" / ")} |\n`; }
  md += `\nFattore < 1: il modello tende a prevedere più neve di quella misurata. Peso > 1: sbaglia meno della media.\n\n## Verifica fuori campione\n\nPer ogni inverno i fattori sono calcolati sugli altri inverni e messi alla prova su quello.\n\n| Anticipo | Giornate | Errore medio prima | Errore medio dopo | Nevicate ≥10 cm prese (prima → dopo) | Falsi allarmi (prima → dopo) |\n|---|---|---|---|---|---|\n`;
  for(const L in res.verifica){ const v = res.verifica[L];
    md += `| ${L} giorno/i | ${v.calibrato.n} | ${f1(v.grezzo.mae)} cm | ${f1(v.calibrato.mae)} cm | ${v.grezzo.prese}/${v.grezzo.nevicateGrosse} → ${v.calibrato.prese}/${v.calibrato.nevicateGrosse} | ${v.grezzo.falsiAllarmi} → ${v.calibrato.falsiAllarmi} |\n`; }
  md += `\n## Regimi dei venti (stazioni dell'Alto Adige)\n\nRapporto tra neve misurata e prevista (mediana dei modelli, 1 giorno prima): sopra 1 i modelli sottostimano.\n\n| Regime | Giornate | Misurata (cm) | Prevista (cm) | Rapporto |\n|---|---|---|---|---|\n`;
  for(const k in res.regimi){ const g = res.regimi[k]; md += `| ${k} | ${g.giorni} | ${Math.round(g.misurata)} | ${Math.round(g.prevista)} | ${f2(g.rapporto)} |\n`; }
  md += `\n## Stazioni usate\n\n${staz.map(s => `- ${s.name} (${s.code}), ${s.alt} m, ${f1(s.km)} km dallo spot più vicino`).join("\n")}\n`;
  return md;
}

/* ---------- main ---------- */
async function main(){
  const t0 = Date.now();
  const st = stagioni();
  log("inverni:", st.map(s => `${s.id} (${s.from} → ${s.to})`).join(", "));
  const staz = await scegliStazioni();
  if(!staz.length) throw new Error("Nessuna stazione con sensore neve trovata: il servizio della Provincia di Bolzano potrebbe essere cambiato");
  log("stazioni:", staz.map(s => `${s.name} ${s.alt} m`).join(", "));

  const righe = [];
  for(const s of st){
    log(`— inverno ${s.id}`);
    const oss = [];
    for(const x of staz){ oss.push(await neveAlle8(x.code, s.from, s.to)); }
    log(`  neve misurata: ${oss.filter(o => Object.values(o).some(v => v != null)).length}/${staz.length} stazioni con dati`);
    const prev = {};
    for(const m of MODELS){
      const p = await previsioni(staz, m, s);
      if(p){ prev[m.id] = p; log(`  ${m.id}: ok`); }
    }
    const reg = await regimi(staz, s);
    staz.forEach((x, i) => {
      for(const g of giorni(s.from, s.to)){
        const h0 = oss[i][g], h1 = oss[i][addDays(g, 1)];
        const obs = h0 == null || h1 == null ? null : (h1 - h0 > 150 ? null : Math.max(0, h1 - h0));
        if(obs == null) continue;
        const fc = {};
        for(const mid in prev){ const v = prev[mid][i] && prev[mid][i][g]; if(v) fc[mid] = v; }
        if(!Object.keys(fc).length) continue;
        righe.push({date: g, station: x.code, season: s.id, obs, regime: reg && reg[i] ? reg[i][g] || null : null, fc});
      }
    });
    log(`  giornate valide finora: ${righe.length}`);
  }
  if(righe.length < 50) throw new Error(`Troppe poche giornate valide (${righe.length}): non scrivo la calibrazione`);

  const res = {generated: new Date().toISOString(), ...calibra(righe, MODELS.map(m => m.id)),
    stazioni: staz.map(({code, name, alt, lat, lon, km}) => ({code, name, alt, lat, lon, km})),
    fonti: "Altezza neve: Provincia autonoma di Bolzano, open data meteo (CC0). Previsioni passate e vento: Open-Meteo.com Previous Runs e Historical Forecast API (CC BY 4.0)."};
  mkdirSync(OUT, {recursive: true});
  writeFileSync(join(OUT, "calibrazione.json"), JSON.stringify(res, null, 1));
  writeFileSync(join(OUT, "calibrazione.md"), resoconto(res, staz, righe));
  const r1 = x => Math.round(x * 10) / 10;
  writeFileSync(join(OUT, "calibrazione-giornate.json"), JSON.stringify(righe.map(r => ({...r, obs: r1(r.obs),
    fc: Object.fromEntries(Object.entries(r.fc).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([L, x]) => [L, r1(x)]))]))}))));
  for(const id in res.models){ const m = res.models[id]; log(`${id.padEnd(7)} giornate ${String(m.n).padStart(4)}  fattore ×${m.factor.toFixed(2)}  peso ${m.weight.toFixed(2)}  errore ${m.mae == null ? "–" : m.mae.toFixed(1)} cm`); }
  for(const L in res.verifica){ const v = res.verifica[L]; log(`verifica ${L} g: errore ${v.grezzo.mae?.toFixed(1)} → ${v.calibrato.mae?.toFixed(1)} cm su ${v.calibrato.n} giornate`); }
  log(`scritto ${OUT}/calibrazione.json e calibrazione.md in ${Math.round((Date.now() - t0) / 1000)} s`);
}

main().catch(e => { console.error("ERRORE:", e.message); process.exit(1); });
