# Prompt — Storico navigabile 14 giorni ("Ora per ora" e "Neve misurata")

## Contesto

Progetto **FreeRide in Dolomites** (repository `freerideindolomites`), sito statico pubblicato su GitHub Pages, struttura in tre directory separate: `html/`, `css/`, `js/` (backend eventuale in `worker/`). I dati vengono scaricati ogni ora da una GitHub Action. Anteprima in locale con `npm run dev`.

La pagina spot è organizzata così (vedi `struttura-pagina-spot.md`):

- **Dati Raccolti** → Adesso · Neve Fresca – stima del modello · **Neve Misurata – stazioni vicine**
- **Previsioni** → Previsioni 10 giorni · Neve per quota · Confronto Modelli · **Ora per ora**
- **Valanghe** → Pericolo Valanghe
- **3D** → Montagna in 3D
- **Webcam** → Webcam

## Obiettivo

Rendere **navigabili all'indietro fino a 14 giorni** due tabelle/grafici della pagina spot, usando i dati realmente raccolti (non le previsioni passate):

1. **Ora per ora** (sezione Previsioni)
2. **Neve misurata – stazioni vicine** (sezione Dati Raccolti)

---

## 1. Grafico "Ora per ora"

### Comportamento
- Oggi il grafico mostra le ore future. Deve diventare una **timeline continua**: fino a **14 giorni nel passato** (dati raccolti) + le ore future già previste.
- All'apertura il grafico è posizionato sull'**ora attuale**, con una linea verticale "Adesso" ben visibile.
- Le ore passate (dati raccolti) e quelle future (previsione) devono essere **distinguibili a colpo d'occhio** (es. sfondo più chiaro o tratteggio per la previsione, etichetta "Misurato" / "Previsto").

### Dati da visualizzare (per ogni ora)
- **Temperatura** (°C)
- **Intensità del vento** (km/h, con raffiche se disponibili, e direzione)
- **Neve caduta** nell'ora (cm)
- **Altezza della neve al suolo** (cm)

### Navigazione
- **Desktop**: scorrimento orizzontale (rotella/trackpad e trascinamento), frecce ◀ ▶ per spostarsi di un giorno.
- **Mobile**: swipe orizzontale fluido, frecce ◀ ▶ grandi e facili da toccare.
- Pulsante **"Torna ad adesso"** sempre disponibile.
- Selettore rapido del giorno (es. chip "Oggi", "Ieri", "-3g", "-7g", "-14g" oppure un piccolo calendario limitato agli ultimi 14 giorni).
- Etichetta del giorno sempre visibile mentre si scorre (es. "Mar 18 nov").
- Non si può andare oltre i 14 giorni indietro: freccia disattivata al limite.

---

## 2. Tabella "Neve misurata – stazioni vicine"

### Comportamento
- Oggi la tabella mostra l'ultimo dato. Deve diventare **navigabile giorno per giorno fino a 14 giorni indietro**.
- Per ogni stazione vicina, per ogni giorno:
  - **Altezza della neve al suolo** (cm)
  - **Neve fresca caduta** nelle 24h (cm)
  - **Temperatura** (min/max)
  - **Vento** (intensità media/massima), se la stazione lo misura
- Opzione per passare dalla vista **giornaliera** alla vista **oraria** (stessi dati, dettaglio orario) per il giorno selezionato.
- Un piccolo **grafico dell'andamento dell'altezza neve** sui 14 giorni per ogni stazione (sparkline o grafico a linee), così si vede subito quando ha nevicato e quanto si è assestata la neve.

### Navigazione
- Stesse regole del grafico "Ora per ora": frecce ◀ ▶, swipe su mobile, selettore rapido del giorno, pulsante "Oggi", limite a 14 giorni.
- I dati mancanti di una stazione vanno mostrati come "—" con tooltip "Dato non disponibile", senza rompere la tabella.

---

## 3. Raccolta e archiviazione dei dati (backend / GitHub Action)

- La GitHub Action oraria, oltre a scaricare i dati attuali, deve **salvare uno storico** per ogni spot e per ogni stazione.
- Formato proposto: file JSON per spot/stazione, es. `data/history/<spot-id>.json` e `data/history/stations/<station-id>.json`, con un record per ora:
  ```json
  { "time": "2026-11-20T10:00:00+01:00", "temp": -4.2, "wind": 18, "gust": 32, "windDir": "NW", "snowfall": 0.5, "snowDepth": 85 }
  ```
- **Finestra mobile di 14 giorni**: a ogni esecuzione aggiungere l'ora nuova ed eliminare i record più vecchi di 14 giorni, così i file restano leggeri.
- Se un'esecuzione salta, l'ora mancante resta vuota (nessun dato inventato o interpolato senza indicarlo).
- Dove la fonte lo permette (es. stazioni ARPAV / Alto Adige), al primo avvio fare un **riempimento iniziale** degli ultimi 14 giorni, così lo storico è subito completo.
- Fusi orari: salvare con offset esplicito, mostrare sempre in ora italiana (Europe/Rome).

---

## 4. Requisiti generali

- Funzionamento **al 100% sia su desktop sia su mobile** (il sito sarà usato soprattutto da smartphone).
- Rispettare lo stile grafico attuale del sito (restyling ispirato a weatherpro.com).
- Caricamento leggero: caricare lo storico solo quando l'utente inizia a scorrere indietro (lazy loading), non all'apertura della pagina.
- Codice separato nelle directory `html/`, `css/`, `js/` come nel resto del progetto.
- Aggiornare la **suite di test** (desktop e mobile, browser Brave) con test per: posizionamento iniziale su "Adesso", navigazione avanti/indietro, limite dei 14 giorni, gestione dei dati mancanti.

## 5. Consegna

- Fornire le modifiche come **file .zip** da salvare in Download e applicare con il comando `aggiorna freeride`.
- Elencare i file nuovi e modificati e spiegare brevemente come verificare il funzionamento con `npm run dev`.
