import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";
import { VENETO, MALEVOLO } from "../fixtures/bollettini.mjs";

const conBollettini = s => { s.av = {"IT-34": VENETO}; s.avDate = {"IT-34": new Date().toISOString().slice(0, 10)}; s.avErr = false; };

test.describe("Valanghe", () => {
  test("bollettini raggruppati per servizio, grado più alto per primo", async ({page, errori}) => {
    await apri(page, "#valanghe", {modo: "completa", snapshot: conBollettini});
    await expect(page.locator(".avsrv h3").first()).toContainText("Veneto");
    const schede = page.locator("details.avb");
    await expect(schede).toHaveCount(2);
    await expect(schede.first().locator(".avb-h b")).toHaveText("Marcato");
    await expect(schede.first().locator(".avb-sp")).toContainText("Cortina");
    await expect(schede.first()).toContainText("e un'altra zona");
    await senzaScrollLaterale(page);
  });

  test("tocco: si apre il bollettino completo con tutti i testi", async ({page, errori}) => {
    await apri(page, "#valanghe", {modo: "completa", snapshot: conBollettini});
    const b = page.locator("details.avb").first();
    await expect(b.locator(".avb-body")).toBeHidden();
    await b.locator("summary").click();
    for(const t of ["Situazione valanghe", "Primo paragrafo di prova.", "Secondo paragrafo di prova.", "Manto nevoso", "Consigli per chi va in montagna",
                    "TEST lento consolidamento", "Neve ventata", "Strati deboli persistenti", "valanghe medie", "ARPAV – Centro Valanghe di Arabba"]){
      await expect(b.locator(".avb-body")).toContainText(t);
    }
    await expect(b.locator(".avt p")).not.toHaveCount(0);
    await expect(b.locator(".prob svg")).toHaveCount(2);
    await senzaScrollLaterale(page);
  });

  test("pagina spot: 'Leggi il bollettino completo' si apre sul posto", async ({page, errori}) => {
    await apri(page, "#spot-cortina", {modo: "completa", snapshot: conBollettini});
    const av = page.locator(".o-av");
    await expect(av).toContainText("Marcato");
    await av.getByText("Leggi il bollettino completo").click();
    await expect(av.locator("details.avfull")).toHaveAttribute("open", "");
    await expect(av).toContainText("TEST manto nevoso");
    await expect(page).toHaveURL(/#spot-cortina$/);
  });

  test("fuori stagione: messaggio chiaro, nessun errore", async ({page, errori}) => {
    await apri(page, "#valanghe", {modo: "completa", snapshot: s => { s.av = {}; s.avErr = false; }});
    await expect(page.locator("#avBulletins")).toContainText("Nessun bollettino attivo");
    await expect(page.locator("#avList")).toContainText("comparirà");
  });

  test("bollettini non raggiungibili: rimanda ai link ufficiali", async ({page, errori}) => {
    await apri(page, "#valanghe", {modo: "completa", snapshot: s => { s.av = {}; s.avErr = true; }});
    await expect(page.locator("#avBulletins")).toContainText("Non riesco a raggiungere");
    await expect(page.locator("#avLinks a").first()).toHaveAttribute("href", /aineva/);
  });

  test("sicurezza: HTML nascosto nel testo del bollettino non viene eseguito", async ({page, errori}) => {
    await apri(page, "#valanghe", {modo: "completa", snapshot: s => { s.av = {"IT-32-BZ": MALEVOLO}; s.avDate = {"IT-32-BZ": "2026-12-10"}; }});
    await page.locator("details.avb summary").first().click();
    await page.mouse.move(10, 10);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator("#avBulletins script")).toHaveCount(0);
    await expect(page.locator("#avBulletins img")).toHaveCount(0);
    await expect(page.locator("details.avb").first()).toContainText("TEST pericolo forte");
    await expect(page.locator("details.avb").first()).toContainText("testo originale in tedesco");
  });
});
