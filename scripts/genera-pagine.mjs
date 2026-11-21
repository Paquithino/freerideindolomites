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
import { tutteLeRotte, metaPer, coverHTML, percorsoSpot, percorsoArea, AREE, SITO_NOME , gruppoHTML, tabellaHTML, href, nomeArea } from "../js/pagine.js";
import { t, url, impostaLingua, lingua, loc, num, traduciHTML } from "../js/i18n.js";
import { badgeLingua } from "../js/badge-lingua.js";

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
const quandoIn = () => generato ? generato.toLocaleDateString(loc(), {weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome"}).replace(/^./, c => c.toUpperCase())
  + (lingua() === "en" ? " · " : " · ore ") + generato.toLocaleTimeString(loc(), {hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"}) : "";
const nomeCorto = s => s.name.split(" · ")[0];

/* ---------- testo già scritto nelle pagine ---------- */
function rigaSpot(s){
  const m = conDati ? metrics(s) : null, av = avForSpot(s);
  return `<a class="card" href="${href(percorsoSpot(s.id))}" data-spot="${s.id}"><h3>${esc(s.name)}</h3>
    <div class="sub">${esc(nomeArea(s.area))} · ${esc(s.zones)}</div>
    ${m ? `<p class="note">${t("Neve fresca 48 ore")}: <b>${r0(m.p48)} cm</b> · ${t("in arrivo 3 giorni")}: <b>+${r0(m.n72)} cm</b>${av ? ` · ${t("valanghe")}: <b>${t(DNAME[av.level])}</b>` : ""}</p>` : ""}</a>`;
}
function inBreve(){
  const ms = SPOTS.map(s => [s, metrics(s)]).filter(x => x[1]);
  if(!ms.length) return "";
  const top = ms.reduce((a, b) => b[1].p48 > a[1].p48 ? b : a), nxt = ms.reduce((a, b) => b[1].n72 > a[1].n72 ? b : a);
  return `<h2 class="ttl sez">${t("In breve")}</h2><div class="ib">
    <a class="k" href="${href(percorsoSpot(top[0].id))}"><span class="kt"><span>${t("Più neve fresca · 48 ore")}</span><b>${esc(nomeCorto(top[0]))}</b></span><em>${r0(top[1].p48)}<small> cm</small></em></a>
    <a class="k" href="${href(percorsoSpot(nxt[0].id))}"><span class="kt"><span>${t("In arrivo nei prossimi 3 giorni")}</span><b>${esc(nomeCorto(nxt[0]))}</b></span><em>+${r0(nxt[1].n72)}<small> cm</small></em></a></div>`;
}
function paginaSpot(s){
  const m = conDati ? metrics(s) : null, av = avForSpot(s), best = conDati ? bestDay(s) : null;
  const sec = tabellaHTML;
  let h = `<p class="dzone">⛰ ${esc(s.zones)} · ${t("quota di riferimento")} ${num(s.elev)} m</p>`;
  // stesse 5 sezioni della pagina vera: dati raccolti, previsioni, valanghe, 3D, webcam
  let dati = "", prev = "";
  if(m){
    const g = giudizio(m, av);
    dati += sec("o-now", t("Adesso"), `<p><b>${esc(g.txt)}.</b> ${esc(g.sub)}</p>
      <p>${t("Temperatura a {q} m", {q: num(s.elev)})}: <b>${r0(m.temp)} °C</b>.</p>`);
    dati += sec("o-snow", t("Neve fresca · stima del modello"), `<p>${t("Ultime 48 ore")}: <b>${r0(m.p48)} cm</b> · ${t("in arrivo nei prossimi 3 giorni")}: <b>+${r0(m.n72)} cm</b> · ${t("nei prossimi 7 giorni")}: <b>+${r0(m.n7d)} cm</b>.</p>`);
    const p = dailyPlan(s);
    prev += sec("o-plan", t("Previsioni · prossimi {n} giorni", {n: FORECAST_DAYS}), `<div class="st-wrap"><table class="st"><thead><tr><th class="l">${t("Giorno")}</th><th>${t("Cielo")}</th><th>${t("neve fresca")}</th><th>${t("Temperatura")}</th></tr></thead><tbody>
      ${p.map(d => `<tr><td class="l">${dayName(d.date)} ${dayNum(d.date)}</td><td>${wmo(d.code)[1]}</td><td>${d.snow >= 0.5 ? r0(d.snow) + " cm" : "–"}</td><td>${r0(d.tmin)}° / ${r0(d.tmax)}°</td></tr>`).join("")}
      </tbody></table></div>${best ? `<p class="note">${t("Giornata migliore")}: ${dayName(best.date)} ${dayNum(best.date)}, ${t("circa {cm} cm di neve fresca", {cm: r0(best.fresh)})}.</p>` : ""}`);
  }
  if(state.quote) prev += sec("o-quote", t("Neve per quota · Vetta, Metà, Base"), quoteHTML(s));
  h += gruppoHTML(0, dati) + gruppoHTML(1, prev);
  h += gruppoHTML(2, sec("o-av", t("Pericolo valanghe · bollettino ufficiale"), avBlockHTML(s)));
  const vicini = SPOTS.filter(x => x.area === s.area && x.id !== s.id);
  h += `<section class="sec o-altri" id="o-altri"><h2 class="sh">${t("Altri spot in {zona}", {zona: esc(nomeArea(s.area))})}</h2>
    <ul class="altri">${vicini.map(x => `<li><a href="${href(percorsoSpot(x.id))}">${esc(x.name)}</a></li>`).join("")}</ul><p><a href="${href(percorsoArea(s.area))}">${t("Tutti gli spot della zona")}</a></p></section>`;
  return h;
}
function paginaPrevisione(){
  if(!conDati) return "";
  const giorni = dailyPlan(SPOTS[0]).slice(0, 7).map(d => d.date);
  return `<div class="st-wrap"><table class="st"><thead><tr><th class="l">${t("Spot")}</th>${giorni.map(g => `<th>${dayName(g)} ${dayNum(g)}</th>`).join("")}</tr></thead><tbody>
    ${SPOTS.map(s => { const p = Object.fromEntries(dailyPlan(s).map(d => [d.date, d])); return `<tr><td class="l"><a href="${href(percorsoSpot(s.id))}">${esc(nomeCorto(s))}</a></td>${giorni.map(g => `<td>${p[g] && p[g].snow >= 0.5 ? r0(p[g].snow) + " cm" : "–"}</td>`).join("")}</tr>`; }).join("")}
    </tbody></table></div>`;
}
function paginaValanghe(){
  const sv = bollettiniPerServizio(SPOTS);
  if(!sv.length) return `<div class="sec note">${t("Nessun bollettino valanghe attivo in questo momento: i servizi valanghe di solito iniziano a pubblicarli a dicembre.")}</div>`;
  return sv.map(x => `<div class="avsrv"><h2 class="ttl">${esc(x.nome)}</h2>${x.items.map(({b, level, spots}) => `<div class="sec">
    <h3>${t(DNAME[level] || "")} · ${esc((b.regions || []).map(r => r.name).slice(0, 4).join(", "))}</h3>
    ${spots.length ? `<p class="note">${t("Spot")}: ${spots.map(s => `<a href="${href(percorsoSpot(s.id))}">${esc(nomeCorto(s))}</a>`).join(", ")}</p>` : ""}
    ${gradiHTML(b)}${problemiHTML(b)}${testiHTML(b)}${intestazione(b, x.p)}</div>`).join("")}</div>`).join("");
}
function paginaWebcam(){
  return SPOTS.map(s => `<div class="sec"><h2 class="sh"><a href="${href(percorsoSpot(s.id))}">${esc(s.name)}</a></h2>
    <ul>${s.cams.map(c => `<li>${esc(c.t)}${c.src ? ` · © ${esc(c.src)}` : ""}</li>`).join("")}</ul></div>`).join("");
}

/* ---------- dati strutturati (schema.org) ---------- */
const ind = p => SITO + url(p);                                  // indirizzo completo nella lingua attuale
function jsonLd(r, meta){
  const u = ind(r.path), home = ind(""), inLingua = lingua() === "en" ? "en-GB" : "it-IT";
  const grafo = [{"@type": "WebSite", "@id": SITO + "#sito", url: SITO, name: SITO_NOME, inLanguage: ["it-IT", "en-GB"]}];
  const briciole = [{name: "Home", url: home}];
  if(r.vista === "lista" && r.area) briciole.push({name: t("Spot"), url: ind("spot/")}, {name: nomeArea(r.area), url: u});
  else if(r.vista === "lista") briciole.push({name: t("Spot"), url: u});
  else if(r.vista === "spot"){
    const s = SPOTS.find(x => x.id === r.id);
    briciole.push({name: t("Spot"), url: ind("spot/")}, {name: nomeArea(s.area), url: ind(percorsoArea(s.area))}, {name: nomeCorto(s), url: u});
    grafo.push({"@type": "Place", name: s.name, description: meta.description, url: u,
      geo: {"@type": "GeoCoordinates", latitude: s.lat, longitude: s.lon, elevation: s.elev},
      containedInPlace: {"@type": "AdministrativeArea", name: nomeArea(s.area)}});
  }
  else if(r.vista !== "home") briciole.push({name: meta.h1, url: u});
  grafo.push({"@type": "WebPage", "@id": u, url: u, name: meta.title, description: meta.description, isPartOf: {"@id": SITO + "#sito"}, inLanguage: inLingua,
    ...(generato ? {dateModified: generato.toISOString()} : {})});
  if(briciole.length > 1) grafo.push({"@type": "BreadcrumbList", itemListElement: briciole.map((b, i) => ({"@type": "ListItem", position: i + 1, name: b.name, item: b.url}))});
  return `<script type="application/ld+json">${JSON.stringify({"@context": "https://schema.org", "@graph": grafo}).replace(/</g, "\\u003c")}</script>`;
}

/* ---------- testa della pagina ---------- */
const attr = v => esc(v);
/* percorso = indirizzo italiano della pagina (null per la 404) */
function testa(html, meta, percorso, extra = ""){
  const url_ = percorso == null ? null : ind(percorso), en = lingua() === "en";
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${lingua()}"`)
    .replace(/<base href="[^"]*">/, `<base href="${BASE}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(meta.description)}">`)
    .replace(/<link rel="canonical"[^>]*>/, url_ ? `<link rel="canonical" href="${url_}" data-radice="${SITO}">` : "")
    .replace(/<link rel="alternate" hreflang="[^"]*"[^>]*>\n?/g, "")
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attr(meta.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${attr(meta.description)}">`)
    .replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${en ? "en_GB" : "it_IT"}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, url_ ? `<meta property="og:url" content="${url_}">` : "")
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITO}og-image.jpg">`)
    // badge lingua già scritto (niente salto quando parte il JavaScript)
    .replace(/<span class="lang-slot" data-lingua-badge><\/span>/, `<span class="lang-slot" data-lingua-badge>${badgeLingua(percorso || "")}</span>`);
  if(!/og:description/.test(html)) html = html.replace("</head>", `<meta property="og:description" content="${attr(meta.description)}">\n</head>`);
  // versioni nelle due lingue, per Google
  const alt = percorso == null ? "" : `<link rel="alternate" hreflang="it" href="${SITO}${url(percorso, "it")}" data-radice="${SITO}">
<link rel="alternate" hreflang="en" href="${SITO}${url(percorso, "en")}" data-radice="${SITO}">
<link rel="alternate" hreflang="x-default" href="${SITO}${url(percorso, "it")}" data-radice="${SITO}">`;
  return html.replace("<!--DATI-STRUTTURATI-->", "").replace("</head>", `${alt}\n${extra}\n</head>`);
}
const scrivi = (rel, html) => { const f = join(DIST, rel); mkdirSync(dirname(f), {recursive: true}); writeFileSync(f, html); };
/* link interni scritti in italiano nell'HTML → indirizzi nella lingua della pagina */
const linkInLingua = html => lingua() !== "en" ? html : html.replace(/(<a\b[^>]*?\shref=")([^"]*)(")/g, (m, a, h, b) =>
  !h || /^(https?:|mailto:|#|\.\.\/|\/|en\/)/.test(h) || /\.(png|jpg|svg|json|xml|txt|webmanifest)$/.test(h) ? m : a + (url(h === "./" ? "" : h) || "en/") + b);

/* ---------- pagine dell'app ---------- */
const tpl = readFileSync(join(DIST, "index.html"), "utf8");
const VISTA = {home: "v-spot", lista: "v-spot", spot: "v-detail", previsione: "v-pianifica", valanghe: "v-valanghe", webcam: "v-webcam"};
const rotte = tutteLeRotte();
const indirizzi = [];
/* pagine a parte: [nome, percorso italiano, file sorgente italiano, file sorgente inglese, titolo] */
const PAGINE = [["guida", "guida/", "info", "Guida"], ["precipitazioni", "precipitazioni/", "precipitazioni", "Animazione precipitazioni"], ["contatti", "contatti/", "contatti", "Contatti"]];

for(const l of ["it", "en"]){
  impostaLingua(l);
  const quando = quandoIn();
  const base = linkInLingua(traduciHTML(tpl));
  for(const r of rotte){
    const meta = metaPer(r);
    let html = testa(base, meta, r.path, jsonLd(r, meta));
    html = html.replace(/<body[^>]*>/, `<body data-vista="${r.vista}">`)
      .replace(/(<div class="cover" id="cover"[^>]*>)(<\/div>)/, `$1${coverHTML(r, quando)}$2`)
      .replace(`<section class="view" id="${VISTA[r.vista]}">`, `<section class="view on" id="${VISTA[r.vista]}">`);
    if(r.vista === "home" || r.vista === "lista"){
      const lista = r.area ? SPOTS.filter(s => s.area === r.area) : SPOTS;
      if(r.vista === "home" && conDati) html = html.replace('<div class="hero" id="hero"></div>', `<div class="hero" id="hero">${inBreve()}</div>`);
      if(r.vista === "lista") html = html.replace(/(<h2 class="ttl sez" id="spotTitle">)[^<]*(<\/h2>)/, `$1${esc(r.area ? t("Spot") + " · " + nomeArea(r.area) : t("Tutti gli spot"))}$2`);
      html = html.replace('<div class="list" id="list"></div>', `<div class="list" id="list">${lista.map(rigaSpot).join("")}</div>`);
    }
    else if(r.vista === "spot") html = html.replace(`<section class="view on" id="v-detail"></section>`, `<section class="view on" id="v-detail">${paginaSpot(SPOTS.find(s => s.id === r.id))}</section>`);
    else if(r.vista === "previsione") html = html.replace('<div id="planTable"></div>', `<div id="planTable">${paginaPrevisione()}</div>`);
    else if(r.vista === "valanghe") html = html.replace('<div id="avBulletins"></div>', `<div id="avBulletins">${paginaValanghe()}</div>`);
    else if(r.vista === "webcam") html = html.replace('<div class="list" id="camList"></div>', `<div class="list" id="camList">${paginaWebcam()}</div>`);
    scrivi(join(url(r.path), "index.html"), html);
    indirizzi.push(url(r.path));
  }

  /* guida, animazione precipitazioni, contatti: in inglese c'è un file a parte (html/en/…), già tradotto */
  for(const [nome, percorso, file, h1] of PAGINE){
    const sorg = join(DIST, "html", ...(l === "en" ? ["en"] : []), file + ".html");
    if(!existsSync(sorg)) continue;
    const g = readFileSync(sorg, "utf8").replace(/(["'(])(?:\.\.\/)+(assets|js|css)\//g, "$1$2/");
    const meta = {title: ((g.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || h1).replace(/&amp;/g, "&"), description: (g.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ""};
    let ld = jsonLd({vista: nome, path: percorso}, {...meta, h1: t(h1)});
    if(nome === "contatti") ld += `<script type="application/ld+json">${JSON.stringify({"@context": "https://schema.org", "@type": "Person", name: "Francesco Fabbro", jobTitle: t("Ingegnere informatico"), url: "https://paquithino.github.io", sameAs: ["https://github.com/Paquithino"]})}</script>`;
    const html = testa(g, meta, percorso, ld);
    scrivi(url(percorso) + "index.html", html);
    // i vecchi indirizzi html/… restano, ma indicano la pagina vera come principale
    scrivi(join("html", ...(l === "en" ? ["en"] : []), file + ".html"), html);
    indirizzi.push(url(percorso));
  }
}
impostaLingua("it");

/* ---------- 404, sitemap, robots ---------- */
scrivi("404.html", testa(tpl, metaPer({vista: "home"}), null, `<meta name="robots" content="noindex">`).replace(/<body[^>]*>/, `<body data-vista="home">`));
const oggi = (generato || new Date()).toISOString().slice(0, 10);
const logico = p => p.replace(/^en\//, "");
scrivi("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${indirizzi.map(p => {
  const q = logico(p), guida = /^(guida|guide)\/$/.test(q), spot = q.startsWith("spot/") && q.split("/").length > 2;
  const it = indirizzi.find(x => !x.startsWith("en/") && url(x, "en") === (p.startsWith("en/") ? p : url(p, "en"))) ?? p;
  return `  <url><loc>${SITO}${p}</loc><lastmod>${oggi}</lastmod><changefreq>${guida ? "monthly" : "hourly"}</changefreq><priority>${q === "" ? "1.0" : spot ? "0.8" : "0.6"}</priority>`
    + `<xhtml:link rel="alternate" hreflang="it" href="${SITO}${it}"/><xhtml:link rel="alternate" hreflang="en" href="${SITO}${url(it, "en")}"/></url>`;
}).join("\n")}\n</urlset>\n`);
scrivi("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITO}sitemap.xml\n`);

log(`pagine create: ${rotte.length} + guida, 404, sitemap.xml (${indirizzi.length} indirizzi), robots.txt · italiano e inglese (${rotte.length} + 3 per lingua) · sito ${SITO}${conDati ? "" : " · senza dati (solo testi fissi)"}`);
