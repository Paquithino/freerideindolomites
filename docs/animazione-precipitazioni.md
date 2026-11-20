# Prompt — Animazione oraria delle precipitazioni sulle Dolomiti

## Contesto

Progetto **FreeRide in Dolomites** (repository `freerideindolomites`): sito statico open source e non commerciale, pubblicato su GitHub Pages. Il codice è diviso in tre directory: `html/`, `css/`, `js/`. Se serve un backend va nella directory `worker/`. I dati vengono scaricati ogni ora da una GitHub Action. In locale l'anteprima si lancia con `npm run dev`. Il sito deve funzionare al 100% su desktop e su mobile (sarà usato soprattutto da smartphone). Lo stile grafico è quello del restyling ispirato a weatherpro.com.

## Obiettivo

Creare una **mappa animata, ora per ora, della previsione delle precipitazioni** su tutta l'area del sito: Dolomiti (Alto Adige, Trentino, Veneto/Cadore) e Friuli VG (Dolomiti Friulane, Alpi Carniche, Alpi Giulie).

Il modello di riferimento è la mappa "Analisi e previsioni" del Servizio meteo dell'Alto Adige (weather.province.bz.it/en/analyses-and-forecasts). Mostra ora per ora precipitazioni, nuvolosità, temperatura e raffiche di vento. Le ore passate vengono dall'analisi INCA di GeoSphere Austria. C'è anche la vecchia animazione mobile della provincia (provinz.bz.it/weather/mobile/precipfc.asp), che mostra le precipitazioni delle prossime 24 ore e si aggiorna 8 volte al giorno.

Non dobbiamo copiare immagini o grafica dell'Alto Adige. L'animazione va **generata da noi** a partire dai dati aperti dei modelli.

---

## 1. Cosa vede l'utente

### Mappa
- Una mappa di base del territorio: rilievo/ombreggiatura leggera, confini, nomi delle valli principali.
- Sopra la mappa, un **livello colorato delle precipitazioni** in mm/h, con una scala di colori chiara e una legenda sempre visibile.
- **Distinzione tra neve e pioggia**: è il punto più importante per i freerider. Per esempio blu/viola per la neve e verde/giallo per la pioggia, oppure una retinatura sulle zone di neve. Ci vuole un interruttore "Mostra limite neve".
- I **marker degli spot** del sito sulla mappa. Toccando uno spot si vedono le precipitazioni previste in quell'ora e il link alla pagina dello spot.

### Animazione e timeline
- Un pulsante **Play/Pausa** e le frecce **◀ ▶** per andare avanti o indietro di un'ora.
- Una **barra temporale (slider)** sotto la mappa con giorno e ora sempre visibili (es. "Ven 21 nov · 14:00").
- La velocità di riproduzione si può scegliere (lenta / normale / veloce).
- All'apertura la mappa è posizionata sull'**ora attuale**.
- Un orizzonte di previsione di almeno **48 ore**; se i dati lo permettono, fino a 72 ore.
- *(Facoltativo, seconda fase)* le ore passate, fino a 24 ore indietro, con i dati effettivi. Le ore passate devono essere visivamente distinte da quelle previste, come nel grafico "Ora per ora".

### Livelli aggiuntivi (facoltativi, in una seconda fase)
- Un selettore di livello: **Precipitazioni** (predefinito) · **Neve fresca cumulata** · **Raffiche di vento** · **Temperatura / zero termico** · **Nuvolosità**.

### Mobile
- Mappa a tutta larghezza, con pinch-zoom e trascinamento.
- Controlli grandi e facili da toccare, slider usabile con il pollice.
- La legenda si può comprimere per non coprire la mappa.

---

## 2. Dati

### Fonte proposta: Open-Meteo
Open-Meteo è gratuito per i progetti open source e non commerciali, non richiede una chiave API e chiede l'attribuzione CC BY 4.0. Modelli consigliati, in ordine di priorità:
1. **ICON-2I** (ItaliaMeteo-ARPAE): 2 km, Italia e Alpi, fino a circa 72 ore.
2. **ICON-D2** (DWD): circa 2 km, fino a 2 giorni.
3. **ECMWF IFS** (9 km) come riserva per le ore successive.

