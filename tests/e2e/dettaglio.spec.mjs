import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";
import { SPOTS } from "../../js/config.js";

test.describe("Pagina spot · versione completa", () => {
  test("tutte le sezioni presenti", async ({page, errori}) => {
    await apri(page, "#spot-marmolada", {modo: "completa"});
    for(const [sel, testo] of [[".o-now", "Adesso"], [".o-snow", "Neve fresca"], [".o-quote", "Neve per quota"], [".o-meas", "Neve misurata"],
      [".o-plan", "Previsione"], [".o-models", "Confronto modelli"], [".o-hour", "Ora per ora"], [".o-cam", "Webcam"], [".o-av", "Pericolo valanghe"]]){
      await expect(page.locator(sel).first(), sel).toContainText(testo);
    }
    await expect(page.locator(".o-hour svg.oo-svg")).toBeVisible();
    await senzaScrollLaterale(page);
  });

  test("5 sezioni numerate con le 10 tabelle nell'ordine giusto", async ({page, errori}) => {
    await apri(page, "#spot-marmolada", {modo: "completa"});
    await expect(page.locator("#v-detail h2.gh")).toHaveText(["1Dati raccolti", "2Previsioni", "3Valanghe", "43D", "5Webcam"]);
    const ordine = await page.locator("#v-detail .grp").evaluateAll(gs => gs.map(g => [g.id, [...g.querySelectorAll(".grp-b > .sec")].map(t => t.id)]));
    expect(ordine).toEqual([
      ["s-dati", ["o-now", "o-snow", "o-meas"]],
      ["s-prev", ["o-plan", "o-quote", "o-models", "o-hour"]],
      ["s-av", ["o-av"]], ["s-3d", ["o-3d"]], ["s-cam", ["o-cam"]]
    ]);
    // titoli: h2 per le sezioni, h3 per le tabelle
    expect(await page.locator("#v-detail .grp-b > .sec > h3.sh").count()).toBe(10);
  });

  test("versione semplice: stesse sezioni, stesso ordine", async ({page, errori}) => {
    await apri(page, "#spot-marmolada", {modo: "semplice"});
    await expect(page.locator("#v-detail h2.gh")).toHaveText(["1Dati raccolti", "2Previsioni", "3Valanghe", "43D", "5Webcam"]);
    await senzaScrollLaterale(page);
  });

  test("neve per quota: vetta, metà e base con le quote dello spot", async ({page, errori}) => {
    const s = SPOTS.find(x => x.id === "marmolada");
    await apri(page, "#spot-marmolada", {modo: "completa"});
    const t = page.locator(".o-quote table.qt");
    await expect(t).toBeVisible();
    for(const q of [s.q.top, s.q.base]) await expect(t).toContainText(q.toLocaleString("it-IT"));
    await expect(t).toContainText("Quota neve");
  });

  test("confronto modelli: tutti e 5 i modelli e la Previsione FreeRide", async ({page, errori}) => {
    await apri(page, "#spot-cortina", {modo: "completa"});
    const m = page.locator(".o-models");
    for(const n of ["ICON", "ECMWF", "GFS", "Météo-France"]) await expect(m).toContainText(n);
    await expect(m).toContainText(/FreeRide/);
  });

  test("previsione dei giorni: scorre solo la striscia, non la pagina", async ({page, errori}) => {
    await apri(page, "#spot-cortina", {modo: "completa"});
    await expect(page.locator(".o-plan .day").first()).toBeVisible();
    await senzaScrollLaterale(page);
  });

  test("ogni spot si apre senza errori", async ({page, errori}) => {
    test.slow();
    await apri(page, "#spot", {modo: "completa"});
    for(const s of SPOTS){
      await page.evaluate(id => { location.hash = "#spot-" + id; }, s.id);
      await expect(page.locator("#cover h1")).toHaveText(s.name);
    }
  });

  test("spot inesistente: torna alla lista", async ({page, errori}) => {
    await apri(page, "#spot-non-esiste", {modo: "completa"});
    await expect(page).toHaveURL(/:\d+\/$/);
  });

  test("calibrazione per zona: fattori e nota della zona dello spot", async ({page, errori}) => {
    const cal = {stagioni: ["2024-25"], stazioni: 28,
      models: {icon: {ok: true, factor: 1.06, weight: 0.91}, gfs: {ok: true, factor: 1.12, weight: 0.94}},
      zone: {bz: {nome: "Alto Adige", stazioni: 16, models: {icon: {ok: true, factor: 1.05, weight: 0.94}}, verifica: {nevicate: 147, presePrima: 131, preseDopo: 133}},
             ve: {nome: "Veneto", stazioni: 12, models: {icon: {ok: true, factor: 1.07, weight: 0.88}}, verifica: {nevicate: 469, presePrima: 428, preseDopo: 434}}},
      spotZona: {"alta-badia": "bz", cortina: "ve"}};
    await apri(page, "#spot-alta-badia", {modo: "completa", snapshot: s => { s.cal = cal; }});
    const m = page.locator(".o-models");
    await expect(m).toContainText("zona Alto Adige");
    await expect(m).toContainText("×1,05");
    await expect(m).toContainText("da 131 a 133 su 147");
    await page.evaluate(() => { location.hash = "#spot-cortina"; });
    await expect(page.locator(".o-models")).toContainText("zona Veneto");
    await expect(page.locator(".o-models")).toContainText("×1,07");
    await page.evaluate(() => { location.hash = "#spot-brenta"; });
    await expect(page.locator(".o-models")).toContainText("stazioni di Alto Adige e Veneto");
    await expect(page.locator(".o-models")).toContainText("×1,06");
  });

  test("snow-forecast rimosso: nessuna sezione né link", async ({page, errori}) => {
    await apri(page, "#spot-cortina", {modo: "completa"});
    await expect(page.locator(".o-sf")).toHaveCount(0);
    await expect(page.locator('a[href*="snow-forecast"]')).toHaveCount(0);
    await expect(page.locator("footer")).not.toContainText("snow-forecast");
  });
});
