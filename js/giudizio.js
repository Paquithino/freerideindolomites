import { r0 } from "./state.js";
import { t } from "./i18n.js";

/* Giudizio a parole della versione semplice.
   m: metriche dello spot (p48 = neve fresca 48h, n72 = in arrivo 72h, w7 = vento in quota, temp)
   av: bollettino dello spot ({level}) o null
   Il pericolo valanghe forte (4-5) ha sempre la precedenza su tutto. */
export const SOGLIE = {abbondante: 20, poca: 5, vento: 50, caldo: 3};

export function giudizio(m, av){
  const lv = av ? av.level : 0;
  if(lv >= 4) return {ico: "⛔", txt: t("Pericolo valanghe forte"), sub: t("Fuoripista sconsigliato: resta sulle piste battute."), cls: "bad", avvisi: []};
  let g;
  if(m.p48 >= SOGLIE.abbondante) g = {ico: "❄️", txt: t("Neve fresca abbondante"), sub: t("{cm} cm caduti negli ultimi 2 giorni.", {cm: r0(m.p48)}), cls: "top"};
  else if(m.n72 >= SOGLIE.abbondante) g = {ico: "🌨", txt: t("Bella nevicata in arrivo"), sub: t("Circa {cm} cm nei prossimi 3 giorni.", {cm: r0(m.n72)}), cls: "top"};
  else if(m.p48 >= SOGLIE.poca) g = {ico: "🌤", txt: t("Un po' di neve fresca"), sub: t("{cm} cm negli ultimi 2 giorni.", {cm: r0(m.p48)}), cls: "ok"};
  else if(m.n72 >= SOGLIE.poca) g = {ico: "🌥", txt: t("Un po' di neve in arrivo"), sub: t("Circa {cm} cm nei prossimi 3 giorni.", {cm: r0(m.n72)}), cls: "ok"};
  else g = {ico: "😐", txt: t("Niente neve nuova"), sub: t("Neve vecchia, nessuna nevicata in vista nei prossimi 3 giorni."), cls: "meh"};
  const avvisi = [];
  if(lv === 3) avvisi.push(t("⚠️ Pericolo valanghe marcato: serve esperienza."));
  if((m.w7 || 0) >= SOGLIE.vento) avvisi.push(t("Vento forte in quota."));
  if(m.temp > SOGLIE.caldo) avvisi.push(t("🌡 Fa caldo: neve pesante o bagnata."));
  return {...g, avvisi};
}
