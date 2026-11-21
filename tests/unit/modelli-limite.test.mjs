/* Bot: i 5 modelli si scaricano uno alla volta e chi riceve "429 troppe richieste" viene riprovato */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModels } from "../../js/modelli.js";
import { state } from "../../js/state.js";
import { SPOTS, MODELS } from "../../js/config.js";

const risposta = () => SPOTS.map(() => ({hourly: {time: ["2026-11-21T00:00"], snowfall: [1], temperature_2m: [-5], wind_speed_700hPa: [20], wind_direction_700hPa: [180], wind_gusts_10m: [30]}}));

test("modelli uno alla volta: un 429 non fa sparire il modello", async () => {
  const vero = globalThis.fetch, visti = [];
  let inVolo = 0, maxInVolo = 0, rifiuti = 0;
  globalThis.fetch = async url => {
    const m = new URL(url).searchParams.get("models");
    visti.push(m); inVolo++; maxInVolo = Math.max(maxInVolo, inVolo);
    await new Promise(r => setTimeout(r, 2));
    inVolo--;
    // il secondo modello riceve 429 alle prime chiamate (anche ai tentativi di fetchRetry)
    if(m === MODELS[1].names[0] && rifiuti < 3){ rifiuti++; return new Response("troppe", {status: 429}); }
    return new Response(JSON.stringify(risposta()), {status: 200});
  };
  try{
    state.cal = null;
    await loadModels({unoAllaVolta: true, attesa: 5, pausa: 1});
    assert.equal(maxInVolo, 1, "una richiesta alla volta");
    assert.deepEqual(Object.keys(state.ens).sort(), MODELS.map(m => m.id).sort(), "ci sono tutti e 5");
    assert.ok(rifiuti === 3);
  }finally{ globalThis.fetch = vero; }
});
