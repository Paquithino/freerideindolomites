# Calibrazione dei modelli

Generata il 2026-11-17 su 7 stazioni nivometriche dell'Alto Adige (open data Provincia di Bolzano, CC0) e 3059 giornate negli inverni 2023-24, 2024-25, 2025-26, 2026-27.

Neve misurata = aumento dell'altezza neve tra le 8:00 di un giorno e le 8:00 del giorno dopo (la neve che "resta", al netto dell'assestamento). Contano le giornate con almeno 1 cm misurato o previsto.

## Modelli

| Modello | Giornate con neve | Nevicate ≥5 cm | Fattore relativo | Errore medio (cm) | Peso |
|---|---|---|---|---|---|
| ICON · DWD (Germania) | 902 | 405 | ×1,05 | 4,3 | 0,94 |
| ICON-2I · ItaliaMeteo | 239 | 92 | ×0,88 | 3,6 | 1,11 |
| ECMWF (Europa) | 359 | 131 | ×0,95 | 3,7 | 1,09 |
| GFS · NOAA (USA) | 632 | 256 | ×1,09 | 4,1 | 0,97 |
| Météo-France | 951 | 417 | ×1,04 | 4,5 | 0,9 |

Fattore relativo: corregge le differenze tra modelli (la media è 1). Peso > 1: sbaglia meno della media. Scala comune non applicata: ×0,91 (la neve misurata come aumento dell'altezza neve è sempre un po' meno di quella caduta).

## Nevicate di almeno 10 cm

Quanta neve prevedeva ogni modello rispetto a quella misurata (1 = giusto, 0,7 = il 30% in meno).

| Modello | 1 giorno prima | 2 giorni prima | 3 giorni prima |
|---|---|---|---|
| ICON · DWD (Germania) | 0,92 (147) | 0,59 (147) | 0,55 (147) |
| ICON-2I · ItaliaMeteo | 1,04 (57) | 0,78 (57) | – |
| ECMWF (Europa) | 0,91 (47) | 0,82 (50) | 0,58 (50) |
| GFS · NOAA (USA) | 0,75 (92) | 0,57 (90) | 0,51 (90) |
| Météo-France | 0,71 (147) | 0,63 (147) | 0,54 (147) |

## Verifica fuori campione

Per ogni inverno i fattori sono calcolati sugli altri inverni e messi alla prova su quello. "Prima" = mediana semplice dei modelli, "dopo" = Previsione FreeRide calibrata.

| Anticipo | Giornate | Errore medio prima → dopo | Nevicate ≥10 cm prese | Neve prevista nelle nevicate ≥10 cm | Falsi allarmi |
|---|---|---|---|---|---|
| 1 giorno/i | 896 | 3,6 → 4 cm | 131 → 134 su 147 | 0,69 → 0,91 | 9 → 26 |
| 2 giorno/i | 900 | 3,6 → 3,7 cm | 104 → 120 su 147 | 0,54 → 0,65 | 4 → 23 |
| 3 giorno/i | 958 | 4,4 → 4,5 cm | 79 → 98 su 147 | 0,38 → 0,53 | 13 → 27 |

## Regimi dei venti (stazioni dell'Alto Adige)

Rapporto tra neve misurata e prevista (mediana dei modelli, 1 giorno prima): sopra 1 i modelli sottostimano.

| Regime | Giornate | Misurata (cm) | Prevista (cm) | Rapporto |
|---|---|---|---|---|
| N | 79 | 407 | 406 | 1 |
| SW | 300 | 1309 | 1357 | 0,96 |
| SE | 128 | 1364 | 1231 | 1,11 |
| CALM | 227 | 876 | 808 | 1,08 |
| NE | 36 | 89 | 145 | 0,62 |
| W | 65 | 166 | 91 | 1,82 |

## Stazioni usate

- Nova Ponente Obereggen (78480SF), 2125 m, 0,9 km dallo spot più vicino
- Badia Piz La Ila (61690SF), 2050 m, 1,2 km dallo spot più vicino
- Sesto Prati di Croda Rossa (91180SF), 1910 m, 2,4 km dallo spot più vicino
- Alpe di Siusi Zallinger (74200MS), 2055 m, 5,5 km dallo spot più vicino
- Passo di Costalunga (78110MS), 1715 m, 6,4 km dallo spot più vicino
- Longiarù Passo Poma (62270SF), 2297 m, 9,3 km dallo spot più vicino
- Braies Alpe Cavallo (42830SF), 2340 m, 10,1 km dallo spot più vicino
