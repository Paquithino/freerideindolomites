import { test, expect, apri, senzaScrollLaterale, isDesktop } from "./aiuto.mjs";
import { SPOTS } from "../../js/config.js";

/* Pagine vere: ogni sezione e ogni spot ha il suo indirizzo, titolo e link canonico */
test.describe("Pagine e navigazione", () => {
  test("indirizzo di una zona: titolo, h1, solo gli spot della zona", async ({page, errori}) => {
    await apri(page, "", {modo: "completa", ls: {fr_view: "schede"}, url: "/spot/veneto/"});
    await expect(page).toHaveTitle(/Spot freeride in Veneto/);
    await expect(page.locator("#cover h1")).toHaveText("Spot freeride · Veneto");
    await expect(page.locator("#list .card")).toHaveCount(SPOTS.filter(s => s.area === "Veneto").length);
    await expect(page.locator('#areaChips .chip.on')).toHaveText("Veneto");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/spot\/veneto\/$/);
  });

  test("filtro zona = indirizzo della zona; Tutti = tutti gli spot", async ({page, errori}) => {
    await apri(page, "#spot", {modo: "completa", ls: {fr_view: "schede"}});
    await page.locator("#areaChips").getByRole("button", {name: "Trentino", exact: true}).click();
    await expect(page).toHaveURL(/\/spot\/trentino\/$/);
    await page.locator("#areaChips").getByRole("button", {name: "Tutti", exact: true}).click();
    await expect(page).toHaveURL(/\/spot\/$/);
    await expect(page.locator("#list .card")).toHaveCount(SPOTS.length);
  });

  test("ogni pagina cambia titolo e link canonico; avanti e indietro del browser funzionano", async ({page, errori}) => {
    await apri(page, "#spot", {modo: "completa"});
    await expect(page).toHaveTitle(/FreeRide in Dolomites: neve, meteo e valanghe/);
    for(const [sez, titolo] of [["valanghe/", /Bollettino valanghe/], ["previsione/", /Previsione neve/], ["webcam/", /Webcam in quota/]]){
      await page.evaluate(p => document.querySelector(`.pills a[href="${p}"], .hnav a[href="${p}"]`)?.click(), sez);
      await expect(page).toHaveURL(new RegExp(sez.replace("/", "\\/") + "$"));
      await expect(page).toHaveTitle(titolo);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(sez.replace("/", "\\/") + "$"));
    }
    await page.goBack(); await expect(page).toHaveURL(/\/previsione\/$/);
    await page.goBack(); await expect(page).toHaveURL(/\/valanghe\/$/);
    await expect(page.locator("#v-valanghe")).toBeVisible();
    await page.goForward(); await expect(page.locator("#v-pianifica")).toBeVisible();
  });

  test("le schede degli spot sono link veri (Google li segue)", async ({page, errori}) => {
    await apri(page, "#spot", {modo: "semplice"});
    const prima = page.locator("#list a.card").first();
    await expect(prima).toHaveAttribute("href", /^spot\/[a-z-]+\/$/);
    await prima.click();
    await expect(page).toHaveURL(/\/spot\/[a-z-]+\/$/);
  });

  test("vecchi link con # portano alla pagina nuova", async ({page, errori}) => {
    await apri(page, "#spot-arabba", {modo: "completa"});
    await expect(page).toHaveURL(/\/spot\/arabba\/$/);
    await expect(page.locator("#cover h1")).toHaveText(SPOTS.find(s => s.id === "arabba").name);
  });

  test("pagina spot: indietro porta alla zona, il preferito si salva dalla copertina", async ({page, errori}) => {
    await apri(page, "", {modo: "completa", url: "/spot/plose/"});
    await page.locator("#cover [data-fav]").click();
    await expect(page.locator("#cover [data-fav]")).toHaveText("★");
    await page.locator("#cover .cv-back").click();
    await expect(page).toHaveURL(/\/spot\/alto-adige\/$/);
  });

  test("pagina spot: le pillole portano alle sezioni della pagina", async ({page, errori}) => {
    await apri(page, "", {modo: "completa", url: "/spot/cortina/"});
    await page.locator('#cover [data-goto="o-av"]').click();
    await expect(page.locator("#o-av")).toBeInViewport();
    await expect(page.locator('#cover [data-goto="o-av"]')).toHaveClass(/on/);
    await expect(page).toHaveURL(/\/spot\/cortina\/$/);
  });

  test("menu: si apre, porta alle pagine e alle zone, si chiude con Esc", async ({page, errori}, ti) => {
    test.skip(isDesktop(ti), "sul desktop il menu è in alto");
    await apri(page, "#spot", {modo: "completa"});
    await page.locator("#menuBtn").click();
    await expect(page.locator("#menu")).toBeVisible();
    await expect(page.locator("#menuBtn")).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator("#menu")).toBeHidden();
    await page.locator("#menuBtn").click();
    await page.locator("#menuZone a", {hasText: "Friuli"}).click();
    await expect(page).toHaveURL(/\/spot\/friuli\/$/);
    await expect(page.locator("#menu")).toBeHidden();
    await senzaScrollLaterale(page);
  });

  test("desktop: menu in alto con la sezione attiva, niente pulsante menu", async ({page, errori}, ti) => {
    test.skip(!isDesktop(ti), "solo desktop");
    await apri(page, "", {modo: "completa", url: "/valanghe/"});
    await expect(page.locator('.hnav a[data-tab="valanghe"]')).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#menuBtn")).toBeHidden();
    await expect(page.locator("#hmodo .seg2")).toBeVisible();
  });

  test("guida: pagina a parte con lo stesso menu", async ({page, errori}) => {
    await page.goto("/guida/");
    await expect(page).toHaveTitle(/Guida/);
    await expect(page.locator("h1")).toHaveText("Guida");
    await expect(page.locator('a[href="valanghe/"]').first()).toBeAttached();
  });

  test("link 'vai al contenuto' non cambia pagina", async ({page, errori}) => {
    await apri(page, "", {modo: "completa", url: "/valanghe/"});
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/valanghe\/$/);
  });
});
