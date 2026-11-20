/* =========================================================
   ANIMAZIONE PRECIPITAZIONI — formato dati, griglia, colori (niente DOM: lo usano robot, pagina e test)
   File public/dati/precipitazioni/ultimo.json, scritto dal robot ogni 3 ore:
   {v: 1, generato, corsa (ora della corsa del modello, se nota), modello, etichetta,
    griglia: {lat0, lon0, passo, nLat, nLon}, quote: [m per punto],
    ore: ["2026-11-21T14:00Z", …],                       (UTC, offset esplicito)
    p: [[…], …]   precipitazione dell'ora, decimi di mm, una riga per ora, un numero per punto
    s: [[…], …]   parte che cade come neve, 0–10 (10 = tutta neve)
    f: [[…], …]}  zero termico, centinaia di metri
   I punti vanno riga per riga: prima tutte le longitudini della latitudine più a sud.
   ========================================================= */

export const RIQUADRO = {lat0: 45.9, lat1: 47.1, lon0: 10.9, lon1: 13.9};
export const PASSO = 0.1;                  // 13 × 31 = 403 punti (vedi scripts/precipitazioni.mjs per il conto delle chiamate)
export const ORE_AVANTI = 72, ORE_INDIETRO = 24;

export function griglia(r = RIQUADRO, passo = PASSO){
  const nLat = Math.round((r.lat1 - r.lat0) / passo) + 1, nLon = Math.round((r.lon1 - r.lon0) / passo) + 1;
  const punti = [];
  for(let i = 0; i < nLat; i++) for(let j = 0; j < nLon; j++) punti.push({lat: +(r.lat0 + i * passo).toFixed(3), lon: +(r.lon0 + j * passo).toFixed(3)});
  return {lat0: r.lat0, lon0: r.lon0, passo, nLat, nLon, punti};
}

/* neve: da cm di neve fresca a mm d'acqua (Open-Meteo: 7 cm di neve ≈ 10 mm d'acqua) */
export const quotaNeve = f => f == null ? null : Math.max(0, f * 100 - 300);   // ~300 m sotto lo zero termico
export function quotaParte(precMm, neveCm){
  if(!precMm || precMm < 0.05) return 0;
  return Math.max(0, Math.min(10, Math.round(neveCm * 10 / 7 / precMm * 10)));
}

/* valore interpolato (bilineare) di un campo per ora in un punto qualsiasi; null fuori dalla griglia */
export function campionaCampo(g, riga, lat, lon){
  if(!riga) return null;
  const y = (lat - g.lat0) / g.passo, x = (lon - g.lon0) / g.passo;
  if(x < 0 || y < 0 || x > g.nLon - 1 || y > g.nLat - 1) return null;
  const x0 = Math.min(Math.floor(x), g.nLon - 2), y0 = Math.min(Math.floor(y), g.nLat - 2), fx = x - x0, fy = y - y0;
  const v = (i, j) => riga[i * g.nLon + j];
  const a = v(y0, x0), b = v(y0, x0 + 1), c = v(y0 + 1, x0), d = v(y0 + 1, x0 + 1);
  if(a == null || b == null || c == null || d == null) return null;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
/* precipitazione (mm/h), parte nevosa (0–1) e quota neve in un punto, per un'ora */
export function valoreIn(d, k, lat, lon){
  const g = d.griglia;
  const p = campionaCampo(g, d.p[k], lat, lon), s = campionaCampo(g, d.s[k], lat, lon), f = campionaCampo(g, d.f && d.f[k], lat, lon);
  if(p == null) return null;
  return {mm: p / 10, neve: s == null ? null : s / 10, quotaNeve: f == null ? null : Math.round(quotaNeve(f / 1) / 50) * 50};
}
export const tipoDa = neve => neve == null ? "n.d." : neve >= 0.7 ? "neve" : neve > 0.3 ? "mista" : "pioggia";

/* ---------- colori: neve blu/viola, mista rosa, pioggia verde/giallo ---------- */
export const SOGLIE = [0.1, 0.5, 1, 2, 4, 8];          // mm/h
export const SCALE = {
  neve:    [[186, 230, 253], [125, 211, 252], [56, 189, 248], [37, 99, 235], [91, 33, 182], [134, 25, 143]],
  mista:   [[251, 207, 232], [244, 160, 205], [236, 112, 180], [219, 39, 119], [190, 24, 93], [131, 24, 67]],
  pioggia: [[209, 250, 229], [134, 239, 172], [74, 222, 128], [250, 204, 21], [249, 115, 22], [220, 38, 38]]
};
/* colore RGBA per intensità e parte nevosa (alpha 0 sotto 0,1 mm/h) */
export function colore(mm, neve){
  if(mm == null || mm < SOGLIE[0]) return null;
  const sc = SCALE[tipoDa(neve == null ? 0 : neve)];
  let i = 0; while(i < SOGLIE.length - 1 && mm >= SOGLIE[i + 1]) i++;
  // sfumatura dentro la classe, per un passaggio morbido
  const lo = SOGLIE[i], hi = SOGLIE[i + 1] || lo * 2, t = Math.min(1, (mm - lo) / (hi - lo));
  const c0 = sc[i], c1 = sc[Math.min(i + 1, sc.length - 1)];
  const a = Math.round(150 + Math.min(1, mm / 2) * 80);
  return [Math.round(c0[0] + (c1[0] - c0[0]) * t), Math.round(c0[1] + (c1[1] - c0[1]) * t), Math.round(c0[2] + (c1[2] - c0[2]) * t), a];
}

/* ---------- limite neve/pioggia: linea dove la parte nevosa passa 50% (solo dove precipita) ---------- */
export function lineaNeve(d, k, sogliaMm = 0.1){
  const g = d.griglia, P = d.p[k], S = d.s[k], out = [];
  if(!P || !S) return out;
  const val = (i, j) => { const n = i * g.nLon + j; return P[n] >= sogliaMm * 10 ? S[n] / 10 - 0.5 : null; };
  const pt = (i, j) => ({lat: g.lat0 + i * g.passo, lon: g.lon0 + j * g.passo});
  const mezzo = (a, va, b, vb) => { const t = va / (va - vb); return {lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t}; };
  for(let i = 0; i < g.nLat - 1; i++) for(let j = 0; j < g.nLon - 1; j++){
    const v = [val(i, j), val(i, j + 1), val(i + 1, j + 1), val(i + 1, j)];
    if(v.some(x => x == null)) continue;
    const c = [pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)];
    const tagli = [];
    for(let e = 0; e < 4; e++){ const a = e, b = (e + 1) % 4; if((v[a] < 0) !== (v[b] < 0)) tagli.push(mezzo(c[a], v[a], c[b], v[b])); }
    if(tagli.length === 2) out.push(tagli);
    else if(tagli.length === 4){ out.push([tagli[0], tagli[1]]); out.push([tagli[2], tagli[3]]); }
  }
  return out;
}

