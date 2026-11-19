import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";

test.describe("Montagna in 3D (PeakVisor)", () => {
  for(const modo of ["completa", "semplice"]){
    test(`${modo}: si carica solo al tocco, dentro il sito`, async ({page, errori}) => {
      await apri(page, "#spot-sella", {modo});
      const box = page.locator(".o-3d");
      await expect(box).toContainText("Montagna in 3D");
      await expect(box.locator("iframe")).toHaveCount(0);
      await box.getByRole("button", {name: /Apri la montagna in 3D/}).click();
      const f = box.locator("iframe");
      await expect(f).toHaveAttribute("src", /^https:\/\/peakvisor\.com\/embed\?lat=46\.\d+&lng=11\.\d+/);
      await expect(page).toHaveURL(/\/spot\/sella\/$/);
      await senzaScrollLaterale(page);
    });
  }

  test("cambio inquadratura: ricarica il 3D con la nuova vista", async ({page, errori}) => {
    await apri(page, "#spot-sella", {modo: "completa"});
    const box = page.locator(".o-3d");
    await box.getByRole("button", {name: "Dal paese"}).click();
    await expect(box.getByRole("button", {name: "Dal paese"})).toHaveClass(/on/);
    const src = await box.locator("iframe").getAttribute("src");
    expect(new URL(src).searchParams.has("alt")).toBe(false);
    await box.getByRole("button", {name: "Dall'alto"}).click();
    await expect(box.locator("iframe")).toHaveAttribute("src", /alt=\d+/);
  });

  test("schermo intero: occupa tutto lo schermo e si chiude con ✕ o Esc", async ({page, errori}) => {
    await apri(page, "#spot-sella", {modo: "completa"});
    const w = page.locator(".o-3d [data-pv3d]");
    await w.locator("[data-pvfull]").click();
    await expect(w).toHaveClass(/max/);
    await expect(w.locator("iframe")).toHaveCount(1);
    const [bw, vw] = await Promise.all([w.evaluate(e => e.getBoundingClientRect().width), page.evaluate(() => innerWidth)]);
    expect(Math.abs(bw - vw)).toBeLessThan(2);
    await w.locator("[data-pvfull]").click();
    await expect(w).not.toHaveClass(/max/);
    await w.locator("[data-pvfull]").click();
    await page.keyboard.press("Escape");
    await expect(w).not.toHaveClass(/max/);
    await expect(page.locator("body")).not.toHaveClass(/pv3d-aperto/);
  });

  for(const [caso, pv, testo] of [["non risponde", {ok: false, why: "HTTP 503"}, "non risponde"], ["non incorporabile", {ok: true, noFrame: true}, "nuova scheda"]]){
    test(`PeakVisor ${caso} (controllo del robot): link che aprono il 3D in una nuova scheda`, async ({page, errori}) => {
      await apri(page, "#spot-sella", {modo: "completa", snapshot: s => { s.camCheck = {checked: "x", cams: {}, peakvisor: pv}; }});
      const box = page.locator(".o-3d");
      await expect(box).toContainText(testo);
      await expect(box.locator("[data-pvplay], iframe")).toHaveCount(0);
      const link = box.locator('a[target="_blank"]', {hasText: "Dall'alto"});
      await expect(link).toHaveAttribute("href", /^https:\/\/peakvisor\.com\/embed\?/);
      await senzaScrollLaterale(page);
    });
  }
});
