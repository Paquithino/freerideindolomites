import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";

const FOTO = process.env.FOTO_TEMA;
const sfondo = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const scheda = page => page.evaluate(() => getComputedStyle(document.querySelector(".sec, .card")).backgroundColor);
const chiaro = rgb => { const [r, g, b] = rgb.match(/\d+/g).map(Number); return (r + g + b) / 3 > 128; };

test.describe("Tema chiaro/scuro dal sistema", () => {
  test("segue il tema del dispositivo e cambia al volo, senza ricaricare", async ({page, errori}) => {
    await page.emulateMedia({colorScheme: "light"});
    await apri(page, "#spot-marmolada", {modo: "completa"});
    expect(chiaro(await sfondo(page))).toBe(true);
    expect(chiaro(await scheda(page))).toBe(true);
    await page.emulateMedia({colorScheme: "dark"});
    await expect.poll(async () => chiaro(await sfondo(page))).toBe(false);
    expect(chiaro(await scheda(page))).toBe(false);
    // il testo resta leggibile: chiaro su scuro
    const tx = await page.evaluate(() => getComputedStyle(document.querySelector(".sec h3")).color);
    expect(chiaro(tx)).toBe(true);
    await page.emulateMedia({colorScheme: "light"});
    await expect.poll(async () => chiaro(await sfondo(page))).toBe(true);
  });

  for(const [nome, rotta, modo] of [["home", "#spot", "completa"], ["spot", "#spot-marmolada", "completa"], ["semplice", "#spot-cortina", "semplice"], ["previsione", "#previsione", "completa"], ["valanghe", "#valanghe", "completa"]]){
    test(`scuro: ${nome} senza scorrimento laterale`, async ({page, errori}, info) => {
      await page.emulateMedia({colorScheme: "dark"});
      await apri(page, rotta, {modo});
      expect(chiaro(await sfondo(page))).toBe(false);
      await senzaScrollLaterale(page);
      if(FOTO) await page.screenshot({path: `${FOTO}/${info.project.name}-scuro-${nome}.png`, fullPage: true});
    });
  }
});