/* indice dell'ora attuale (o della più vicina) */
export function indiceAdesso(ore, adesso = Date.now()){
  if(!ore || !ore.length) return -1;
  const t = Math.floor(adesso / 3600e3) * 3600e3;
  let best = 0;
  ore.forEach((o, i) => { if(Math.abs(Date.parse(o) - t) < Math.abs(Date.parse(ore[best]) - t)) best = i; });
  return best;
}

/* dati finti (demo e test): una perturbazione che entra da sud-ovest, neve in quota e pioggia nelle valli */
export function datiFinti(adesso = Date.now(), {ore = 24 + 72} = {}){
  const g = griglia(), t0 = Math.floor(adesso / 3600e3) * 3600e3 - 24 * 3600e3;
  const out = {v: 1, generato: new Date(adesso).toISOString(), corsa: new Date(t0 + 18 * 3600e3).toISOString(), modello: "demo", etichetta: "dati dimostrativi",
    griglia: {lat0: g.lat0, lon0: g.lon0, passo: g.passo, nLat: g.nLat, nLon: g.nLon}, quote: [], ore: [], p: [], s: [], f: [], demo: true};
  out.quote = g.punti.map(q => Math.round(800 + 1800 * Math.max(0, Math.sin((q.lat - 45.9) * 2.6)) * (0.6 + 0.4 * Math.cos((q.lon - 12) * 3))));
  for(let k = 0; k < ore; k++){
    out.ore.push(new Date(t0 + k * 3600e3).toISOString().slice(0, 13) + ":00Z");
    const cx = 10.6 + k * 0.05, cy = 46.0 + k * 0.012, zero = 1500 + 600 * Math.sin(k / 18);
    const P = [], S = [], F = [];
    g.punti.forEach((q, n) => {
      const d2 = ((q.lon - cx) / 0.9) ** 2 + ((q.lat - cy) / 0.45) ** 2;
      const mm = 6 * Math.exp(-d2) * (k > 20 && k < 80 ? 1 : 0.15);
      P.push(Math.round(mm * 10));
      const sopra = out.quote[n] - (zero - 300);
      S.push(mm < 0.05 ? 0 : Math.max(0, Math.min(10, Math.round(5 + sopra / 60))));
      F.push(Math.round(zero / 100));
    });
    out.p.push(P); out.s.push(S); out.f.push(F);
  }
  return out;
}
