/* Storico finto per i test nel browser: 14 giorni pieni fino all'ora attuale, con buchi decisi dal test */
import { ORA, ORE_STORICO, oraPiena, aColonne, CAMPI_SPOT, CAMPI_STAZIONE } from "../../js/storico.js";

/* buchi: [[da ore fa, a ore fa], …] es. [[100, 90]] = mancano le ore tra 100 e 90 ore fa */
export function storicoSpot(id, {buchi = [], adesso = Date.now()} = {}){
  const fine = oraPiena(adesso), m = new Map();
  for(let k = ORE_STORICO; k >= 0; k--){
    if(buchi.some(([a, b]) => k <= a && k >= b)) continue;
    const t = fine - k * ORA;
    m.set(t, {t: -6 + 4 * Math.sin(k / 24 * 2 * Math.PI), n: k % 50 < 6 ? 1.2 : 0, hs: 60 + Math.round((ORE_STORICO - k) / 12), w: 20 + (k % 40), d: (k * 7) % 360, g: 35 + (k % 30)});
  }
  return aColonne(m, CAMPI_SPOT, {id, tipo: "stima oraria registrata"});
}
export function storicoStazione(id, {buchi = [], adesso = Date.now(), senzaVento = false, nome = id} = {}){
  const fine = oraPiena(adesso), m = new Map();
  for(let k = ORE_STORICO; k >= 0; k--){
    if(buchi.some(([a, b]) => k <= a && k >= b)) continue;
    const t = fine - k * ORA;
    // neve che sale di 20 cm tra 7 e 6 giorni fa, poi si assesta
    const hs = k > 168 ? 80 : k > 144 ? 80 + (168 - k) * 20 / 24 : 100 - (144 - k) / 36;
    const r = {hs, t: -8 + 5 * Math.sin(k / 24 * 2 * Math.PI)};
    if(!senzaVento){ r.w = 10 + (k % 20); r.wx = 25 + (k % 25); r.d = 300; }
    m.set(t, r);
  }
  return aColonne(m, CAMPI_STAZIONE, {id, nome});
}
