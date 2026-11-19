# Dati storici

## arpav-neve.json

Neve fresca (cm, rilevata alle 8:00 ora solare, ultime 24 ore) e altezza neve al suolo alle 8:00 delle stazioni
nivometeorologiche del Veneto, inverni 2023-24, 2024-25, 2025-26.

**Fonte:** ARPAV – Centro Valanghe di Arabba (UO Neve e Valanghe), dati forniti su richiesta, novembre 2026.

Stazioni automatiche: Passo Falzarego, Monti Alti di Ornella, Cima Pradazzo, Col dei Baldi, Ra Valles, Casera Doana,
Monte Piana, Monte Cherz, Pale di San Martino, Tre Cime di Lavaredo, Val Visdende. Stazione manuale: Arabba (1630 m).

Usato solo dalla calibrazione dei modelli (`scripts/calibra.mjs`, rete "Veneto").
Per aggiungere un nuovo inverno: estrai i file ricevuti da ARPAV in una cartella, salva i `.xls` come `.xlsx` e lancia
`python3 scripts/importa-arpav-neve.py <cartella>` (serve `pandas` e `openpyxl`).
