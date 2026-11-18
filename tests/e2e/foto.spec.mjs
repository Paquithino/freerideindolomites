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
    await ti.attach(`${nome} · ${ti.project.name}`, {body: await page.screenshot({fullPage: true}), contentType: "image/png"});
  });
}
