/* Strumenti comuni ai test nel browser */
import { test as base, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const SNAP = () => JSON.parse(readFileSync(resolve(ROOT, "tests/.tmp/ultimo.json"), "utf8"));
const IMG = readFileSync(resolve(ROOT, "public/icon-192.png"));

/* errori della pagina che NON sono bug: le fonti esterne bloccate di proposito nei test */
const ATTESO = /Failed to load resource|net::ERR_FAILED|ERR_BLOCKED|status of 404/;

export const test = base.extend({
  errori: async ({page}, use) => {
    const e = [];
    page.on("pageerror", x => e.push("JS: " + x.message));
    page.on("console", m => { if(m.type() === "error" && !ATTESO.test(m.text())) e.push("console: " + m.text()); });
    await use(e);
    expect(e, "errori JavaScript nella pagina").toEqual([]);
  }
});
export { expect };

/* Apre il sito con dati controllati.
   opz.snapshot(s)   → modifica il file dati prima di servirlo (o null = file assente)
   opz.modo          → "semplice" | "completa" | undefined (prima visita)
   opz.ls            → altre chiavi di localStorage
   opz.url           → indirizzo da aprire (es. /spot/veneto/) al posto di index.html#…
   opz.immaginiRotte → url di webcam che rispondono 404
   opz.attesa        → ms massimi di caricamento (le fonti dirette ritentano per qualche secondo prima di arrendersi)
   opz.esterni       → funzione (route, url) per rispondere a richieste esterne specifiche
   opz.storico       → funzione (percorso dentro dati/storico/) → file dello storico finto (vedi fixtures/storico-finto.mjs)
   opz.contaStorico  → chiamata a ogni richiesta dello storico (per verificare che si scarichi solo quando serve) */
export async function apri(page, hash = "#spot", opz = {}){
  const ls = {...(opz.ls || {})};
  if(opz.modo) ls.fr_modo = opz.modo;
  await page.addInitScript(v => { if(!sessionStorage.getItem("__init")){ for(const [k, x] of Object.entries(v)) localStorage.setItem(k, JSON.stringify(x)); sessionStorage.setItem("__init", "1"); } }, ls);
  let snap = SNAP();
  if(opz.snapshot !== undefined) snap = typeof opz.snapshot === "function" ? (opz.snapshot(snap) || snap) : opz.snapshot;
  await page.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    if(url.hostname === "localhost"){
      if(url.pathname.endsWith("/dati/ultimo.json")){
        opz.contaDati && opz.contaDati();
        if(typeof snap === "string") return route.fulfill({body: snap, contentType: "application/json"});   // file rovinato
        return snap ? route.fulfill({json: snap}) : route.fulfill({status: 404, body: ""});
      }
      if(url.pathname.endsWith("/dati/calibrazione.json")) return route.fulfill({status: 404, body: ""});
      // storico 14 giorni: opz.storico(percorso) → json (o null = file non ancora pubblicato)
      if(url.pathname.includes("/dati/storico/")){
        opz.contaStorico && opz.contaStorico(url.pathname);
        const j = opz.storico ? opz.storico(url.pathname.slice(url.pathname.indexOf("/dati/storico/") + 14)) : null;
        return j ? route.fulfill({json: j}) : route.fulfill({status: 404, body: ""});
      }
      return route.continue();
    }
    if(opz.esterni){ const r = await opz.esterni(route, req.url()); if(r !== undefined) return; }
    // webcam: immagine finta (o 404 se richiesto), tutto il resto di esterno è bloccato
    if(req.resourceType() === "image"){
      const pulito = req.url().replace(/[?&]_=\d+$/, "");
      if((opz.immaginiRotte || []).includes(pulito)) return route.fulfill({status: 404, body: ""});
      return route.fulfill({body: IMG, contentType: "image/png"});
    }
    if(req.resourceType() === "document" && req.frame() !== page.mainFrame()) return route.fulfill({body: "<html><body>panorama finto</body></html>", contentType: "text/html"});
    return route.abort("blockedbyclient");
  });
  await page.goto(opz.url || "/index.html" + hash);
  await expect(page.locator("#refresh")).not.toHaveClass(/spin/, {timeout: opz.attesa || 15_000});
}

/* la pagina non deve mai scorrere di lato */
export async function senzaScrollLaterale(page){
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw, `la pagina è larga ${sw}px su uno schermo di ${cw}px`).toBeLessThanOrEqual(cw + 1);
}
export const isDesktop = (testInfo) => testInfo.project.name === "desktop";
