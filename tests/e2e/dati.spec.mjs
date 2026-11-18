import { test, expect, apri } from "./aiuto.mjs";
import { SPOTS, MODELS } from "../../js/config.js";

/* Lettura dei dati: file del robot, file vecchio/assente/rovinato, richieste dirette alle fonti */
test.describe("Lettura dati", () => {
  test("file del robot recente: usato così com'è, niente richieste a Open-Meteo", async ({page, errori}) => {
    const openMeteo = [];
    await apri(page, "#spot", {modo: "completa", ls: {fr_view: "schede"}, snapshot: s => { s.demo = false; },
      esterni: (route, url) => { if(url.includes("open-meteo")) openMeteo.push(url); }});
    await expect(page.locator(".banner.demo")).toHaveCount(0);
    await expect(page.locator("#list .card")).toHaveCount(SPOTS.length);
    expect(openMeteo).toEqual([]);
  });

  for(const [caso, snapshot] of [
    ["vecchio di 5 ore", s => { s.generated = new Date(Date.now() - 5 * 3600e3).toISOString(); }],
    ["assente", null],
    ["rovinato", "{\"wx\": [tronc"]
  ]){
    test(`file ${caso}: il sito prova le fonti dirette e non resta mai vuoto`, async ({page, errori}) => {
      test.setTimeout(90_000);
      const richieste = [], t0 = Date.now();
      await apri(page, "#spot", {modo: "completa", ls: {fr_view: "schede"}, snapshot, attesa: 60_000, esterni: (route, url) => { richieste.push(url); }});
      expect(richieste.some(u => u.includes("api.open-meteo.com")), "deve chiedere il meteo a Open-Meteo").toBe(true);
      // fonti bloccate nel test → dati dimostrativi con avviso chiaro
      await expect(page.locator(".banner.demo")).toBeVisible();
      await expect(page.locator("#list .card")).toHaveCount(SPOTS.length);
      test.info().annotations.push({type: "attesa", description: `${((Date.now() - t0) / 1000).toFixed(1)} s prima di mostrare i dati di riserva`});
    });
  }

  test("richieste dirette: meteo per tutti gli spot, modelli, neve per quota alle 3 quote", async ({page, errori}) => {
    test.setTimeout(90_000);
    const urls = [];
    await apri(page, "#spot", {modo: "completa", snapshot: null, attesa: 60_000, esterni: (route, url) => { urls.push(url); }});
    const meteo = urls.map(u => new URL(u)).filter(u => u.hostname === "api.open-meteo.com");
    const punti = meteo.map(u => (u.searchParams.get("latitude") || "").split(",").length);
    expect(punti).toContain(SPOTS.length);
    expect(punti, "neve per quota: 3 quote per spot").toContain(SPOTS.length * 3);
    const quote = meteo.find(u => (u.searchParams.get("latitude") || "").split(",").length === SPOTS.length * 3);
    expect(quote.searchParams.get("elevation").split(",").map(Number)).toContain(SPOTS.find(s => s.id === "cortina").q.top);
    const modelli = meteo.map(u => u.searchParams.get("models")).filter(Boolean).join(",");
    for(const m of MODELS) expect(modelli, m.id).toContain(m.names[0]);
    expect(urls.some(u => u.includes("avalanche.report")), "bollettini valanghe").toBe(true);
  });

  test("file senza neve per quota: la chiede dal browser; se non arriva lo dice, senza errori", async ({page, errori}) => {
    const quote = [];
    await apri(page, "#spot-cortina", {modo: "completa", snapshot: s => { s.demo = false; delete s.quote; },
      esterni: (route, url) => { if(url.includes("open-meteo") && url.includes("elevation")) quote.push(url); }});
    await expect.poll(() => quote.length).toBeGreaterThan(0);
    await expect(page.locator(".o-quote")).toContainText(/non disponibile/i);
  });

  test("pulsante aggiorna: rilegge i dati", async ({page, errori}) => {
    let n = 0;
    await apri(page, "#spot", {modo: "completa", contaDati: () => n++});
    const prima = n;
    await page.locator("#refresh").click();
    await expect.poll(() => n).toBeGreaterThan(prima);
    await expect(page.locator("#refresh")).not.toHaveClass(/spin/);
  });

  test("il pericolo valanghe non viene mai inventato: senza bollettini nessun grado", async ({page, errori}) => {
    await apri(page, "#spot", {modo: "semplice", snapshot: s => { s.av = {}; }});
    await expect(page.locator("#list .sg-n .dsq")).toHaveCount(0);
  });
});

test.describe("Info e guida", () => {
  test("pagina info: si apre, sezioni principali e torna al sito", async ({page, errori}) => {
    await page.goto("/html/info.html");
    await expect(page).toHaveTitle(/Info e guida/);
    for(const t of ["Pericolo valanghe", "Versione semplice", "Calibrazione"]) await expect(page.locator("body")).toContainText(t);
  });
});
