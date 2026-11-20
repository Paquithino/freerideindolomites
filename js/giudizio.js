import { r0 } from "./state.js";

/* Giudizio a parole della versione semplice.
   m: metriche dello spot (p48 = neve fresca 48h, n72 = in arrivo 72h, w7 = vento in quota, temp)
   av: bollettino dello spot ({level}) o null
   Il pericolo valanghe forte (4-5) ha sempre la precedenza su tutto. */
export const SOGLIE = {abbondante: 20, poca: 5, vento: 50, caldo: 3};

export function giudizio(m, av){
  const lv = av ? av.level : 0;
  if(lv >= 4) return {ico: "⛔", txt: "Pericolo valanghe forte", sub: "Fuoripista sconsigliato: resta sulle piste battute.", cls: "bad", avvisi: []};
  let g;
  if(m.p48 >= SOGLIE.abbondante) g = {ico: "❄️", txt: "Neve fresca abbondante", sub: `${r0(m.p48)} cm caduti negli ultimi 2 giorni.`, cls: "top"};
  else if(m.n72 >= SOGLIE.abbondante) g = {ico: "🌨", txt: "Bella nevicata in arrivo", sub: `Circa ${r0(m.n72)} cm nei prossimi 3 giorni.`, cls: "top"};
  else if(m.p48 >= SOGLIE.poca) g = {ico: "🌤", txt: "Un po' di neve fresca", sub: `${r0(m.p48)} cm negli ultimi 2 giorni.`, cls: "ok"};
  else if(m.n72 >= SOGLIE.poca) g = {ico: "🌥", txt: "Un po' di neve in arrivo", sub: `Circa ${r0(m.n72)} cm nei prossimi 3 giorni.`, cls: "ok"};
  else g = {ico: "😐", txt: "Niente neve nuova", sub: "Neve vecchia, nessuna nevicata in vista nei prossimi 3 giorni.", cls: "meh"};
  const avvisi = [];
  if(lv === 3) avvisi.push("⚠️ Pericolo valanghe marcato: serve esperienza.");
  if((m.w7 || 0) >= SOGLIE.vento) avvisi.push("Vento forte in quota.");
  if(m.temp > SOGLIE.caldo) avvisi.push("🌡 Fa caldo: neve pesante o bagnata.");
  return {...g, avvisi};
}
