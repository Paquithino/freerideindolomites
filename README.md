# FreeRide in Dolomites

Web-app mobile-first per freerider: neve fresca, previsioni per pianificare (10 giorni), bollettini valanghe ufficiali e webcam di 22 spot delle Dolomiti.

## Avvio in VS Code
Serve Node.js 18 o più recente (https://nodejs.org).
1. Apri la cartella del progetto in VS Code (*File → Apri cartella*).
2. Apri il terminale (*Terminale → Nuovo terminale*) e la prima volta installa le dipendenze:
   ```
   npm install
   ```
3. Avvia l'anteprima:
   ```
   npm run dev
   ```
   Si apre il browser su http://localhost:5173. Ogni modifica salvata a HTML, CSS o JS si vede subito.
   Dal telefono sulla stessa rete Wi-Fi: usa l'indirizzo "Network" che compare nel terminale.

| Comando | Cosa fa |
|---|---|
| `npm run dev` | anteprima con aggiornamento automatico |
| `npm run build` | crea la versione da pubblicare nella cartella `dist/` |
| `npm run preview` | prova la versione di `dist/` |
| `npm run worker:dev` | avvia il backend Cloudflare in locale (http://localhost:8787) |
| `npm run worker:deploy` | pubblica il backend su Cloudflare |

## Layout
- **Mobile** (< 700 px): una colonna, menu in basso.
- **Tablet** (700–959 px): schede spot su due colonne.
- **Desktop** (≥ 960 px): logo e barra laterale a sinistra, contenuto a tutta larghezza.
  - Lista spot in **tabella** ordinabile (clic sull'intestazione di colonna) oppure a **schede** (pulsanti Tabella/Schede, la scelta viene ricordata).
  - La tabella nasconde da sola le colonne secondarie quando lo spazio è poco.
  - Da 1500 px: pannello riepilogo a destra (neve in arrivo, giornate migliori, valanghe, vento).
  - Da 1700 px: caratteri e spazi più grandi per i monitor ampi.
  - Scheda spot su due colonne; il grafico orario si adatta alla larghezza della colonna.
Le regole sono in fondo a `css/style.css` (sezioni TABLET e DESKTOP). Per provare: Chrome/Brave → F12 → icona telefono/tablet per cambiare larghezza.

## Struttura
```
index.html              pagina principale
html/info.html          guida: come leggere i dati, fonti, avvertenze
css/style.css           grafica (colori in :root all'inizio del file)
js/config.js            ← SPOT, WEBCAM, slug snow-forecast, URL del worker: si modifica solo qui
js/state.js             stato e funzioni condivise
js/meteo.js             previsioni (Open-Meteo), indice Powder, pianificazione
js/valanghe.js          bollettini AINEVA / servizi provinciali (formato EAWS)
js/webcam.js            immagini webcam nel sito, panorami 360°, ingrandimento
js/app.js               viste e navigazione (#spot, #pianifica, #valanghe, #webcam, #spot-<id>)
public/                 file copiati così come sono (icona, manifest per installare l'app)
scripts/aggiorna-dati.mjs   automazione oraria dei dati
worker/                 mini-backend Cloudflare (facoltativo, solo webcam)
vite.config.js          configurazione dell'anteprima e della build
.github/workflows/      pubblicazione automatica su GitHub Pages
.vscode/                estensioni consigliate e avvio in Chrome
```

## Spot
29 spot: Dolomiti (Alto Adige, Trentino, Veneto) e Friuli Venezia Giulia
(Dolomiti Friulane: Forni di Sopra, Piancavallo · Alpi Carniche: Sappada, Zoncolan, Pramollo · Alpi Giulie: Sella Nevea, Tarvisio).
Per aggiungerne uno copia un blocco `{id:..., name:..., ...}` in `js/config.js` e cambia coordinate, quota e zone.

## Fonti
| Dato | Fonte | Come |
|---|---|---|
| Meteo in quota, neve oraria e 10 giorni | Open-Meteo (CC BY 4.0) | API pubblica, senza chiave |
| Previsione FreeRide | Open-Meteo, modelli separati: ICON (DWD), ICON-2I (ItaliaMeteo), ECMWF, GFS, Météo-France (`js/modelli.js`) | mediana + forbice min–max, rapporto neve/acqua variabile con la temperatura, regime dei venti a 700 hPa |
| Neve misurata | Stazioni automatiche Meteo Alto Adige e Meteotrentino, via avalanche.report (`weather_stations/stations.geojson`) | 3 stazioni più vicine per spot (entro 20 km, pesando il dislivello) |
| Previsione neve "di riferimento" | snow-forecast.com | widget gratuito (campo `sfWidget`); le loro condizioni consentono il link solo alla home page |
| Valanghe | Bollettini ufficiali AINEVA (Veneto) e servizi provinciali Alto Adige/Trentino (membri AINEVA, pubblicati con Euregio), FVG | file EAWS da static.avalanche.report |
| Webcam | Panomax, feratel, realcam, meteocam (immagini usate da fassa.com e altabadia.org) | immagine diretta o tramite worker |

### snow-forecast.com
I dati di snow-forecast non sono un'API libera: il sito offre gratis un **widget da incollare** (con link obbligatorio a snow-forecast.com) e dei **feed JSON/XML su richiesta**.
- Widget: vai su https://www.snow-forecast.com/pages/configure_feed1, scegli la località, copia il codice e incollalo nel campo `sfWidget` dello spot in `js/config.js`.
- Feed JSON: se snow-forecast te lo concede, il worker può leggerlo e il sito può usarlo al posto di Open-Meteo.
- Slug verificati: `Cortina`, `Arabba`, `Canazei`. Gli altri (`Corvara`, `Selva-Val-Gardena`, …) vanno controllati aprendo il link nella scheda dello spot.

## Automazione dati (GitHub Actions)
Il file `.github/workflows/aggiorna-sito.yml` gira **ogni ora**, a ogni push su `main` e a mano (scheda Actions → "Aggiorna dati e sito" → Run workflow):
1. `scripts/aggiorna-dati.mjs` scarica meteo, 5 modelli (neve e vento), stazioni e bollettini, usando lo stesso codice del sito;
2. scrive `public/dati/ultimo.json` (~260 KB compresso): il sito lo legge all'apertura invece di scaricare tutto da solo;
3. ricostruisce e pubblica il sito su GitHub Pages;
4. una volta al giorno salva `archivio/AAAA-MM-GG.json` nel ramo **`dati`** (previsioni dei modelli + neve misurata), che servirà per calibrare la Previsione FreeRide.
Il bot scrive solo nel ramo `dati`: il ramo `main` resta tuo e `aggiorna freeride` non va in conflitto.

In locale:
```
npm run dati        # scarica i dati veri e scrive public/dati/ultimo.json (il sito in npm run dev lo usa)
npm run dati:demo   # stessa cosa con dati dimostrativi, senza internet
```
Se `public/dati/ultimo.json` manca o ha più di 3 ore, il sito scarica i dati direttamente (comodo in sviluppo).

## Pubblicazione (una volta sola)
1. Carica il progetto su GitHub (VS Code → Controllo del codice sorgente → Pubblica / Sincronizza).
2. Repository **pubblico** (con GitHub gratuito Pages e Actions illimitate funzionano solo così).
3. Settings → Pages → Source: **GitHub Actions**.
4. Scheda Actions → "Aggiorna dati e sito" → **Run workflow**. Dopo 1–2 minuti il sito è su `https://<utente>.github.io/<repo>/`.
5. Se il salvataggio dell'archivio fallisce per permessi: Settings → Actions → General → Workflow permissions → "Read and write permissions".

## Worker (backend facoltativo, Cloudflare)
Serve se dal browser non si riescono a caricare bollettini o webcam (blocchi CORS o hotlink) e per avere una cache comune.
```
npx wrangler login
npm run worker:deploy
```
Poi in `js/config.js` imposta `WORKER_URL = "https://freeride-api.<tuo-account>.workers.dev"`.
In `wrangler.toml` metti in `ALLOWED_ORIGIN` l'indirizzo del sito. Il worker accetta immagini solo dagli host in `CAM_HOSTS`.
Piano gratuito: 100.000 richieste/giorno.

## Da controllare a inizio stagione
- Friuli VG: le zone del bollettino FVG sono abbinate per parole chiave (Dolomiti Friulane, Carniche, Giulie); verifica la riga "Zona" negli spot friulani.
- In ogni scheda spot la riga **"Zona: …"** del bollettino. Se compare "Zona non individuata", aggiungi l'ID o la parola chiave in `av.ids` / `av.kw`.
  Zone AINEVA Veneto già confermate: `IT-34-BL-01` Agordino-Zoldano, `IT-34-BL-02` Ampezzo-Cadore, `IT-34-BL-04` Cadore.
- Che le immagini webcam si vedano. Se no, attiva il worker.
- **Diritti webcam**: le immagini sono dei gestori. Per un uso pubblico è corretto chiedere il permesso (o usare i loro codici di embed) e mantenere il credito, già mostrato sotto ogni immagine.
