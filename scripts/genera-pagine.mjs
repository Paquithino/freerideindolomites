/* =========================================================
   GENERA PAGINE — dopo "vite build" crea una pagina HTML vera per ogni indirizzo
   (home, spot/, spot/<zona>/, spot/<spot>/, previsione/, valanghe/, webcam/, guida/),
   con titolo, descrizione, link canonico, anteprima social, dati strutturati e il testo
   principale già scritto dentro (Google lo legge senza eseguire il JavaScript).
   Poi sitemap.xml, robots.txt e 404.html.

   Uso:  node scripts/genera-pagine.mjs [cartella-build]      (predefinita: dist)
   Indirizzo del sito: variabile SITO_URL (es. https://www.miodominio.it/), altrimenti GitHub Pages.
   ========================================================= */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SPOTS, FORECAST_DAYS, PROV_NAME } from "../js/config.js";
import { state, unpackTimes, esc, r0 } from "../js/state.js";
import { metrics, dailyPlan, bestDay, wmo, dayName, dayNum } from "../js/meteo.js";
import { quoteHTML } from "../js/quote.js";
import { avForSpot, avBlockHTML, DNAME, bollettiniPerServizio, gradiHTML, problemiHTML, testiHTML, intestazione, stripTags } from "../js/valanghe.js";
import { giudizio } from "../js/giudizio.js";
import { tutteLeRotte, metaPer, coverHTML, percorsoSpot, percorsoArea, AREE, SITO_NOME , gruppoHTML, tabellaHTML } from "../js/pagine.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, process.argv[2] || "dist");
const SITO = (process.env.SITO_URL || "https://paquithino.github.io/freerideindolomites/").replace(/\/?$/, "/");
const BASE = new URL(SITO).pathname;
const log = (...a) => console.log(...a);

