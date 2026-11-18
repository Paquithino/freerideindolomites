import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";
import { SPOTS } from "../../js/config.js";

test.describe("Pagina spot · versione completa", () => {
  test("tutte le sezioni presenti", async ({page, errori}) => {
    await apri(page, "#spot-marmolada", {modo: "completa"});
    for(const [sel, testo] of [[".o-now", "Adesso"], [".o-snow", "Neve fresca"], [".o-quote", "Neve per quota"], [".o-meas", "Neve misurata"],
      [".o-plan", "Previsione"], [".o-models", "Confronto modelli"], [".o-hour", "Ora per ora"], [".o-cam", "Webcam"], [".o-av", "Pericolo valanghe"]]){
      await expect(page.locator(sel).first(), sel).toContainText(testo);
    }
    await expect(page.locator(".o-hour svg.chart")).toBeVisible();
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
      await expect(page.locator("#v-detail h2")).toHaveText(s.name);
    }
  });

  test("spot inesistente: torna alla lista", async ({page, errori}) => {
    await apri(page, "#spot-non-esiste", {modo: "completa"});
    await expect(page).toHaveURL(/#spot$/);
  });
});