Va aggiunta l'attribuzione visibile sotto la mappa: "Dati: Open-Meteo.com (CC BY 4.0) – modello …".

### Variabili orarie da scaricare per ogni punto
`precipitation`, `snowfall`, `rain`, `freezing_level_height` (zero termico). Per i livelli facoltativi servono anche `wind_gusts_10m`, `temperature_2m` e `cloud_cover`.

### Griglia
- Un riquadro che copra Dolomiti e Friuli VG, indicativamente **lat 45,9–47,1 · lon 10,9–13,9**.
- Una griglia regolare di punti (proposta tra **0,05° e 0,08°**), da scaricare con richieste a più coordinate.
- **Prima di scegliere la risoluzione, controllare i limiti gratuiti di Open-Meteo** (chiamate al giorno e numero di località per richiesta). Va scelto un compromesso tra il passo della griglia e la frequenza di aggiornamento, così da restare ampiamente dentro i limiti.

### Aggiornamento (GitHub Action)
- Scaricare la griglia **ogni 3 ore**, in linea con l'aggiornamento dei modelli ad alta risoluzione, non a ogni esecuzione oraria.
- Salvare un file compatto, per esempio `data/precip-anim/latest.json`, con:
  - i metadati: modello, ora della corsa del modello, riquadro, passo della griglia, elenco delle ore;
  - i valori per ogni ora come array numerici compatti (arrotondati a 0,1 mm, eventualmente quantizzati in interi per ridurre il peso).
- In alternativa, se il JSON risulta troppo pesante per il mobile, **pre-generare un'immagine PNG trasparente per ogni ora** nella GitHub Action e salvarla in `data/precip-anim/frames/`.
- Mostrare nella pagina "Aggiornato alle HH:MM – corsa del modello delle HH UTC".

---

## 3. Rendering (frontend)

- La mappa di base usa **Leaflet** (o MapLibre se è già nel progetto).
- Il livello precipitazioni va disegnato su **canvas** con interpolazione tra i punti della griglia (bilineare), così il risultato è morbido e non a quadretti.
- Le ore vanno precaricate nella memoria, così il play è fluido. Con i frame PNG si precaricano le immagini.
- Le transizioni tra un'ora e l'altra sono leggere (dissolvenza breve), ma deve essere possibile disattivarle.
- Tutti i dati vanno **caricati in modo lazy**: la pagina si apre subito, poi si caricano i dati.
- Per lo slider e i pulsanti vanno rispettati l'accessibilità e la navigazione da tastiera: frecce ←/→ e spazio per play/pausa.

---

## 4. Dove va nel sito

- Una **pagina dedicata e indicizzabile**: "Animazione precipitazioni" (`html/precipitazioni.html`), raggiungibile dal menu principale.
- Nella pagina di ogni spot, sezione **Previsioni**, va aggiunto un link o una miniatura "Guarda l'animazione delle precipitazioni". Il link apre la mappa già centrata e zoomata sullo spot (parametro nell'URL, es. `?spot=<spot-id>`).
- Meta tag e titolo vanno pensati per Google: "Animazione precipitazioni e neve Dolomiti – ora per ora".

---

## 5. Test

Aggiornare la suite di test (desktop e mobile, browser **Brave**, il Mac è su macOS 12) con test per:
- l'apertura posizionata sull'ora attuale;
- play/pausa, le frecce avanti/indietro e lo slider;
- l'apertura dalla pagina spot con centratura corretta;
- la legenda e la distinzione neve/pioggia;
- il comportamento con dati mancanti o file non aggiornato (messaggio chiaro, nessun errore bloccante);
- le prestazioni su mobile: il primo frame visibile in tempi brevi.

---

## 6. Consegna

- Fornire le modifiche come **file .zip** da salvare in Download e applicare con il comando `aggiorna freeride`.
- Elencare i file nuovi e quelli modificati, in particolare la GitHub Action, gli script di download, html, css e js.
- Spiegare brevemente come verificare il funzionamento in locale con `npm run dev` e come lanciare a mano la GitHub Action per generare i primi dati.
- Indicare la risoluzione della griglia scelta e quante chiamate al giorno a Open-Meteo comporta.
