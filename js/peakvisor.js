/* =========================================================
   Montagna in 3D con PeakVisor (https://peakvisor.com/api)
   Il panorama 3D interattivo si incorpora con un iframe su peakvisor.com/embed:
   lat/lng = punto di vista, alt = quota della "camera" (m), yaw = direzione (-180..180),
   pitch = inclinazione (-90 giù .. 90 su), hfov = zoom (140 largo .. 4 stretto).
   Si carica solo al tocco: è grafica 3D pesante, su mobile consuma dati e batteria.
   ========================================================= */
import { esc, state } from "./state.js";

export const PV_BASE = "https://peakvisor.com/embed";

/* Inquadrature per spot. Se lo spot ha `pv` in config lo usa (si regola copiando
   i valori dall'url di PeakVisor), altrimenti calcola due viste automatiche. */
export function viste(spot){
  const v = [];
  if(spot.pv) for(const x of [].concat(spot.pv)) v.push({nome: x.nome || "Vista consigliata", lat: x.lat, lng: x.lng, alt: x.alt, yaw: x.yaw, pitch: x.pitch, hfov: x.hfov});
  const top = spot.q ? spot.q.top : spot.elev + 600;
  v.push({nome: "Dall'alto", lat: spot.lat, lng: spot.lon, alt: Math.round(top + 700), pitch: -22, hfov: 110});
  v.push({nome: "Dal paese", lat: spot.lat, lng: spot.lon, hfov: 120});
  return v;
}

export function urlVista(x){
  const p = new URLSearchParams({lat: (+x.lat).toFixed(5), lng: (+x.lng).toFixed(5)});
  if(x.alt != null) p.set("alt", Math.round(x.alt));
  if(x.yaw != null) p.set("yaw", Math.max(-180, Math.min(180, +x.yaw)).toFixed(1));
  if(x.pitch != null) p.set("pitch", Math.max(-90, Math.min(90, +x.pitch)).toFixed(1));
  if(x.hfov != null) p.set("hfov", Math.max(4, Math.min(140, +x.hfov)).toFixed(0));
  return `${PV_BASE}?${p}`;
}

/* esito del controllo orario del robot: null = mai controllato (si prova comunque l'incorporamento) */
export function statoPeakvisor(){
  const c = state.camCheck && state.camCheck.peakvisor;
  if(!c) return "ok";
  if(!c.ok) return "giu";            // non risponde
  if(c.noFrame) return "esterno";     // risponde ma non si lascia incorporare
  return "ok";
}
const credito = `Modello 3D © <a href="https://peakvisor.com" target="_blank" rel="noopener">PeakVisor</a>.`;

export function peakvisorHTML(spot){
  const v = viste(spot), st = statoPeakvisor();
  if(st !== "ok"){
    // ripiego: il 3D non si può mostrare dentro il sito, si apre in una nuova scheda
    return `<p class="note" style="margin:0 0 8px">${st === "giu" ? "PeakVisor al momento non risponde: riprova più tardi o apri il 3D sul loro sito." : "PeakVisor in questo momento non si lascia mostrare dentro il sito: il 3D si apre in una nuova scheda."}</p>
      <div class="links">${v.map(x => `<a class="lnk" href="${esc(urlVista(x))}" target="_blank" rel="noopener">⛰ ${esc(x.nome)} ↗</a>`).join("")}</div>
      <p class="small" style="margin-top:6px">${credito}</p>`;
  }
  return `<div class="pv3d" data-pv3d>
      <div class="pv3d-bar">
        <div class="pv3d-viste" role="group" aria-label="Inquadratura">${v.map((x, i) => `<button class="${i ? "" : "on"}" data-pvvista="${esc(urlVista(x))}">${esc(x.nome)}</button>`).join("")}</div>
        <button class="pv3d-full" data-pvfull aria-label="Schermo intero">⛶</button>
      </div>
      <div class="pv3d-box"><button class="pv3d-play" data-pvplay="${esc(urlVista(v[0]))}">⛰ Apri la montagna in 3D</button></div>
    </div>
    <p class="small" style="margin-top:6px">Trascina per ruotare, pizzica o usa la rotella per lo zoom. ${credito} Il 3D aiuta a leggere i pendii, non sostituisce bollettino e osservazione sul posto.</p>`;
}

function carica(box, url){
  box.innerHTML = `<iframe src="${esc(url)}" title="PeakVisor: montagna in 3D" loading="lazy" allow="fullscreen; accelerometer; gyroscope" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}

if(typeof document !== "undefined"){
  document.addEventListener("click", e => {
    const play = e.target.closest("[data-pvplay]");
    if(play){ carica(play.parentElement, play.dataset.pvplay); return; }
    const vista = e.target.closest("[data-pvvista]");
    if(vista){
      const w = vista.closest("[data-pv3d]");
      w.querySelectorAll("[data-pvvista]").forEach(b => b.classList.toggle("on", b === vista));
      carica(w.querySelector(".pv3d-box"), vista.dataset.pvvista);
      return;
    }
    const full = e.target.closest("[data-pvfull]");
    if(full){
      const w = full.closest("[data-pv3d]"), on = !w.classList.contains("max");
      // schermo intero "finto" (funziona anche su iPhone, dove Safari non lo permette agli iframe)
      w.classList.toggle("max", on); document.body.classList.toggle("pv3d-aperto", on);
      full.textContent = on ? "✕" : "⛶"; full.setAttribute("aria-label", on ? "Chiudi schermo intero" : "Schermo intero");
      if(on && !w.querySelector("iframe")) carica(w.querySelector(".pv3d-box"), w.querySelector("[data-pvvista].on").dataset.pvvista);
    }
  });
  document.addEventListener("keydown", e => {
    if(e.key !== "Escape") return;
    const w = document.querySelector("[data-pv3d].max"); if(w) w.querySelector("[data-pvfull]").click();
  });
}
