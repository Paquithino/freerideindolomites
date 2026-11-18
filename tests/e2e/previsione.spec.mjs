import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";
import { SPOTS, FORECAST_DAYS } from "../../js/config.js";

test.describe("Previsione", () => {
  test("per giorno: una scheda per giorno, oggi per primo, senza scorrimento laterale", async ({page, errori}) => {
    await apri(page, "#previsione", {modo: "completa", ls: {fr_pvmode: "giorno"}});
    const giorni = page.locator(".pv-days > .pv-day");
    expect(await giorni.count()).toBeGreaterThanOrEqual(FORECAST_DAYS - 1);
    await expect(giorni.first()).toContainText("Oggi");
    await senzaScrollLaterale(page);
  });

  test("per spot: una riga per spot, celle che stanno nello schermo", async ({page, errori}) => {
    await apri(page, "#previsione", {modo: "completa", ls: {fr_pvmode: "giorno"}});
    await page.locator("[data-pvmode=spot]").click();
    await expect(page.locator(".pv-grid .pv-row[data-spot]")).toHaveCount(SPOTS.length);
    await senzaScrollLaterale(page);
    const larghezze = await page.locator(".pv-grid .pv-row[data-spot]").first().locator(".cells > span").evaluateAll(e => e.map(x => x.getBoundingClientRect().right));
    expect(Math.max(...larghezze)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  });

  test("la vista scelta resta salvata", async ({page, errori}) => {
    await apri(page, "#previsione", {modo: "completa", ls: {fr_pvmode: "giorno"}});
    await page.locator("[data-pvmode=spot]").click();
    await page.reload();
    await expect(page.locator("[data-pvmode=spot]")).toHaveClass(/on/);
  });

  test("filtro zona e tocco su uno spot", async ({page, errori}) => {
    await apri(page, "#previsione", {modo: "completa", ls: {fr_pvmode: "spot"}});
    await page.locator("#planChips").getByRole("button", {name: "Friuli VG", exact: true}).click();
    await expect(page.locator(".pv-grid .pv-row[data-spot]")).toHaveCount(SPOTS.filter(s => s.area === "Friuli VG").length);
    await page.locator(".pv-grid .pv-row[data-spot]").first().click();
    await expect(page).toHaveURL(/#spot-/);
  });

  test("il vecchio indirizzo #pianifica funziona ancora", async ({page, errori}) => {
    await apri(page, "#pianifica", {modo: "completa"});
    await expect(page.locator("#v-pianifica")).toBeVisible();
  });
});
