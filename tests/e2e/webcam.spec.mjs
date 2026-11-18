import { test, expect, apri, senzaScrollLaterale } from "./aiuto.mjs";
import { SPOTS } from "../../js/config.js";

const marmolada = SPOTS.find(s => s.id === "marmolada");
const [morta, ferma] = marmolada.cams.filter(c => c.img).map(c => c.img);
const pano = marmolada.cams.find(c => c.embed).embed;
const controllo = {checked: "x", cams: {[morta]: {ok: false, why: "HTTP 404"}, [ferma]: {ok: true, ferma: "2026-11-10T08:00:00Z", why: "ferma"}, [pano]: {ok: true, noFrame: true}}};

test.describe("Webcam", () => {
  test("sezione webcam: tutti gli spot, immagini caricate senza referer, crediti visibili", async ({page, errori}) => {
    const referer = [];
    await apri(page, "#webcam", {modo: "completa", esterni: (route, url) => { if(/\.(jpe?g|png)/i.test(url)) referer.push(route.request().headers()["referer"]); }});
    await expect(page.locator("#camList > .sec")).toHaveCount(SPOTS.length);
    const img = page.locator("#camList img[data-zoom]").first();
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveJSProperty("complete", true);
    expect(await img.evaluate(i => i.naturalWidth)).toBeGreaterThan(0);
    expect(referer.filter(Boolean), "le webcam devono partire senza referer").toEqual([]);
    await expect(page.locator("#camList .cam .cap .small").first()).not.toBeEmpty();
    await senzaScrollLaterale(page);
  });

  test("foto ingrandita: si apre al tocco e si chiude", async ({page, errori}) => {
    await apri(page, "#spot-alta-badia", {modo: "completa"});
    await page.locator(".o-cam img[data-zoom]").first().click();
    await expect(page.locator("#lightbox")).toHaveClass(/on/);
    await page.locator("#lightbox").click();
    await expect(page.locator("#lightbox")).not.toHaveClass(/on/);
    await page.locator(".o-cam img[data-zoom]").first().click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#lightbox")).not.toHaveClass(/on/);
  });

  test("immagine che non arriva: riquadro con messaggio, non un'icona rotta", async ({page, errori}) => {
    await apri(page, "#spot-marmolada", {modo: "completa", immaginiRotte: [morta]});
    await expect(page.locator(".o-cam .fail").first()).toContainText("non disponibile");
  });

  test("controllo automatico: morte nascoste, ferme segnalate, panorami bloccati in nuova scheda", async ({page, errori}) => {
    await apri(page, "#spot-marmolada", {modo: "completa", snapshot: s => { s.camCheck = controllo; }});
    const cam = page.locator(".o-cam");
    await expect(cam.locator(`img[src^="${morta}"]`)).toHaveCount(0);
    await expect(cam).toContainText("Una webcam è nascosta");
    await expect(cam.locator(".ferma")).toContainText("ferma dal");
    const link = cam.locator(`a.play[href="${pano}"]`);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("panorama 360°: l'iframe si carica solo al tocco", async ({page, errori}) => {
    await apri(page, "#spot-marmolada", {modo: "completa"});
    await expect(page.locator(".o-cam iframe")).toHaveCount(0);
    await page.locator(".o-cam button.play").first().click();
    await expect(page.locator(".o-cam iframe")).toHaveCount(1);
    await expect(page.locator(".o-cam iframe")).toHaveAttribute("src", /panomax/);
  });

  test("filtro zona nella sezione webcam", async ({page, errori}) => {
    await apri(page, "#webcam", {modo: "completa"});
    await page.locator("#camChips").getByRole("button", {name: "Trentino", exact: true}).click();
    await expect(page.locator("#camList > .sec")).toHaveCount(SPOTS.filter(s => s.area === "Trentino").length);
  });
});
