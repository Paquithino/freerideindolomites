import { test, expect, apri, senzaScrollLaterale, isDesktop } from "./aiuto.mjs";
import { datiFinti, indiceAdesso } from "../../js/precip-dati.js";
import { romaLocale, etichettaGiorno } from "../../js/storico.js";

const FOTO = process.env.FOTO_PC;
const etichetta = iso => { const l = romaLocale(Date.parse(iso)); return `${etichettaGiorno(l.slice(0, 10))} · ${l.slice(11, 16)}`; };
const apriMappa = (page, opz = {}) => apri(page, "", {pagina: true, url: "/precipitazioni/", precipitazioni: datiFinti(), ...opz});
const pronta = page => expect(page.locator("#pcMappa")).toHaveAttribute("data-pronta", "1");

test.describe("Animazione precipitazioni", () => {
  test("si apre sull'ora attuale, con titolo per Google, legenda e mappa disegnata", async ({page, errori}, info) => {
    const d = datiFinti();
    await apriMappa(page, {precipitazioni: d});
    await expect(page).toHaveTitle(/Animazione precipitazioni e neve Dolomiti – ora per ora/);
    await expect(page.locator("h1")).toHaveText("Animazione precipitazioni");
    await pronta(page);
    const k = indiceAdesso(d.ore);
    await expect(page.locator("#pcOra")).toHaveText(etichetta(d.ore[k]));
    await expect(page.locator("#pcTipo")).toHaveText("Adesso");
    await expect(page.locator("#pcSlider")).toHaveValue(String(k));
    // il livello ha dei pixel colorati
    const colorati = await page.evaluate(() => { const c = document.querySelector(".pc-cv.on"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for(let i = 3; i < d.length; i += 4) if(d[i]) n++; return n; });
    expect(colorati).toBeGreaterThan(50);
    // legenda: neve, mista e pioggia distinte, e limite neve
    const leg = page.locator(".pc-leg");
    if(!(await leg.getAttribute("open") !== null)) await leg.locator("summary").click();
    await expect(leg).toContainText("Neve"); await expect(leg).toContainText("Mista"); await expect(leg).toContainText("Pioggia"); await expect(leg).toContainText("limite neve");
    await expect(page.locator("#pcInfo")).toContainText("Open-Meteo.com");
    await expect(page.locator("#pcInfo")).toContainText("Aggiornato alle");
    if(FOTO) await page.screenshot({path: `${FOTO}/${info.project.name}-pc-adesso.png`});
    await senzaScrollLaterale(page);
  });

  test("play, pausa, frecce e barra del tempo", async ({page, errori}) => {
    const d = datiFinti();
    await apriMappa(page, {precipitazioni: d, ls: {fr_pc_vel: "veloce"}});
    await pronta(page);
    const k = indiceAdesso(d.ore);
    await page.locator("#pcDopo").click();
    await expect(page.locator("#pcSlider")).toHaveValue(String(k + 1));
    await expect(page.locator("#pcTipo")).toHaveText("Previsto · +1 h");
    await expect(page.locator("#pcAdesso")).toBeVisible();
    await page.locator("#pcPrima").click(); await page.locator("#pcPrima").click();
    await expect(page.locator("#pcTipo")).toHaveText("Ore passate · modello");
    await page.locator("#pcAdesso").click();
    await expect(page.locator("#pcTipo")).toHaveText("Adesso");
    // play: l'ora avanza da sola; pausa: si ferma
    await page.locator("#pcPlay").click();
    await expect(page.locator("#pcPlay")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => +(await page.locator("#pcSlider").inputValue()), {timeout: 4000}).toBeGreaterThan(k + 1);
    await page.locator("#pcPlay").click();
    await expect(page.locator("#pcPlay")).toHaveAttribute("aria-pressed", "false");
    const fermo = await page.locator("#pcSlider").inputValue();
    await page.waitForTimeout(800);
    expect(await page.locator("#pcSlider").inputValue()).toBe(fermo);
    // barra: ultima ora
    await page.locator("#pcSlider").fill(String(d.ore.length - 1));
    await expect(page.locator("#pcOra")).toHaveText(etichetta(d.ore[d.ore.length - 1]));
    await expect(page.locator("#pcDopo")).toBeDisabled();
  });

  test("tastiera: frecce e spazio", async ({page, errori}, info) => {
    test.skip(!isDesktop(info), "tastiera solo su computer");
    const d = datiFinti();
    await apriMappa(page, {precipitazioni: d});
    await pronta(page);
    const k = indiceAdesso(d.ore);
    await page.locator("h1").click();
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    await expect(page.locator("#pcSlider")).toHaveValue(String(k + 2));
    await page.keyboard.press("Space");
    await expect(page.locator("#pcPlay")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Space");
    await expect(page.locator("#pcPlay")).toHaveAttribute("aria-pressed", "false");
  });

  test("aperta dalla pagina dello spot: centrata sullo spot, con il popup dell'ora", async ({page, errori}, info) => {
    await apri(page, "#spot-marmolada", {modo: "completa", precipitazioni: datiFinti()});
    const link = page.locator(".s-prev a.pc-lnk");
    await expect(link).toHaveAttribute("href", "precipitazioni/?spot=marmolada");
    await link.click();
    await expect(page).toHaveURL(/\/precipitazioni\/\?spot=marmolada$/);
    await pronta(page);
    await expect(page.locator("#pcMappa")).toHaveAttribute("data-centro", "marmolada");
    const m = page.locator('[data-pcspot="marmolada"]'), punto = m.locator("i");
    await expect(m).toHaveClass(/on/);
    // il marker dello spot è al centro della mappa
    const [mb, bb] = [await punto.boundingBox(), await page.locator("#pcMappa").boundingBox()];
    expect(Math.abs(mb.x + mb.width / 2 - (bb.x + bb.width / 2))).toBeLessThan(30);
    expect(Math.abs(mb.y + mb.height / 2 - (bb.y + bb.height / 2))).toBeLessThan(30);
    const pop = page.locator(".pc-pop");
    await expect(pop).toContainText("Marmolada");
    await expect(pop).toContainText(/mm\/h · (neve|mista|pioggia)|Niente precipitazioni/);
    await expect(pop.locator("a")).toHaveAttribute("href", "spot/marmolada/");
    if(FOTO) await page.screenshot({path: `${FOTO}/${info.project.name}-pc-spot.png`});
  });

  test("limite neve: si accende e si spegne, e la scelta resta", async ({page, errori}) => {
    await apriMappa(page);
    await pronta(page);
    // ora con la perturbazione in pieno
    await page.locator("#pcSlider").fill("45");
    await expect(page.locator(".pc-linea path")).toHaveCount(2);
    await page.locator("#pcLimite").uncheck();
    await expect(page.locator(".pc-linea path")).toHaveCount(0);
    await page.reload();
    await pronta(page);
    await expect(page.locator("#pcLimite")).not.toBeChecked();
  });

  test("file assente o rovinato: messaggio chiaro, nessun errore", async ({page, errori}) => {
    await apriMappa(page, {precipitazioni: null});
    await expect(page.locator("#pcStato")).toContainText("non è ancora disponibile");
    await expect(page.locator("#pcCtrl")).toHaveClass(/pc-off/);
    await page.unrouteAll({behavior: "ignoreErrors"});
    await apriMappa(page, {precipitazioni: "rotto"});
    await expect(page.locator("#pcStato")).toContainText("non è ancora disponibile");
  });

  test("file vecchio: avviso, ma la mappa funziona", async ({page, errori}) => {
    const vecchio = datiFinti(Date.now() - 5 * 86400e3);
    await apriMappa(page, {precipitazioni: vecchio});
    await pronta(page);
    await expect(page.locator("#pcStato")).toContainText("vecchi");
    await page.locator("#pcPrima").click();
    await expect(page.locator("#pcTipo")).toBeVisible();
  });

  test("mobile: il primo frame arriva presto anche con la rete lenta", async ({page, errori}) => {
    const t0 = Date.now();
    await apriMappa(page, {ritardoPrecipitazioni: 300});
    // la mappa c'è subito, prima dei dati
    await expect(page.locator("#pcMappa .mp-zoom")).toBeVisible();
    await pronta(page);
    expect(Date.now() - t0).toBeLessThan(4000);
    const ms = await page.evaluate(() => { const m = performance.getEntriesByName("pc-primo-frame")[0]; return m ? m.startTime : null; });
    expect(ms).not.toBeNull();
    expect(ms).toBeLessThan(2500);
  });

  test("mappa: pulsanti zoom e trascinamento", async ({page, errori}) => {
    await apriMappa(page);
    await pronta(page);
    const pos = () => page.locator('[data-pcspot="cortina"]').boundingBox();
    const a = await pos();
    await page.locator('.mp-zoom [data-mp="+"]').click();
    await page.waitForTimeout(100);
    const b = await pos();
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(5);
    const bb = await page.locator("#pcMappa").boundingBox();
    await page.mouse.move(bb.x + 30, bb.y + 30); await page.mouse.down();
    await page.mouse.move(bb.x + 130, bb.y + 50, {steps: 5}); await page.mouse.up();
    const c = await pos();
    expect(Math.round(c.x - b.x)).toBeGreaterThan(60);
    await senzaScrollLaterale(page);
  });
});
