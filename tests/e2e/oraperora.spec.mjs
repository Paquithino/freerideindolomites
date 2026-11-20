import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";
import { storicoSpot } from "../fixtures/storico-finto.mjs";

const FOTO = process.env.FOTO_OO;
const conStorico = (opz = {}) => p => p.startsWith("spot/") ? storicoSpot(p.slice(5, -5), opz) : null;
const scorri = page => page.locator(".o-hour .oo-scorri");

test.describe("Ora per ora: 14 giorni indietro + previsione", () => {
  test("all'apertura è su Adesso, con la linea e la lettura dell'ora attuale; lo storico non si scarica subito", async ({page, errori}, info) => {
    const richieste = [];
    await apri(page, "#spot-marmolada", {modo: "completa", storico: conStorico(), contaStorico: p => richieste.push(p)});
    const box = page.locator(".o-hour");
    await box.scrollIntoViewIfNeeded();
    await expect(box.locator(".oo-now")).toHaveCount(1);
    await expect(box.locator(".oo-lettura")).toContainText("Adesso");
    await expect(box.locator(".oo-giorno")).toContainText("Oggi");
    // la linea Adesso è dentro la parte visibile
    const vis = await page.evaluate(() => { const sc = document.querySelector(".o-hour .oo-scorri"), l = sc.querySelector(".oo-now"); const x = +l.getAttribute("x1"); return x > sc.scrollLeft && x < sc.scrollLeft + sc.clientWidth; });
    expect(vis).toBe(true);
    await expect(box.locator(".oo-prev")).toHaveCount(1);
    expect(richieste.filter(p => p.includes("/spot/"))).toEqual([]);
    if(FOTO) await box.screenshot({path: `${FOTO}/${info.project.name}-oo-adesso.png`});
    await senzaScrollLaterale(page);
  });

  test("indietro: scarica lo storico, arriva a -14 giorni e lì la freccia si ferma", async ({page, errori}, info) => {
    const richieste = [];
    await apri(page, "#spot-marmolada", {modo: "completa", storico: conStorico(), contaStorico: p => richieste.push(p)});
    const box = page.locator(".o-hour");
    await box.scrollIntoViewIfNeeded();
    await box.locator('[data-oo-giorno="-7"]').click();
    await expect.poll(() => richieste.length).toBe(1);
    await expect(box.locator('[data-oo-giorno="-7"]')).toHaveClass(/on/);
    await expect(box.locator(".oo-giorno .oo-tipo")).toHaveText("Registrato");
    await expect(box.locator("[data-oo-adesso]")).toBeVisible();
    await box.locator('[data-oo-giorno="-14"]').click();
    const indietro = box.locator('[data-oo-sposta="-1"]');
    await expect(indietro).toBeDisabled();          // -14 giorni: oltre non si va
    expect(await scorri(page).evaluate(el => el.scrollLeft)).toBeLessThanOrEqual(2);
    if(FOTO) await box.screenshot({path: `${FOTO}/${info.project.name}-oo-14g.png`});
    // avanti di un giorno e ritorno ad adesso
    await box.locator('[data-oo-sposta="1"]').click();
    await expect(indietro).toBeEnabled();
    await box.locator("[data-oo-adesso]").click();
    await expect(box.locator(".oo-giorno .oo-tipo")).toHaveText("Oggi");
    expect(richieste.length).toBe(1);
    await senzaScrollLaterale(page);
  });

  test("dati mancanti: fascia grigia e trattino nella lettura, senza errori", async ({page, errori}) => {
    await apri(page, "#spot-marmolada", {modo: "completa", storico: conStorico({buchi: [[150, 140]]})});
    const box = page.locator(".o-hour");
    await box.scrollIntoViewIfNeeded();
    await box.locator('[data-oo-giorno="-7"]').click();
    await expect(box.locator(".oo-buco")).toHaveCount(1);
    await expect(box.locator(".oo-buco title")).toHaveText("Dato non disponibile");
    // tocco dentro il buco: lettura con i trattini
    const x = await page.evaluate(() => { const sc = document.querySelector(".o-hour .oo-scorri"), b = sc.querySelector(".oo-buco"); sc.scrollLeft = +b.getAttribute("x") - 40; return +b.getAttribute("x") + 10 - sc.scrollLeft; });
    await page.waitForTimeout(200);
    const r = await scorri(page).boundingBox();
    await page.mouse.click(r.x + x, r.y + 100);
    await expect(box.locator(".oo-lettura .oo-nd").first()).toHaveAttribute("title", "Dato non disponibile");
  });

  test("storico non ancora pubblicato: si vede quello che c'è e lo si dice", async ({page, errori}) => {
    await apri(page, "#spot-marmolada", {modo: "completa"});
    const box = page.locator(".o-hour");
    await box.scrollIntoViewIfNeeded();
    await box.locator('[data-oo-giorno="-14"]').click();
    await expect(box.locator(".oo-nota")).toContainText("non è ancora disponibile");
    await expect(box.locator('[data-oo-sposta="-1"]')).toBeDisabled();
  });

  test("con il dito: lo scorrimento laterale muove il grafico, non la pagina", async ({page, errori}) => {
    await apri(page, "#spot-marmolada", {modo: "completa", storico: conStorico()});
    const box = page.locator(".o-hour");
    await box.scrollIntoViewIfNeeded();
    await scorri(page).evaluate(el => el.scrollBy({left: -288}));   // circa un giorno indietro
    await expect(box.locator(".oo-giorno .oo-tipo")).toHaveText("Registrato");
    await expect(box.locator('[data-oo-giorno="-1"]')).toHaveClass(/on/);
    await senzaScrollLaterale(page);
  });
});
