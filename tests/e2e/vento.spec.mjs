import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";

const FOTO = process.env.FOTO_VENTO;   // cartella per le foto di controllo (facoltativa)

test.describe("Vento: icona unica con nome, direzione e intensità", () => {
  test("tabella vento dei modelli: icone, niente emoji, unità km/h ↔ nodi salvata", async ({page, errori}, info) => {
    await apri(page, "#spot-marmolada", {modo: "completa"});
    const w = page.locator(".o-models table.wind");
    await expect(w).toBeVisible();
    const icone = w.locator(".vw[role=img]");
    expect(await icone.count()).toBeGreaterThan(10);
    const prima = icone.first();
    await expect(prima).toHaveAttribute("aria-label", /(Tramontana|Grecale|Levante|Scirocco|Ostro|Libeccio|Ponente|Maestrale|calmo).*km\/h/);
    await expect(prima.locator("svg.vw-a")).toBeVisible();
    expect(await w.innerText()).not.toMatch(/[💨🌬🌀]/u);
    await expect(w.locator("tr.fr .vw").first()).toBeVisible();
    await page.locator(".o-models [data-vu=kn]").first().scrollIntoViewIfNeeded();
    if(FOTO) await page.locator(".o-models").screenshot({path: `${FOTO}/${info.project.name}-modelli-kmh.png`});
    await page.locator(".o-models [data-vu=kn]").first().click();
    await expect(page.locator(".o-models table.wind .vw[role=img]").first()).toHaveAttribute("aria-label", /nodi/);
    await expect(page.locator(".o-now .vw")).toHaveAttribute("aria-label", /nodi/);
    if(FOTO) await page.locator(".o-models").screenshot({path: `${FOTO}/${info.project.name}-modelli-nodi.png`});
    expect(await page.evaluate(() => localStorage.getItem("fr_vento"))).toBe('"kn"');
    await page.reload();
    await expect(page.locator(".o-now .vw")).toHaveAttribute("aria-label", /nodi/);
    if(FOTO) await page.locator(".o-now").screenshot({path: `${FOTO}/${info.project.name}-adesso.png`});
    if(FOTO) await page.locator(".o-plan").screenshot({path: `${FOTO}/${info.project.name}-giorni.png`});
    await senzaScrollLaterale(page);
  });

  test("schede e previsione usano la stessa icona", async ({page, errori}, info) => {
    await apri(page, "#spot", {modo: "completa"});
    await expect(page.locator(".vw[role=img]").first()).toBeVisible();
    await expect(page.locator("#vuList [data-vu]")).toHaveCount(2);
    if(FOTO && await page.locator(".card").first().isVisible()) await page.locator(".card").first().screenshot({path: `${FOTO}/${info.project.name}-scheda.png`});
    await apri(page, "#previsione", {modo: "completa"});
    await expect(page.locator(".pv-rg .vw").first()).toBeVisible();
  });

  test("versione semplice: vento nella scheda dello spot e nei giorni", async ({page, errori}, info) => {
    await apri(page, "#spot-cortina", {modo: "semplice"});
    await expect(page.locator(".sg-v .vw")).toBeVisible();
    await expect(page.locator(".sg-d .vw").first()).toBeVisible();
    if(FOTO) await page.locator("#contenuto").screenshot({path: `${FOTO}/${info.project.name}-semplice.png`});
    await senzaScrollLaterale(page);
    expect(await page.locator("body").innerText()).not.toMatch(/💨/u);
  });
});

test("foto scheda semplice", async ({page, errori}, info) => {
  await apri(page, "#spot", {modo: "semplice"});
  if(FOTO) await page.locator("#list .card.sg").first().screenshot({path: `${FOTO}/${info.project.name}-scheda-semplice.png`});
});
