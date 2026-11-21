import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";

const FOTO = process.env.FOTO_EN;
test.describe("Versione inglese e badge lingua", () => {
  test("home in inglese: testi, menu, indirizzi e badge EN attivo", async ({page, errori}, info) => {
    await apri(page, "", {modo: "completa", url: "/en/"});
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const b = page.locator("header .lang-b");
    await expect(b).toBeVisible();
    await expect(b.locator('[data-lingua="en"]')).toHaveClass(/on/);
    await expect(b.locator('[data-lingua="it"]')).toHaveAttribute("href", "./");
    await expect(page.locator("#hero")).toContainText("At a glance");
    await expect(page.locator("footer.piede")).toContainText("All rights reserved");
    await expect(page.locator("footer.piede")).toContainText("software engineer");
    if(info.project.name === "desktop") await expect(page.locator('.hnav a[data-tab="previsione"]')).toHaveText("Forecast");
    await expect(page.locator("body")).not.toContainText("Pericolo valanghe fino a");
    if(FOTO) await page.screenshot({path: `${FOTO}/${info.project.name}-home-en.png`});
    await senzaScrollLaterale(page);
  });

  test("badge piccolo: non allarga la testata e non copre il menu", async ({page, errori}) => {
    await apri(page, "", {modo: "completa"});
    const b = await page.locator("header .lang-b").boundingBox();
    expect(b.width).toBeLessThan(90);
    expect(b.height).toBeLessThanOrEqual(34);
    const m = await page.locator("#menuBtn").boundingBox(), r = await page.locator("#refresh").boundingBox();
    const vw = page.viewportSize().width;
    const primo = [m, r].filter(Boolean).map(x => x.x);
    if(primo.length) expect(b.x + b.width).toBeLessThanOrEqual(Math.min(...primo) + 1);
    expect(b.x).toBeGreaterThan(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vw);
    await senzaScrollLaterale(page);
  });

  test("dal badge si passa alla stessa pagina nell'altra lingua, e la scelta resta", async ({page, errori}) => {
    await apri(page, "", {modo: "completa", url: "/spot/cortina/"});
    await expect(page.locator("#v-detail")).toContainText("Adesso");
    await page.locator('header .lang-b [data-lingua="en"]').click();
    await expect(page).toHaveURL(/\/en\/spot\/cortina\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#v-detail")).toContainText("Now");
    await expect(page.locator("#v-detail")).toContainText("Collected data");
    expect(await page.evaluate(() => localStorage.getItem("fr_lingua"))).toBe('"en"');
    // un link interno resta in inglese
    await page.locator(".cover .cv-back").click();
    await expect(page).toHaveURL(/\/en\/spot\/veneto\/$/);
    await expect(page.locator("#spotTitle")).toHaveText("Spots · Veneto");
    // ritorno all'italiano
    await page.locator('header .lang-b [data-lingua="it"]').click();
    await expect(page).toHaveURL(/\/spot\/veneto\/$/);
    await expect(page.locator("#spotTitle")).toHaveText("Spot · Veneto");
    await expect(page.locator("html")).toHaveAttribute("lang", "it");
  });

  test("chi ha scelto l'inglese e arriva da fuori su una pagina italiana va alla versione inglese", async ({page, errori}) => {
    await apri(page, "", {modo: "completa", url: "/valanghe/", ls: {fr_lingua: "en"}});
    await expect(page).toHaveURL(/\/en\/avalanches\/$/);
    await expect(page.locator("#v-valanghe")).toContainText("Danger scale");
  });

  test("pagina spot in inglese: sezioni, tabelle e date in inglese", async ({page, errori}) => {
    await apri(page, "", {modo: "completa", url: "/en/spot/arabba/"});
    const d = page.locator("#v-detail");
    await expect(d).toContainText("Forecast · next 10 days");
    await expect(d).toContainText("Snow by altitude");
    await expect(d).toContainText("Avalanche danger · official bulletin");
    await expect(d).not.toContainText("Previsioni · prossimi");
    await expect(page).toHaveTitle(/snow, weather and avalanches for freeride/);
    const canon = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canon).toMatch(/\/en\/spot\/arabba\/$/);
    expect(await page.locator('link[rel="alternate"][hreflang="it"]').getAttribute("href")).toMatch(/\/spot\/arabba\/$/);
    await senzaScrollLaterale(page);
  });

  for(const [url, h, testo] of [["/en/guide/", "Guide", "Powder index"], ["/en/contact/", "Contact", "All rights reserved"], ["/en/precipitation/", "Precipitation animation", "How to read the map"]]){
    test(`pagina a parte in inglese: ${url}`, async ({page, errori}, info) => {
      await apri(page, "", {pagina: true, url});
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("h1")).toHaveText(h);
      await expect(page.locator("#contenuto")).toContainText(testo);
      const b = page.locator("header .lang-b");
      await expect(b.locator('[data-lingua="en"]')).toHaveClass(/on/);
      await expect(b.locator('[data-lingua="it"]')).toHaveAttribute("href", url.replace("/en/guide/", "guida/").replace("/en/contact/", "contatti/").replace("/en/precipitation/", "precipitazioni/"));
      await expect(page.locator("footer.piede")).toContainText("All rights reserved");
      if(FOTO) await page.screenshot({path: `${FOTO}/${info.project.name}${url.replace(/\//g, "-")}.png`});
      await senzaScrollLaterale(page);
    });
  }
});
