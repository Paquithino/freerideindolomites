import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";
import { SPOTS } from "../../js/config.js";
import { VENETO } from "../fixtures/bollettini.mjs";

test.describe("Versione semplice", () => {
  test("home: in breve, un giudizio e tre numeri per spot, niente dati tecnici", async ({page, errori}) => {
    await apri(page, "#spot", {modo: "semplice"});
    await expect(page.locator("body")).toHaveClass(/semplice/);
    await expect(page.locator("#hero")).toContainText("In breve");
    await expect(page.locator(".sg-hero")).toBeVisible();
    await expect(page.locator("#list .card.sg")).toHaveCount(SPOTS.length);
    const prima = page.locator("#list .card.sg").first();
    await expect(prima.locator(".sg-g")).toHaveText(/Neve fresca abbondante|Bella nevicata|Un po'|Niente neve nuova|Pericolo valanghe forte/);
    await expect(prima.locator(".sg-n > div")).toHaveCount(3);
    await expect(page.locator("#sort")).toBeHidden();
    await expect(page.locator("table.tbl")).toHaveCount(0);
    await expect(page.locator("text=Indice Powder >> visible=true")).toHaveCount(0);
    await senzaScrollLaterale(page);
  });

  test("la scelta resta salvata e si torna alla completa", async ({page, errori}) => {
    await apri(page, "#spot");
    await page.getByRole("button", {name: /Semplice/}).click();
    await page.reload();
    await expect(page.locator("body")).toHaveClass(/semplice/);
    // dopo la prima scelta l'interruttore sta in alto (desktop) o nel menu (telefono)
    if(!(await page.locator("#hmodo").isVisible())) await page.locator("#menuBtn").click();
    await page.getByRole("button", {name: "Completa", exact: true}).click();
    await expect(page.locator("body")).not.toHaveClass(/semplice/);
    await expect(page.locator("#sort")).toBeVisible();
  });

  test("pagina spot: giudizio, 5 giorni senza scorrere, valanghe, webcam e link ai dati completi", async ({page, errori}) => {
    await apri(page, "#spot-cortina", {modo: "semplice", snapshot: s => { s.av = {"IT-34": VENETO}; }});
    await expect(page.locator(".o-now .sg-big")).toBeVisible();
    await expect(page.locator(".sg-days .sg-d")).toHaveCount(5);
    await expect(page.locator(".sg-days .sg-d").first()).toContainText("Oggi");
    await expect(page.locator(".o-av")).toContainText("Marcato");
    await expect(page.locator(".o-now")).toContainText("Pericolo valanghe marcato");
    for(const assente of [".o-models", ".o-quote", ".o-meas", ".o-hour"]) await expect(page.locator(assente)).toHaveCount(0);
    await senzaScrollLaterale(page);
    await page.getByRole("button", {name: /Vedi tutti i dati/}).click();
    await expect(page.locator(".o-models")).toBeVisible();
  });

  test("pericolo forte: il giudizio dice di restare in pista", async ({page, errori}) => {
    const forte = structuredClone(VENETO);
    forte[0].dangerRatings = [{mainValue: "high"}];
    await apri(page, "#spot", {modo: "semplice", snapshot: s => { s.av = {"IT-34": forte}; }});
    await expect(page.locator('#list [data-spot="cortina"] .sg-g')).toContainText("Pericolo valanghe forte");
    await expect(page.locator('#list [data-spot="cortina"]')).toHaveClass(/gv-bad/);
  });
});