/* ---------- dati (se la build contiene il file del robot) ---------- */
let generato = null;
const fileDati = join(DIST, "dati", "ultimo.json");
if(existsSync(fileDati)){
  try{
    const j = unpackTimes(JSON.parse(readFileSync(fileDati, "utf8")));
    Object.assign(state, {wx: j.wx || {}, ens: j.ens || {}, ensMemo: {}, cal: j.cal || null, quote: j.quote || null, camCheck: j.camCheck || null,
      av: j.av || {}, avDate: j.avDate || {}, avErr: !!j.avErr, stations: j.stations || [], demo: !!j.demo});
    generato = j.generated ? new Date(j.generated) : null;
  }catch(e){ log("dati non leggibili, pagine senza numeri:", e.message); }
}
const conDati = Object.keys(state.wx || {}).length > 0;
const quando = generato ? generato.toLocaleDateString("it-IT", {weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome"}).replace(/^./, c => c.toUpperCase())
  + " · ore " + generato.toLocaleTimeString("it-IT", {hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"}) : "";
const nomeCorto = s => s.name.split(" · ")[0];

/* ---------- testo già scritto nelle pagine ---------- */
function rigaSpot(s){
  const m = conDati ? metrics(s) : null, av = avForSpot(s);
  return `<a class="card" href="${percorsoSpot(s.id)}" data-spot="${s.id}"><h3>${esc(s.name)}</h3>
    <div class="sub">${esc(s.area)} · ${esc(s.zones)}</div>
    ${m ? `<p class="note">Neve fresca 48 ore: <b>${r0(m.p48)} cm</b> · in arrivo 3 giorni: <b>+${r0(m.n72)} cm</b>${av ? ` · valanghe: <b>${DNAME[av.level]}</b>` : ""}</p>` : ""}</a>`;
}
function inBreve(){
  const ms = SPOTS.map(s => [s, metrics(s)]).filter(x => x[1]);
  if(!ms.length) return "";
  const top = ms.reduce((a, b) => b[1].p48 > a[1].p48 ? b : a), nxt = ms.reduce((a, b) => b[1].n72 > a[1].n72 ? b : a);
  return `<h2 class="ttl sez">In breve</h2><div class="ib">
    <a class="k" href="${percorsoSpot(top[0].id)}"><span class="kt"><span>Più neve fresca · 48 ore</span><b>${esc(nomeCorto(top[0]))}</b></span><em>${r0(top[1].p48)}<small> cm</small></em></a>
    <a class="k" href="${percorsoSpot(nxt[0].id)}"><span class="kt"><span>In arrivo nei prossimi 3 giorni</span><b>${esc(nomeCorto(nxt[0]))}</b></span><em>+${r0(nxt[1].n72)}<small> cm</small></em></a></div>`;
}
function paginaSpot(s){
  const m = conDati ? metrics(s) : null, av = avForSpot(s), best = conDati ? bestDay(s) : null;
  const sec = tabellaHTML;
  let h = `<p class="dzone">⛰ ${esc(s.zones)} · quota di riferimento ${s.elev.toLocaleString("it-IT")} m</p>`;
  // stesse 5 sezioni della pagina vera: dati raccolti, previsioni, valanghe, 3D, webcam
  let dati = "", prev = "";
  if(m){
    const g = giudizio(m, av);
    dati += sec("o-now", "Adesso", `<p><b>${esc(g.txt)}.</b> ${esc(g.sub)}</p>
      <p>Temperatura a ${s.elev} m: <b>${r0(m.temp)} °C</b>.</p>`);
    dati += sec("o-snow", "Neve fresca · stima del modello", `<p>Ultime 48 ore: <b>${r0(m.p48)} cm</b> · in arrivo nei prossimi 3 giorni: <b>+${r0(m.n72)} cm</b> · nei prossimi 7 giorni: <b>+${r0(m.n7d)} cm</b>.</p>`);
    const p = dailyPlan(s);
    prev += sec("o-plan", `Previsioni · prossimi ${FORECAST_DAYS} giorni`, `<div class="st-wrap"><table class="st"><thead><tr><th class="l">Giorno</th><th>Cielo</th><th>Neve fresca</th><th>Temperatura</th></tr></thead><tbody>
      ${p.map(d => `<tr><td class="l">${dayName(d.date)} ${dayNum(d.date)}</td><td>${wmo(d.code)[1]}</td><td>${d.snow >= 0.5 ? r0(d.snow) + " cm" : "–"}</td><td>${r0(d.tmin)}° / ${r0(d.tmax)}°</td></tr>`).join("")}
      </tbody></table></div>${best ? `<p class="note">Giornata migliore: ${dayName(best.date)} ${dayNum(best.date)}, circa ${r0(best.fresh)} cm di neve fresca.</p>` : ""}`);
  }
  if(state.quote) prev += sec("o-quote", "Neve per quota · Vetta, Metà, Base", quoteHTML(s));
  h += gruppoHTML(0, dati) + gruppoHTML(1, prev);
  h += gruppoHTML(2, sec("o-av", "Pericolo valanghe · bollettino ufficiale", avBlockHTML(s)));
  const vicini = SPOTS.filter(x => x.area === s.area && x.id !== s.id);
  h += `<section class="sec o-altri" id="o-altri"><h2 class="sh">Altri spot in ${esc((AREE.find(a => a.area === s.area) || {}).nome || s.area)}</h2>
    <ul class="altri">${vicini.map(x => `<li><a href="${percorsoSpot(x.id)}">${esc(x.name)}</a></li>`).join("")}</ul><p><a href="${percorsoArea(s.area)}">Tutti gli spot della zona</a></p></section>`;
  return h;
}
function paginaPrevisione(){
  if(!conDati) return "";
  const giorni = dailyPlan(SPOTS[0]).slice(0, 7).map(d => d.date);
  return `<div class="st-wrap"><table class="st"><thead><tr><th class="l">Spot</th>${giorni.map(g => `<th>${dayName(g)} ${dayNum(g)}</th>`).join("")}</tr></thead><tbody>
    ${SPOTS.map(s => { const p = Object.fromEntries(dailyPlan(s).map(d => [d.date, d])); return `<tr><td class="l"><a href="${percorsoSpot(s.id)}">${esc(nomeCorto(s))}</a></td>${giorni.map(g => `<td>${p[g] && p[g].snow >= 0.5 ? r0(p[g].snow) + " cm" : "–"}</td>`).join("")}</tr>`; }).join("")}
    </tbody></table></div>`;
}
function paginaValanghe(){
  const sv = bollettiniPerServizio(SPOTS);
  if(!sv.length) return `<div class="sec note">Nessun bollettino valanghe attivo in questo momento: i servizi valanghe di solito iniziano a pubblicarli a dicembre.</div>`;
  return sv.map(x => `<div class="avsrv"><h2 class="ttl">${esc(x.nome)}</h2>${x.items.map(({b, level, spots}) => `<div class="sec">
    <h3>${DNAME[level] || ""} · ${esc((b.regions || []).map(r => r.name).slice(0, 4).join(", "))}</h3>
    ${spots.length ? `<p class="note">Spot: ${spots.map(s => `<a href="${percorsoSpot(s.id)}">${esc(nomeCorto(s))}</a>`).join(", ")}</p>` : ""}
    ${gradiHTML(b)}${problemiHTML(b)}${testiHTML(b)}${intestazione(b, x.p)}</div>`).join("")}</div>`).join("");
}
function paginaWebcam(){
  return SPOTS.map(s => `<div class="sec"><h2 class="sh"><a href="${percorsoSpot(s.id)}">${esc(s.name)}</a></h2>
    <ul>${s.cams.map(c => `<li>${esc(c.t)}${c.src ? ` · © ${esc(c.src)}` : ""}</li>`).join("")}</ul></div>`).join("");
}

/* ---------- dati strutturati (schema.org) ---------- */
function jsonLd(r, meta){
  const url = SITO + r.path;
  const grafo = [{"@type": "WebSite", "@id": SITO + "#sito", url: SITO, name: SITO_NOME, inLanguage: "it-IT"}];
  const briciole = [{name: "Home", url: SITO}];
  if(r.vista === "lista" && r.area) briciole.push({name: "Spot", url: SITO + "spot/"}, {name: AREE.find(a => a.area === r.area).nome, url});
  else if(r.vista === "lista") briciole.push({name: "Spot", url});
  else if(r.vista === "spot"){
    const s = SPOTS.find(x => x.id === r.id), z = AREE.find(a => a.area === s.area);
    briciole.push({name: "Spot", url: SITO + "spot/"}, {name: z.nome, url: SITO + percorsoArea(s.area)}, {name: nomeCorto(s), url});
    grafo.push({"@type": "Place", name: s.name, description: meta.description, url,
      geo: {"@type": "GeoCoordinates", latitude: s.lat, longitude: s.lon, elevation: s.elev},
      containedInPlace: {"@type": "AdministrativeArea", name: z.nome}});
  }
  else if(r.vista !== "home") briciole.push({name: meta.h1, url});
  grafo.push({"@type": "WebPage", "@id": url, url, name: meta.title, description: meta.description, isPartOf: {"@id": SITO + "#sito"}, inLanguage: "it-IT",
    ...(generato ? {dateModified: generato.toISOString()} : {})});
  if(briciole.length > 1) grafo.push({"@type": "BreadcrumbList", itemListElement: briciole.map((b, i) => ({"@type": "ListItem", position: i + 1, name: b.name, item: b.url}))});
  return `<script type="application/ld+json">${JSON.stringify({"@context": "https://schema.org", "@graph": grafo}).replace(/</g, "\\u003c")}</script>`;
}

/* ---------- testa della pagina ---------- */
const attr = v => esc(v);
function testa(html, meta, url, extra = ""){
  html = html.replace(/<base href="[^"]*">/, `<base href="${BASE}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(meta.description)}">`)
    .replace(/<link rel="canonical"[^>]*>/, url ? `<link rel="canonical" href="${url}" data-radice="${SITO}">` : "")
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attr(meta.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${attr(meta.description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, url ? `<meta property="og:url" content="${url}">` : "")
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITO}og-image.jpg">`);
  if(!/og:description/.test(html)) html = html.replace("</head>", `<meta property="og:description" content="${attr(meta.description)}">\n</head>`);
  return html.replace("<!--DATI-STRUTTURATI-->", "").replace("</head>", `${extra}\n</head>`);
}
const scrivi = (rel, html) => { const f = join(DIST, rel); mkdirSync(dirname(f), {recursive: true}); writeFileSync(f, html); };

/* ---------- pagine dell'app ---------- */
const tpl = readFileSync(join(DIST, "index.html"), "utf8");
const VISTA = {home: "v-spot", lista: "v-spot", spot: "v-detail", previsione: "v-pianifica", valanghe: "v-valanghe", webcam: "v-webcam"};
const rotte = tutteLeRotte();
for(const r of rotte){
  const meta = metaPer(r), url = SITO + r.path;
  let html = testa(tpl, meta, url, jsonLd(r, meta));
  html = html.replace(/<body[^>]*>/, `<body data-vista="${r.vista}">`)
    .replace(/(<div class="cover" id="cover"[^>]*>)(<\/div>)/, `$1${coverHTML(r, quando)}$2`)
    .replace(`<section class="view" id="${VISTA[r.vista]}">`, `<section class="view on" id="${VISTA[r.vista]}">`);
  if(r.vista === "home" || r.vista === "lista"){
    const lista = r.area ? SPOTS.filter(s => s.area === r.area) : SPOTS;
    if(r.vista === "home" && conDati) html = html.replace('<div class="hero" id="hero"></div>', `<div class="hero" id="hero">${inBreve()}</div>`);
    if(r.vista === "lista") html = html.replace(/(<h2 class="ttl sez" id="spotTitle">)[^<]*(<\/h2>)/, `$1${esc(r.area ? "Spot · " + AREE.find(a => a.area === r.area).nome : "Tutti gli spot")}$2`);
    html = html.replace('<div class="list" id="list"></div>', `<div class="list" id="list">${lista.map(rigaSpot).join("")}</div>`);
  }
  else if(r.vista === "spot") html = html.replace(`<section class="view on" id="v-detail"></section>`, `<section class="view on" id="v-detail">${paginaSpot(SPOTS.find(s => s.id === r.id))}</section>`);
  else if(r.vista === "previsione") html = html.replace('<div id="planTable"></div>', `<div id="planTable">${paginaPrevisione()}</div>`);
  else if(r.vista === "valanghe") html = html.replace('<div id="avBulletins"></div>', `<div id="avBulletins">${paginaValanghe()}</div>`);
  else if(r.vista === "webcam") html = html.replace('<div class="list" id="camList"></div>', `<div class="list" id="camList">${paginaWebcam()}</div>`);
  scrivi(join(r.path, "index.html"), html);
}

/* ---------- guida ---------- */
const fileGuida = join(DIST, "html", "info.html");
if(existsSync(fileGuida)){
  const g = readFileSync(fileGuida, "utf8").replace(/(["'(])\.\.\/(assets|js|css)\//g, "$1$2/");
  const meta = {title: (g.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "Guida", description: (g.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ""};
  const r = {vista: "guida", path: "guida/"};
  const html = testa(g, {...meta, title: meta.title.replace(/&amp;/g, "&")}, SITO + "guida/", jsonLd(r, {...meta, h1: "Guida"}));
  scrivi("guida/index.html", html);
  // il vecchio indirizzo html/info.html resta, ma indica la guida come pagina principale
  scrivi("html/info.html", html);
}

/* ---------- 404, sitemap, robots ---------- */
scrivi("404.html", testa(tpl, metaPer({vista: "home"}), null, `<meta name="robots" content="noindex">`).replace(/<body[^>]*>/, `<body data-vista="home">`));
const oggi = (generato || new Date()).toISOString().slice(0, 10);
const indirizzi = [...rotte.map(r => r.path), "guida/"];
scrivi("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indirizzi.map(p =>
  `  <url><loc>${SITO}${p}</loc><lastmod>${oggi}</lastmod><changefreq>${p === "guida/" ? "monthly" : "hourly"}</changefreq><priority>${p === "" ? "1.0" : p.startsWith("spot/") && p.split("/").length > 2 ? "0.8" : "0.6"}</priority></url>`).join("\n")}\n</urlset>\n`);
scrivi("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITO}sitemap.xml\n`);

log(`pagine create: ${rotte.length} + guida, 404, sitemap.xml (${indirizzi.length} indirizzi), robots.txt · sito ${SITO}${conDati ? "" : " · senza dati (solo testi fissi)"}`);
