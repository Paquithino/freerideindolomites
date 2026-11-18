/* Fotografie delle pagine principali su ogni dispositivo: finiscono nel report
   (npm run test:report) per controllare a occhio l'aspetto dopo ogni modifica. */
import { test, apri } from "./aiuto.mjs";
import { VENETO } from "../fixtures/bollettini.mjs";

const PAGINE = [
  ["home completa", "#spot", "completa"], ["home semplice", "#spot", "semplice"],
  ["spot completo", "#spot-cortina", "completa"], ["spot semplice", "#spot-cortina", "semplice"],
  ["previsione", "#previsione", "completa"], ["valanghe", "#valanghe", "completa"], ["webcam", "#webcam", "completa"]
];
for(const [nome, hash, modo] of PAGINE){
  test(`foto · ${nome}`, async ({page, errori}, ti) => {
    await apri(page, hash, {modo, snapshot: s => { s.av = {"IT-34": VENETO}; }});
    await page.waitForTimeout(300);
    // pagine molto lunghe (webcam: 28 spot) superano il limite di dimensione delle foto di Safari/WebKit:
    // in quel caso si fotografano i primi 6000 px invece di far fallire il test, che serve solo da documentazione
    let foto;
    try{ foto = await page.screenshot({fullPage: true, timeout: 15_000}); }
    catch(e){
      const h = Math.min(6000, await page.evaluate(() => document.documentElement.scrollHeight));
      foto = await page.screenshot({clip: {x: 0, y: 0, width: page.viewportSize().width, height: h}, fullPage: true});
    }
    await ti.attach(`${nome} · ${ti.project.name}`, {body: foto, contentType: "image/png"});
  });
}
