import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";
import { storicoStazione } from "../fixtures/storico-finto.mjs";
import { SPOTS } from "../../js/config.js";
import { fileStazione } from "../../js/storico.js";

const FOTO = process.env.FOTO_NM;
const S = SPOTS.find(s => s.id === "marmolada");
const STAZ = [
  {id: "ARPAV-1", name: "Passo Fedaia", operator: "ARPAV", lat: S.lat + 0.02, lon: S.lon, elev: 2050},
  {id: "13_2", name: "Stazione senza vento", operator: "LWD", lat: S.lat - 0.03, lon: S.lon + 0.02, elev: 2300},
  {id: "99", name: "Stazione nuova", operator: "LWD", lat: S.lat, lon: S.lon - 0.04, elev: 2200}
].map(x => ({...x, hs: 95, d24: 3, d48: 5, d72: 20, lt: -6, vw: 12, vwmax: 30, dw: 300, date: new Date().toISOString(), region: ""}));
const snapshot = s => { s.stations = STAZ; return s; };
// la terza stazione non ha ancora uno storico pubblicato; la seconda ha un buco di un giorno 3 giorni fa
const storico = p => {
  if(p === `stazioni/${fileStazione("ARPAV-1")}.json`) return storicoStazione("ARPAV-1", {nome: "Passo Fedaia"});
  if(p === `stazioni/${fileStazione("13_2")}.json`) return storicoStazione("13_2", {senzaVento: true, buchi: [[3 * 24 + 23, 2 * 24 + 1]]});
  return null;
};

test.describe("Neve misurata: giorno per giorno fino a 14 giorni indietro", () => {
  test("oggi: tabella con neve al suolo, fresca, temperatura, vento e andamento 14 giorni", async ({page, errori}, info) => {
    await apri(page, "#spot-marmolada", {modo: "completa", snapshot, storico});
    const box = page.locator(".o-meas");
    await box.scrollIntoViewIfNeeded();
    await expect(box.locator(".oo-giorno .oo-tipo")).toHaveText("Oggi");
    await expect(box.locator("tbody tr")).toHaveCount(3);
    await expect(box.locator('[data-nm-sposta="1"]')).toBeDisabled();
    await expect(box.locator('tr[data-st="ARPAV-1"] svg.nm-sp')).toBeVisible();
    await expect(box.locator('tr[data-st="99"] .nm-sp-vuoto')).toContainText("n.d.");
    if(FOTO) await box.screenshot({path: `${FOTO}/${info.project.name}-nm-oggi.png`});
    await senzaScrollLaterale(page);
  });

  test("indietro giorno per giorno fino a -14, poi la freccia si ferma; dati mancanti = —", async ({page, errori}, info) => {
    await apri(page, "#spot-marmolada", {modo: "completa", snapshot, storico});
    const box = page.locator(".o-meas");
    await box.scrollIntoViewIfNeeded();
    await box.locator('[data-nm-giorno="-7"]').click();
    await expect(box.locator(".oo-tipo")).toHaveText("7 giorni fa");
    // 7→6 giorni fa nevica (+20 cm nella stazione finta)
    await box.locator('[data-nm-sposta="1"]').click();
    await expect(box.locator('tr[data-st="ARPAV-1"] td').nth(2)).toContainText("+");
    await box.locator('[data-nm-giorno="-3"]').click();
    const buco = box.locator('tr[data-st="13_2"]');
    await expect(buco.locator(".nd").first()).toHaveAttribute("title", "Dato non disponibile");
    await expect(box.locator('tr[data-st="99"] td.hs .nd')).toHaveCount(1);
    await box.locator('[data-nm-giorno="-14"]').click();
    await expect(box.locator('[data-nm-sposta="-1"]')).toBeDisabled();
    await box.locator('[data-nm-sposta="-1"]').click({force: true});
    await expect(box.locator(".oo-tipo")).toHaveText("14 giorni fa");
    if(FOTO) await box.screenshot({path: `${FOTO}/${info.project.name}-nm-14g.png`});
    await box.locator('[data-nm-giorno="0"]').click();
    await expect(box.locator(".oo-tipo")).toHaveText("Oggi");
  });

  test("vista ora per ora del giorno scelto", async ({page, errori}, info) => {
    await apri(page, "#spot-marmolada", {modo: "completa", snapshot, storico});
    const box = page.locator(".o-meas");
    await box.scrollIntoViewIfNeeded();
    await box.locator('[data-nm-giorno="-1"]').click();
    await box.locator('[data-nm-vista="ore"]').click();
    const t = box.locator("table.nm-oret").first();
    await expect(t.locator("thead th")).toHaveCount(25);
    await expect(t.locator("tbody tr").first()).toContainText("Neve cm");
    await expect(box.locator(".nm-ore", {hasText: "Stazione nuova"})).toContainText("non disponibili");
    if(FOTO) await box.screenshot({path: `${FOTO}/${info.project.name}-nm-ore.png`});
    await senzaScrollLaterale(page);
  });

  test("con il dito: scorrere sulla tabella cambia giorno", async ({page, errori}, info) => {
    test.skip(info.project.name === "desktop", "gesto solo su touch");
    await apri(page, "#spot-marmolada", {modo: "completa", snapshot, storico});
    const box = page.locator(".o-meas");
    await box.scrollIntoViewIfNeeded();
    const c = box.locator(".nm-corpo");
    const r = await c.boundingBox();
    await c.dispatchEvent("touchstart", {touches: [{identifier: 1, clientX: r.x + 50, clientY: r.y + 30}], changedTouches: [{identifier: 1, clientX: r.x + 50, clientY: r.y + 30}]});
    await c.dispatchEvent("touchend", {touches: [], changedTouches: [{identifier: 1, clientX: r.x + 250, clientY: r.y + 35}]});
    await expect(box.locator(".oo-tipo")).toHaveText("Ieri");
  });
});
