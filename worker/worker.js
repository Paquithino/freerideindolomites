/* =========================================================
   FreeRide in Dolomites — mini-backend (Cloudflare Worker)
   Endpoint:
     /api/meteo?<parametri Open-Meteo>  → proxy con cache 30 min
     /api/valanghe?prov=IT-34           → bollettino EAWS/AINEVA del giorno, cache 15 min
     /api/webcam?url=<immagine>         → immagine webcam (solo host consentiti), cache 5 min
   ========================================================= */

const PROVIDERS = ["IT-32-BZ", "IT-32-TN", "IT-34", "IT-36"];

// Solo questi fornitori di immagini: il worker non è un proxy aperto
const CAM_HOSTS = [
  "panodata.panomax.com",
  "wtvthmb.feratel.com", "wtvhspt.feratel.com", "wtvpict.feratel.com",
  "www.realcam4k.it", "4k.realcam.it", "4k.meteocam.it",
  "www.skylinewebcams.com", "embed.skylinewebcams.com",
  "www.impianticolfosco.it"
];

const TTL = { meteo: 1800, valanghe: 900, webcam: 300, stazioni: 1200 };

function cors(env){
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin"
  };
}
function json(data, env, ttl, status = 200){
  return new Response(JSON.stringify(data), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": `public, max-age=${ttl}`, ...cors(env) } });
}
function romeDate(offsetDays = 0){
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(d);
}
function romeHour(){
  return +new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hour12: false }).format(new Date());
}

/* Cache: usa la cache edge di Cloudflare con chiave = URL della richiesta */
async function cached(request, ttl, producer, ctx){
  const cache = caches.default;
  const key = new Request(new URL(request.url).toString(), { method: "GET" });
  let res = await cache.match(key);
  if(res) return res;
  res = await producer();
  if(res.ok){
    const copy = new Response(res.body, res);
    copy.headers.set("Cache-Control", `public, max-age=${ttl}`);
    ctx.waitUntil(cache.put(key, copy.clone()));
    return copy;
  }
  return res;
}

async function meteo(url, env){
  const q = url.searchParams.toString();
  const r = await fetch("https://api.open-meteo.com/v1/forecast?" + q, { cf: { cacheTtl: TTL.meteo } });
  const body = await r.text();
  return new Response(body, { status: r.status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(env) } });
}

async function valanghe(url, env){
  const prov = url.searchParams.get("prov");
  if(!PROVIDERS.includes(prov)) return json({ error: "prov non valido" }, env, 60, 400);
  // il bollettino del giorno dopo esce verso le 17
  const dates = romeHour() >= 17 ? [romeDate(1), romeDate(0)] : [romeDate(0), romeDate(-1)];
  for(const d of dates){
    const r = await fetch(`https://static.avalanche.report/eaws_bulletins/${d}/${d}-${prov}.json`, { cf: { cacheTtl: TTL.valanghe } });
    if(!r.ok) continue;
    const j = await r.json().catch(() => null);
    if(j && Array.isArray(j.bulletins) && j.bulletins.length) return json({ prov, date: d, bulletins: j.bulletins }, env, TTL.valanghe);
  }
  return json({ prov, date: null, bulletins: [] }, env, 600);
}

async function webcam(url, env){
  let target;
  try{ target = new URL(url.searchParams.get("url")); }catch(e){ return new Response("url non valido", { status: 400, headers: cors(env) }); }
  if(target.protocol !== "https:" || !CAM_HOSTS.includes(target.hostname))
    return new Response("host non consentito", { status: 403, headers: cors(env) });
  const r = await fetch(target.toString(), {
    headers: { "User-Agent": "FreeRideInDolomites/1.0 (+webcam preview)" },
    cf: { cacheTtl: TTL.webcam, cacheEverything: true }
  });
  const type = r.headers.get("Content-Type") || "";
  if(!r.ok || !type.startsWith("image/")) return new Response("immagine non disponibile", { status: 502, headers: cors(env) });
  return new Response(r.body, { headers: { "Content-Type": type, "Cache-Control": `public, max-age=${TTL.webcam}`, ...cors(env) } });
}

/* Stazioni nivometriche Euregio (Alto Adige, Trentino): file GeoJSON di avalanche.report, ridotto ai campi utili */
async function stazioni(env){
  const base = "https://static.avalanche.report/weather_stations/";
  const p = n => String(n).padStart(2, "0");
  const urls = [base + "stations.geojson"];
  for(let h = 0; h < 3; h++){
    const d = new Date(Date.now() - h * 3600e3);
    urls.push(`${base}${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}-00_stations.geojson`);
  }
  const num = v => (v === null || v === undefined || v === "" || isNaN(+v)) ? null : +v;
  for(const u of urls){
    const r = await fetch(u, { cf: { cacheTtl: TTL.stazioni } });
    if(!r.ok) continue;
    const geo = await r.json().catch(() => null);
    if(!geo || !Array.isArray(geo.features)) continue;
    const stations = [];
    for(const f of geo.features){
      const pr = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
      const hs = num(pr.HS);
      if(hs === null || c.length < 2) continue;
      const lon = +c[0], lat = +c[1];
      if(lat < 45.9 || lat > 47.0 || lon < 10.5 || lon > 13.3) continue;
      stations.push({ id: pr["LWD-Nummer"] || pr.name, name: pr.name || pr["LWD-Nummer"], lat, lon, elev: num(c[2]),
        hs, d24: num(pr.HSD24), d48: num(pr.HSD48), d72: num(pr.HSD72), lt: num(pr.LT),
        region: pr["LWD-Region"] || "", operator: pr.operator || "", date: pr.date || null });
    }
    if(stations.length) return json({ updated: new Date().toISOString(), source: u, stations }, env, TTL.stazioni);
  }
  return json({ updated: null, stations: [] }, env, 300);
}

export default {
  async fetch(request, env, ctx){
    if(request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    if(request.method !== "GET") return new Response("metodo non consentito", { status: 405, headers: cors(env) });
    const url = new URL(request.url);
    try{
      switch(url.pathname){
        case "/api/meteo":    return cached(request, TTL.meteo, () => meteo(url, env), ctx);
        case "/api/valanghe": return cached(request, TTL.valanghe, () => valanghe(url, env), ctx);
        case "/api/stazioni": return cached(request, TTL.stazioni, () => stazioni(env), ctx);
        case "/api/webcam":   return cached(request, TTL.webcam, () => webcam(url, env), ctx);
        case "/":             return json({ ok: true, endpoints: ["/api/meteo", "/api/valanghe?prov=IT-34", "/api/webcam?url=..."] }, env, 60);
        default:              return new Response("non trovato", { status: 404, headers: cors(env) });
      }
    }catch(e){
      return json({ error: String(e && e.message || e) }, env, 30, 500);
    }
  }
};
