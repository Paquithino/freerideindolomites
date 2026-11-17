# Calibrazione dei modelli

Generata il 2026-11-17 su 7 stazioni nivometriche dell'Alto Adige (open data Provincia di Bolzano, CC0) e 3059 giornate negli inverni 2023-24, 2024-25, 2025-26, 2026-27.

Neve misurata = aumento dell'altezza neve tra le 8:00 di un giorno e le 8:00 del giorno dopo (la neve che "resta", al netto dell'assestamento). Contano le giornate con almeno 1 cm misurato o previsto.

## Modelli

| Modello | Giornate | Fattore | Errore medio (cm) | Peso | Fattore a 1 / 2 / 3 giorni |
|---|---|---|---|---|---|
| ICON · DWD (Germania) | 902 | ×0,6 | 3,6 | 0,93 | ×0,58 / ×0,7 / ×0,5 |
| ICON-2I · ItaliaMeteo | 239 | ×0,56 | 3,1 | 1,09 | ×0,54 / ×0,6 / ×1 |
| ECMWF (Europa) | 359 | ×0,54 | 3 | 1,11 | ×0,56 / ×0,52 / ×0,62 |
| GFS · NOAA (USA) | 632 | ×0,58 | 3,5 | 0,97 | ×0,66 / ×0,54 / ×0,5 |
| Météo-France | 951 | ×0,52 | 3,8 | 0,9 | ×0,72 / ×0,56 / ×0,5 |

Fattore < 1: il modello tende a prevedere più neve di quella misurata. Peso > 1: sbaglia meno della media.

## Verifica fuori campione

Per ogni inverno i fattori sono calcolati sugli altri inverni e messi alla prova su quello.

| Anticipo | Giornate | Errore medio prima | Errore medio dopo | Nevicate ≥10 cm prese (prima → dopo) | Falsi allarmi (prima → dopo) |
|---|---|---|---|---|---|
| 1 giorno/i | 832 | 3,6 cm | 3,5 cm | 131/147 → 115/147 | 9 → 5 |
| 2 giorno/i | 833 | 3,6 cm | 3,7 cm | 104/147 → 87/147 | 4 → 1 |
| 3 giorno/i | 877 | 4,4 cm | 4,5 cm | 79/147 → 58/147 | 13 → 14 |

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
