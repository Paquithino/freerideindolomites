/* Rete finta per provare scripts/calibra.mjs senza internet (si carica con node --import).
   - Alto Adige: nessuna stazione (così si prova solo la rete Veneto)
   - ARPAV: elenco stazioni con le stesse sigle di dati-storici/arpav-neve.json
   - Open-Meteo: ogni modello "prevede" la neve vera ARPAV moltiplicata per un suo fattore noto
     (ICON +30%, GFS +10%, ECMWF −20%...), così il test sa che risultato aspettarsi. */
import { readFileSync } from "node:fs";

const dati = JSON.parse(readFileSync(new URL("../../dati-storici/arpav-neve.json", import.meta.url), "utf8")).stazioni;
const ids = Object.keys(dati).filter(id => id !== "arabba");
const pos = Object.fromEntries(ids.map((id, i) => [id, {lat: +(46.40 + i * 0.02).toFixed(4), lon: +(11.90 + i * 0.03).toFixed(4)}]));
const ARABBA = {lat: 46.4985, lon: 11.8745};
export const FATTORI = {icon_seamless: 1.3, gfs_seamless: 1.1, ecmwf_ifs: 0.8, ecmwf_ifs025: 0.8, meteofrance_seamless: 1.0, italia_meteo_arpae_icon_2i: 0.95};

const elenco = `<?xml version="1.0" encoding="ISO-8859-1"?><STAZIONI>${ids.map(id =>
  `<STAZIONE><IDSTAZ>${id}</IDSTAZ><NOME>${dati[id].nome}</NOME><X>${pos[id].lon}</X><Y>${pos[id].lat}</Y><QUOTA>${dati[id].quota || 2000}</QUOTA><LINKSTAZ>${id.padStart(4, "0")}.xml</LINKSTAZ></STAZIONE>`).join("")}</STAZIONI>`;
const latin1 = t => new Response(Buffer.from(t, "latin1"), {headers: {"content-type": "text/xml"}});

function stazioneDaLat(lat){
  if(Math.abs(lat - ARABBA.lat) < 1e-3) return dati.arabba;
  const id = ids.find(i => Math.abs(pos[i].lat - lat) < 1e-3); return id ? dati[id] : null;
}
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function ore(da, a){ const out = []; for(let t = Date.parse(da + "T00:00Z"); t <= Date.parse(a + "T23:00Z"); t += 3600e3) out.push(new Date(t).toISOString().slice(0, 16)); return out; }
const fattore = nome => FATTORI[nome] ?? 1;

globalThis.fetch = async (url) => {
  const u = new URL(url);
  if(u.host === "geoservices.buergernetz.bz.it") return Response.json({features: []});
  if(u.pathname.endsWith("stazioni_neve.xml") || u.pathname.endsWith("stazioni.xml")) return latin1(elenco);
  if(u.host === "meteo.arpa.veneto.it") return latin1("<STAZIONE></STAZIONE>");
  const lats = (u.searchParams.get("latitude") || "").split(",").map(Number);
  const T = ore(u.searchParams.get("start_date"), u.searchParams.get("end_date"));
  if(u.host === "previous-runs-api.open-meteo.com"){
    const k = fattore(u.searchParams.get("models"));
    return Response.json(lats.map(lat => {
      const st = stazioneDaLat(lat), hourly = {time: T};
      for(const L of [1, 2, 3]){
        hourly[`snowfall_previous_day${L}`] = T.map(t => {
          // l'ora t chiude l'intervallo (t-1h, t]: appartiene alla finestra 8→8 che parte il giorno g
          const g = new Date(Date.parse(t + "Z") - 9 * 3600e3).toISOString().slice(0, 10);
          const hn = st && st.hn[addDays(g, 1)];
          return hn == null ? 0 : hn / 24 * k * 0.7;   // 0,7: correctedSnow a -5 °C lo riporta circa ai cm
        });
        hourly[`temperature_2m_previous_day${L}`] = T.map(() => -5);
      }
      return {hourly};
    }));
  }
  if(u.host === "historical-forecast-api.open-meteo.com"){
    return Response.json(lats.map(() => ({hourly: {time: T, precipitation: T.map(() => 0.5), wind_speed_700hPa: T.map(() => 40), wind_direction_700hPa: T.map(() => 135)}})));
  }
  return new Response("non simulato: " + url, {status: 404});
};
