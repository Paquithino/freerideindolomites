/* =========================================================
   STATO e utilità condivise
   ========================================================= */
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const LS = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
export const r0 = v => v == null || isNaN(v) ? "–" : Math.round(v);
export const r1 = v => v == null || isNaN(v) ? "–" : (Math.round(v * 10) / 10).toLocaleString("it-IT");
/* colori dell'indice: variabili CSS, così seguono il tema chiaro/scuro */
export const scoreColor = s => s >= 7 ? "var(--pw4)" : s >= 5 ? "var(--pw3)" : s >= 3 ? "var(--pw2)" : "var(--pw1)";
export const snowColor = cm => cm < 1 ? null : cm < 5 ? "#e0f2fe" : cm < 10 ? "#bae6fd" : cm < 20 ? "#7dd3fc" : cm < 35 ? "#38bdf8" : "#0ea5e9";

/* fetch con nuovi tentativi: errori di rete, 429 (troppe richieste) e 5xx (server)
   capitano ogni tanto e di solito passano dopo pochi secondi */
/* Nel browser si ritenta poco (chi guarda il telefono non deve aspettare mezzo minuto: i test
   hanno misurato 27 s di attesa con le fonti irraggiungibili); il robot su GitHub invece ha tempo. */
const NEL_BROWSER = typeof window !== "undefined";
export async function fetchRetry(url, opt = {}, tries = NEL_BROWSER ? 2 : 3){
  let last;
  const pause = NEL_BROWSER ? [0, 1500] : [0, 3000, 10000];
  for(let i = 0; i < tries; i++){
    if(i) await new Promise(r => setTimeout(r, pause[i] || pause[pause.length - 1]));
    try{
      const r = await fetch(url, opt);
      if(r.ok || (r.status < 500 && r.status !== 429)) return r;
      last = new Error("HTTP " + r.status);
    }catch(e){
      // in Node il motivo vero sta in e.cause (es. ECONNRESET, timeout)
      last = new Error(e.message + (e.cause ? " (" + (e.cause.code || e.cause.message || e.cause) + ")" : ""));
    }
  }
  throw last;
}

export const state = {
  cal: null,
  quote: null,
  wx:{}, av:{}, avDate:{}, avErr:false, wxErr:false, demo:false, loading:false,
  area: LS.get("fr_area", "Tutti"), sort: LS.get("fr_sort", "powder"),
  fav: new Set(LS.get("fr_fav", [])), view: LS.get("fr_view", "tabella"), modo: LS.get("fr_modo", null), ventoUnita: LS.get("fr_vento", "kmh"), dir: -1, camArea: "Tutti", planArea: "Tutti", planMode: LS.get("fr_pvmode", "giorno"), updated: null,
  stations: [], stationsDate: null,
  ens: {}, ensMemo: {}
};


/* Ricostruisce le liste di orari compattate dall'automazione ({"@h": inizio, n} / {"@d": inizio, n}) */
/* liste di orari regolari -> {"@h": primo, n} / {"@d": primo, n} (le scrive il robot, unpackTimes le ricostruisce) */
export function packTimes(arr){
  if(!Array.isArray(arr) || arr.length < 3 || typeof arr[0] !== "string") return arr;
  const hourly = arr[0].length === 16, step = hourly ? 3600e3 : 864e5;
  const toMs = s => Date.parse(s + (hourly ? ":00Z" : "T00:00:00Z"));
  const t0 = toMs(arr[0]);
  for(let i = 1; i < arr.length; i++) if(toMs(arr[i]) - t0 !== i * step) return arr;   // non regolare: lascio così
  return hourly ? {"@h": arr[0], n: arr.length} : {"@d": arr[0], n: arr.length};
}
export function unpackTimes(obj){
  if(Array.isArray(obj)){ obj.forEach(unpackTimes); return obj; }
  if(!obj || typeof obj !== "object") return obj;
  for(const k in obj){
    const v = obj[k];
    if(k === "time" && v && typeof v === "object" && !Array.isArray(v) && (v["@h"] || v["@d"])){
      const hourly = !!v["@h"], start = Date.parse(hourly ? v["@h"] + ":00Z" : v["@d"] + "T00:00:00Z"), step = hourly ? 3600e3 : 864e5;
      obj[k] = Array.from({length: v.n}, (_, i) => new Date(start + i * step).toISOString().slice(0, hourly ? 16 : 10));
    }else if(v && typeof v === "object") unpackTimes(v);
  }
  return obj;
}
