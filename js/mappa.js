/* =========================================================
   MAPPA LEGGERA — sfondo a tasselli (OpenTopoMap: rilievo, confini, nomi delle valli),
   trascinamento, pizzico per lo zoom, rotella, doppio tocco, pulsanti + / −.
   Niente librerie esterne: il sito resta leggero e i test girano senza rete.
   Coordinate: Web Mercator, tasselli 256 px.
   ========================================================= */
const T = 256;
export const SFONDO = {
  url: (z, x, y) => `https://${"abc"[(x + y) % 3]}.tile.opentopomap.org/${z}/${x}/${y}.png`,
  crediti: 'Mappa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, SRTM · stile © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC BY-SA)'
};
export const ZMIN = 7, ZMAX = 13;

export const lonX = (lon, z) => (lon + 180) / 360 * T * 2 ** z;
export const latY = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * T * 2 ** z; };
export const xLon = (x, z) => x / (T * 2 ** z) * 360 - 180;
export const yLat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / (T * 2 ** z); return 180 / Math.PI * Math.atan(Math.sinh(n)); };

/* crea la mappa dentro el; opz: {centro: [lat, lon], zoom, limiti: {lat0, lat1, lon0, lon1}, onMuovi()} */
export function creaMappa(el, opz = {}){
  el.classList.add("mp");
  el.innerHTML = `<div class="mp-tasselli" aria-hidden="true"></div><div class="mp-sopra"></div>
    <div class="mp-zoom"><button type="button" data-mp="+" aria-label="Avvicina">+</button><button type="button" data-mp="-" aria-label="Allontana">−</button></div>
    <div class="mp-crediti">${SFONDO.crediti}</div>`;
  const strato = el.querySelector(".mp-tasselli"), sopra = el.querySelector(".mp-sopra");
  const lim = opz.limiti;
  let z = opz.zoom || 8, lat = opz.centro ? opz.centro[0] : 46.5, lon = opz.centro ? opz.centro[1] : 12.2;
  const cache = new Map();
  const ascoltatori = [];

  const stato = () => ({z, lat, lon, w: el.clientWidth, h: el.clientHeight});
  /* da coordinate a pixel nel riquadro della mappa */
  const px = (la, lo) => { const w = el.clientWidth, h = el.clientHeight; return [lonX(lo, z) - lonX(lon, z) + w / 2, latY(la, z) - latY(lat, z) + h / 2]; };
  const geo = (x, y) => { const w = el.clientWidth, h = el.clientHeight; return [yLat(latY(lat, z) + y - h / 2, z), xLon(lonX(lon, z) + x - w / 2, z)]; };
  const blocca = () => {
    z = Math.max(ZMIN, Math.min(ZMAX, z));
    if(lim){ lat = Math.max(lim.lat0, Math.min(lim.lat1, lat)); lon = Math.max(lim.lon0, Math.min(lim.lon1, lon)); }
  };

  let attesa = 0;
  const disegna = () => {
    attesa = 0;
    blocca();
    const w = el.clientWidth, h = el.clientHeight, zt = Math.round(z), k = 2 ** (z - zt), n = 2 ** zt;
    const cx = lonX(lon, zt), cy = latY(lat, zt);
    const x0 = Math.floor((cx - w / 2 / k) / T), x1 = Math.floor((cx + w / 2 / k) / T), y0 = Math.floor((cy - h / 2 / k) / T), y1 = Math.floor((cy + h / 2 / k) / T);
    const visti = new Set();
    for(let tx = x0; tx <= x1; tx++) for(let ty = y0; ty <= y1; ty++){
      if(ty < 0 || ty >= n) continue;
      const key = `${zt}/${(tx % n + n) % n}/${ty}`;
      visti.add(key);
      let img = cache.get(key);
      if(!img){
        img = new Image(); img.alt = ""; img.decoding = "async"; img.draggable = false;
        img.onerror = () => img.classList.add("mp-ko");
        img.src = SFONDO.url(zt, (tx % n + n) % n, ty);
        cache.set(key, img);
      }
      img.style.transform = `translate(${(tx * T - cx) * k + w / 2}px,${(ty * T - cy) * k + h / 2}px) scale(${k})`;
      if(img.parentNode !== strato) strato.appendChild(img);
    }
    for(const [key, img] of cache) if(!visti.has(key) && img.parentNode) img.remove();
    if(cache.size > 300) for(const [key] of cache){ if(!visti.has(key)) cache.delete(key); if(cache.size < 200) break; }
    ascoltatori.forEach(f => f(stato()));
  };
  const ridisegna = () => { if(!attesa) attesa = requestAnimationFrame(disegna); };

  /* zoom attorno a un punto dello schermo (dove sono le dita o il mouse) */
  const zoomIn = (nz, sx = el.clientWidth / 2, sy = el.clientHeight / 2) => {
    const [la, lo] = geo(sx, sy);
    z = Math.max(ZMIN, Math.min(ZMAX, nz));
    const w = el.clientWidth, h = el.clientHeight;
    lon = xLon(lonX(lo, z) - (sx - w / 2), z); lat = yLat(latY(la, z) - (sy - h / 2), z);
    ridisegna();
  };

  // dita e mouse
  const dita = new Map();
  let ultimo = null, pizzico = null, tocco0 = 0;
  el.addEventListener("pointerdown", e => {
    if(e.target.closest("button, a, .mp-no")) return;
    el.setPointerCapture(e.pointerId);
    dita.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if(dita.size === 1){
      ultimo = {x: e.clientX, y: e.clientY};
      const ora = Date.now();
      if(ora - tocco0 < 300){ const r = el.getBoundingClientRect(); zoomIn(z + 1, e.clientX - r.left, e.clientY - r.top); }
      tocco0 = ora;
    }
    if(dita.size === 2){ const [a, b] = [...dita.values()]; pizzico = {d: Math.hypot(a.x - b.x, a.y - b.y), z}; }
    el.classList.add("mp-muove");
  });
  el.addEventListener("pointermove", e => {
    if(!dita.has(e.pointerId)) return;
    dita.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if(dita.size === 2 && pizzico){
      const [a, b] = [...dita.values()], r = el.getBoundingClientRect();
      zoomIn(pizzico.z + Math.log2(Math.hypot(a.x - b.x, a.y - b.y) / pizzico.d), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    if(dita.size === 1 && ultimo){
      const dx = e.clientX - ultimo.x, dy = e.clientY - ultimo.y; ultimo = {x: e.clientX, y: e.clientY};
      lon = xLon(lonX(lon, z) - dx, z); lat = yLat(latY(lat, z) - dy, z);
      ridisegna();
    }
  });
  const su = e => { dita.delete(e.pointerId); if(dita.size < 2) pizzico = null; if(!dita.size){ ultimo = null; el.classList.remove("mp-muove"); } else ultimo = [...dita.values()][0]; };
  el.addEventListener("pointerup", su); el.addEventListener("pointercancel", su);
  el.addEventListener("wheel", e => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomIn(z - Math.sign(e.deltaY) * (e.ctrlKey ? 0.25 : 0.5), e.clientX - r.left, e.clientY - r.top); }, {passive: false});
  el.querySelector(".mp-zoom").addEventListener("click", e => { const b = e.target.closest("[data-mp]"); if(b) zoomIn(Math.round(z) + (b.dataset.mp === "+" ? 1 : -1)); });
  if(typeof ResizeObserver !== "undefined") new ResizeObserver(ridisegna).observe(el);

  disegna();
  return {
    el, sopra, px, geo, stato,
    vai(la, lo, nz){ lat = la; lon = lo; if(nz != null) z = nz; disegna(); },
    /* adatta lo zoom per far stare un riquadro nello schermo */
    adatta(r){
      const w = el.clientWidth || 360, h = el.clientHeight || 400;
      lat = (r.lat0 + r.lat1) / 2; lon = (r.lon0 + r.lon1) / 2;
      for(z = ZMAX; z > ZMIN; z -= 0.25) if(lonX(r.lon1, z) - lonX(r.lon0, z) <= w && latY(r.lat0, z) - latY(r.lat1, z) <= h) break;
      disegna();
    },
    zoom: () => z,
    alMuovere(f){ ascoltatori.push(f); },
    ridisegna
  };
}
