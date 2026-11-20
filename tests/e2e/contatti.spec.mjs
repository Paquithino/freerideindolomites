import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";

const FOTO = process.env.FOTO_CT;
test.describe("Contatti, autore e diritti", () => {
  test("pagina contatti: autore, curriculum, GitHub e diritti riservati", async ({page, errori}, info) => {
    await apri(page, "", {pagina: true, url: "/contatti/"});
    await expect(page).toHaveTitle(/Contatti e diritti – Francesco Fabbro/);
    await expect(page.locator("#contenuto")).toContainText("ideato, progettato e realizzato interamente da me");
    await expect(page.locator(".ct-cv")).toHaveAttribute("href", "https://paquithino.github.io");
    await expect(page.locator(".ct-lista")).toContainText("github.com/Paquithino");
    await expect(page.locator("#diritti")).toContainText("© 2026 Francesco Fabbro. Tutti i diritti riservati.");
    await expect(page.locator("#diritti")).toContainText("Open-Meteo.com");
    if(FOTO) await page.screenshot({path: `${FOTO}/${info.project.name}-contatti.png`, fullPage: true});
    await senzaScrollLaterale(page);
  });

  for(const [nome, url, opz] of [["home", null, {}], ["spot", "#spot-cortina", {}], ["guida", "/guida/", {pagina: true}], ["precipitazioni", "/precipitazioni/", {pagina: true}]]){
    test(`footer con autore, contatti e diritti: ${nome}`, async ({page, errori}) => {
      if(opz.pagina) await apri(page, "", {pagina: true, url});
      else await apri(page, url || "", {modo: "completa"});
      const f = page.locator("footer.piede");
      await f.scrollIntoViewIfNeeded();
      await expect(f).toContainText("Francesco Fabbro, ingegnere informatico");
      await expect(f).toContainText("Tutti i diritti riservati");
      await expect(f.locator('a[href="contatti/"]')).toBeVisible();
      await expect(f.locator('a[href="https://paquithino.github.io"]').first()).toBeVisible();
    });
  }

  test("dal footer alla pagina contatti, e voce nel menu", async ({page, errori}) => {
    await apri(page, "", {modo: "completa"});
    await page.locator('footer.piede a[href="contatti/"]').click();
    await expect(page).toHaveURL(/\/contatti\/$/);
    await expect(page.locator("h1")).toHaveText("Contatti");
    await expect(page.locator('#menu a[href="contatti/"]')).toHaveAttribute("aria-current", "page");
  });
});
