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
export const scoreColor = s => s >= 7 ? "#22d3ee" : s >= 5 ? "#4ade80" : s >= 3 ? "#fbbf24" : "#94a3b8";
export const snowColor = cm => cm < 1 ? null : cm < 5 ? "#bae6fd" : cm < 10 ? "#7dd3fc" : cm < 20 ? "#38bdf8" : cm < 35 ? "#a78bfa" : "#e879f9";

export const state = {
  wx:{}, av:{}, avDate:{}, avErr:false, wxErr:false, demo:false, loading:false,
  area: LS.get("fr_area", "Tutti"), sort: LS.get("fr_sort", "powder"),
  fav: new Set(LS.get("fr_fav", [])), view: LS.get("fr_view", "tabella"), dir: -1, camArea: "Tutti", planArea: "Tutti", updated: null,
  stations: [], stationsDate: null,
  ens: {}, ensMemo: {}
};


/* Ricostruisce le liste di orari compattate dall'automazione ({"@h": inizio, n} / {"@d": inizio, n}) */
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
