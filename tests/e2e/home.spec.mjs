import { test, expect, apri, senzaScrollLaterale, isDesktop } from "./aiuto.mjs";
import { SPOTS } from "../../js/config.js";

test.describe("Home · spot", () => {
  test("si apre con tutti gli spot, senza errori e senza scorrimento laterale", async ({page, errori}, ti) => {
    await apri(page, "#spot", {modo: "completa", ls: {fr_view: "schede"}});
    await expect(page.locator("#list .card")).toHaveCount(SPOTS.length);
    await expect(page.locator("#hero .k")).toHaveCount(3);
    await expect(page.locator("#updated")).toContainText("Aggiornato alle");
    await senzaScrollLaterale(page);
  });

  test("prima visita: chiede come vedere il sito", async ({page, errori}) => {
    await apri(page);
    await expect(page.getByText("Come preferisci vedere il sito?")).toBeVisible();
    await page.getByRole("button", {name: /Completa/}).click();
    await expect(page.getByText("Come preferisci vedere il sito?")).toHaveCount(0);
  });

  test("filtro per zona", async ({page, errori}) => {
    await apri(page, "#spot", {modo: "completa", ls: {fr_view: "schede"}});
    for(const zona of ["Alto Adige", "Veneto", "Friuli VG", "Trentino"]){
      await page.locator("#areaChips").getByRole("button", {name: zona, exact: true}).click();
      await expect(page.locator("#list .card")).toHaveCount(SPOTS.filter(s => s.area === zona).length);
    }
  });

  test("preferiti: la stella resta dopo aver ricaricato e lo spot va in cima", async ({page, errori}) => {
    await apri(page, "#spot", {modo: "completa", ls: {fr_view: "schede"}});
    const ultimo = page.locator("#list .card").last();
    const nome = await ultimo.locator("h3").textContent();
    await ultimo.locator("[data-fav]").click();
    await page.reload();
    await expect(page.locator("#list .card").first().locator("h3")).toHaveText(nome);
    await expect(page.locator("#list .card").first().locator("[data-fav]")).toHaveText("★");
    await page.locator("#areaChips").getByRole("button", {name: "★ Preferiti"}).click();
    await expect(page.locator("#list .card")).toHaveCount(1);
  });

  test("ordinamento: per nome è alfabetico", async ({page, errori}) => {
    await apri(page, "#spot", {modo: "completa", ls: {fr_view: "schede"}});
    await page.locator("#sort").selectOption("name");
    const nomi = await page.locator("#list .card h3").allTextContents();
    expect(nomi).toEqual([...nomi].sort((a, b) => a.localeCompare(b, "it")));
  });

  test("desktop: vista tabella con colonne ordinabili", async ({page, errori}, ti) => {
    test.skip(!isDesktop(ti), "solo desktop");
    await apri(page, "#spot", {modo: "completa"});
    await page.locator("[data-view=tabella]").click();
    await expect(page.locator("table.tbl tbody tr")).toHaveCount(SPOTS.length);
    await page.locator("th[data-sortcol=name]").click();
    await expect(page.locator("th[data-sortcol=name]")).toContainText("▼");
    await page.locator("[data-view=schede]").click();
    await expect(page.locator("#list .card")).toHaveCount(SPOTS.length);
  });

  test("tocco su uno spot apre la sua pagina e Indietro torna alla lista", async ({page, errori}) => {
    await apri(page, "#spot", {modo: "completa", ls: {fr_view: "schede"}});
    await page.locator('#list [data-spot="cortina"] h3').click();
    await expect(page).toHaveURL(/#spot-cortina$/);
    await expect(page.locator("#v-detail h2")).toHaveText("Cortina d'Ampezzo");
    await page.locator("[data-back]").click();
    await expect(page.locator("#list .card").first()).toBeVisible();
  });
});
