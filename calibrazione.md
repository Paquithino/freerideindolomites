# Calibrazione dei modelli

Generata il 2026-11-19 su 28 stazioni nivometriche (Alto Adige: open data Provincia di Bolzano, CC0; Veneto: ARPAV – Centro Valanghe di Arabba) e 8028 giornate negli inverni 2023-24, 2024-25, 2025-26, 2026-27.

Neve misurata = aumento dell'altezza neve tra le 8:00 di un giorno e le 8:00 del giorno dopo (la neve che "resta", al netto dell'assestamento). Contano le giornate con almeno 1 cm misurato o previsto.

## Modelli

| Modello | Giornate con neve | Nevicate ≥5 cm | Fattore relativo | Errore medio (cm) | Peso |
|---|---|---|---|---|---|
| ICON · DWD (Germania) | 2380 | 1359 | ×1,06 | 4,8 | 0,91 |
| ICON-2I · ItaliaMeteo | 609 | 305 | ×0,87 | 3,9 | 1,12 |
| ECMWF (Europa) | 889 | 411 | ×1,03 | 4,1 | 1,07 |
| GFS · NOAA (USA) | 1694 | 875 | ×1,12 | 4,7 | 0,94 |
| Météo-France | 2183 | 1136 | ×0,94 | 4,5 | 0,97 |

Fattore relativo: corregge le differenze tra modelli (la media è 1). Peso > 1: sbaglia meno della media. Scala comune non applicata: ×1,02 (la neve misurata come aumento dell'altezza neve è sempre un po' meno di quella caduta).

## Nevicate di almeno 10 cm

Quanta neve prevedeva ogni modello rispetto a quella misurata (1 = giusto, 0,7 = il 30% in meno).

| Modello | 1 giorno prima | 2 giorni prima | 3 giorni prima |
|---|---|---|---|
| ICON · DWD (Germania) | 0,96 (616) | 0,65 (616) | 0,59 (616) |
| ICON-2I · ItaliaMeteo | 1,06 (216) | 0,83 (212) | – |
| ECMWF (Europa) | 0,9 (181) | 0,81 (193) | 0,56 (193) |
| GFS · NOAA (USA) | 0,76 (392) | 0,65 (387) | 0,68 (381) |
| Météo-France | 0,84 (459) | 0,72 (459) | 0,65 (459) |

## Verifica fuori campione

Per ogni inverno i fattori sono calcolati sugli altri inverni e messi alla prova su quello. "Prima" = mediana semplice dei modelli, "dopo" = Previsione FreeRide calibrata.

| Anticipo | Giornate | Errore medio prima → dopo | Nevicate ≥10 cm prese | Neve prevista nelle nevicate ≥10 cm | Falsi allarmi |
|---|---|---|---|---|---|
| 1 giorno/i | 2336 | 4 → 4,1 cm | 559 → 566 su 616 | 0,87 → 0,92 | 19 → 24 |
| 2 giorno/i | 2419 | 4,1 → 4,2 cm | 497 → 503 su 616 | 0,67 → 0,71 | 14 → 35 |
| 3 giorno/i | 2516 | 5,3 → 5,5 cm | 409 → 436 su 616 | 0,52 → 0,64 | 35 → 62 |

## Regimi dei venti (stazioni dell'Alto Adige)

Rapporto tra neve misurata e prevista (mediana dei modelli, 1 giorno prima): sopra 1 i modelli sottostimano.

| Regime | Giornate | Misurata (cm) | Prevista (cm) | Rapporto |
|---|---|---|---|---|
| N | 180 | 997 | 1047 | 0,95 |
| SW | 862 | 5402 | 4852 | 1,11 |
| SE | 388 | 5298 | 5997 | 0,88 |
| CALM | 585 | 2613 | 2363 | 1,11 |
| NE | 104 | 631 | 568 | 1,11 |
| W | 167 | 432 | 246 | 1,76 |

## Zona: Alto Adige (3071 giornate)

Nevicate di almeno 10 cm: neve prevista rispetto a quella misurata.

| Modello | 1 giorno | 2 giorni | 3 giorni |
|---|---|---|---|
| ICON · DWD (Germania) | 0,92 (147) | 0,59 (147) | 0,55 (147) |
| ICON-2I · ItaliaMeteo | 1,04 (57) | 0,78 (57) | – |
| ECMWF (Europa) | 0,91 (47) | 0,82 (50) | 0,58 (50) |
| GFS · NOAA (USA) | 0,75 (92) | 0,57 (90) | 0,51 (90) |
| Météo-France | 0,71 (147) | 0,63 (147) | 0,54 (147) |

Regimi dei venti (rapporto misurata / prevista, 1 giorno prima):

| Regime | Giornate | Misurata (cm) | Prevista (cm) | Rapporto |
|---|---|---|---|---|
| N | 79 | 407 | 406 | 1 |
| SW | 300 | 1309 | 1357 | 0,96 |
| SE | 128 | 1364 | 1231 | 1,11 |
| CALM | 227 | 876 | 808 | 1,08 |
| NE | 36 | 89 | 145 | 0,62 |
| W | 69 | 174 | 91 | 1,92 |

## Zona: Veneto (4957 giornate)

Nevicate di almeno 10 cm: neve prevista rispetto a quella misurata.

| Modello | 1 giorno | 2 giorni | 3 giorni |
|---|---|---|---|
| ICON · DWD (Germania) | 0,98 (469) | 0,67 (469) | 0,61 (469) |
| ICON-2I · ItaliaMeteo | 1,06 (159) | 0,84 (155) | – |
| ECMWF (Europa) | 0,9 (134) | 0,8 (143) | 0,56 (143) |
| GFS · NOAA (USA) | 0,77 (300) | 0,68 (297) | 0,73 (291) |
| Météo-France | 0,9 (312) | 0,77 (312) | 0,7 (312) |

Regimi dei venti (rapporto misurata / prevista, 1 giorno prima):

| Regime | Giornate | Misurata (cm) | Prevista (cm) | Rapporto |
|---|---|---|---|---|
| SW | 562 | 4093 | 3495 | 1,17 |
| SE | 260 | 3934 | 4767 | 0,83 |
| CALM | 358 | 1737 | 1555 | 1,12 |
| W | 98 | 258 | 154 | 1,67 |
| NE | 68 | 541 | 423 | 1,28 |
| N | 101 | 590 | 641 | 0,92 |

## Veneto – precipitazione, tutte le giornate (3911 giornate)

Millimetri d'acqua previsti rispetto a quelli misurati dai pluviometri ARPAV in quota (giorno 0 → 24). Attenzione: con neve e vento i pluviometri catturano meno di quanto cade, quindi i valori assoluti tendono a far sembrare i modelli "generosi"; il confronto tra modelli e tra regimi resta valido.

Giornate con almeno 10 mm misurati:

| Modello | 1 giorno | 2 giorni | 3 giorni |
|---|---|---|---|
| ICON · DWD (Germania) | 0,91 (194) | 0,79 (194) | 0,76 (194) |
| ICON-2I · ItaliaMeteo | 0,96 (119) | 0,96 (116) | – |
| ECMWF (Europa) | 0,9 (87) | 0,82 (75) | 0,6 (75) |
| GFS · NOAA (USA) | 1,15 (287) | 1,18 (287) | 1,14 (287) |
| Météo-France | 1,19 (87) | 1 (87) | 0,75 (87) |

Regimi dei venti (mm misurati / previsti, 1 giorno prima):

| Regime | Giornate | Misurata (mm) | Prevista (mm) | Rapporto |
|---|---|---|---|---|
| SW | 444 | 3321 | 4041 | 0,82 |
| CALM | 358 | 1422 | 1893 | 0,75 |
| SE | 194 | 3206 | 3653 | 0,88 |
| N | 126 | 260 | 544 | 0,48 |
| W | 102 | 269 | 568 | 0,47 |
| NE | 40 | 117 | 186 | 0,63 |

## Veneto – precipitazione, solo giornate fredde (temperatura media ≤ 0 °C, precipitazione nevosa) (2303 giornate)

Millimetri d'acqua previsti rispetto a quelli misurati dai pluviometri ARPAV in quota (giorno 0 → 24). Attenzione: con neve e vento i pluviometri catturano meno di quanto cade, quindi i valori assoluti tendono a far sembrare i modelli "generosi"; il confronto tra modelli e tra regimi resta valido.

Giornate con almeno 10 mm misurati:

| Modello | 1 giorno | 2 giorni | 3 giorni |
|---|---|---|---|
| ICON · DWD (Germania) | 1,01 (98) | 0,75 (98) | 0,79 (98) |
| ICON-2I · ItaliaMeteo | 1,26 (48) | 0,94 (48) | – |
| ECMWF (Europa) | 0,91 (48) | 0,85 (48) | 0,55 (48) |
| GFS · NOAA (USA) | 1,27 (157) | 1,26 (157) | 1,23 (157) |
| Météo-France | 1,46 (48) | 1,01 (48) | 0,65 (48) |

Regimi dei venti (mm misurati / previsti, 1 giorno prima):

| Regime | Giornate | Misurata (mm) | Prevista (mm) | Rapporto |
|---|---|---|---|---|
| SW | 282 | 2069 | 2570 | 0,81 |
| CALM | 209 | 744 | 1156 | 0,64 |
| SE | 111 | 1642 | 2186 | 0,75 |
| N | 89 | 169 | 421 | 0,4 |
| W | 54 | 86 | 152 | 0,57 |
| NE | 25 | 91 | 161 | 0,57 |

## Stazioni usate

- Alto Adige – Nova Ponente Obereggen (78480SF), 2125 m, 0,9 km dallo spot più vicino
- Alto Adige – Badia Piz La Ila (61690SF), 2050 m, 1,2 km dallo spot più vicino
- Alto Adige – Sesto Prati di Croda Rossa (91180SF), 1910 m, 2,4 km dallo spot più vicino
- Alto Adige – Alpe di Siusi Zallinger (74200MS), 2055 m, 5,5 km dallo spot più vicino
- Alto Adige – Passo di Costalunga (78110MS), 1715 m, 6,4 km dallo spot più vicino
- Alto Adige – Longiarù Passo Poma (62270SF), 2297 m, 9,3 km dallo spot più vicino
- Alto Adige – Braies Alpe Cavallo (42830SF), 2340 m, 10,1 km dallo spot più vicino
- Veneto – Passo Falzarego (ARPAV-347), 1988 m, – km dallo spot più vicino
- Veneto – Monti Alti di Ornella (ARPAV-382), 2227 m, – km dallo spot più vicino
- Veneto – Cima Pradazzo (ARPAV-383), 2195 m, – km dallo spot più vicino
- Veneto – Col dei Baldi (ARPAV-384), 1913 m, – km dallo spot più vicino
- Veneto – Ra Valles (ARPAV-385), 2592 m, – km dallo spot più vicino
- Veneto – Casera Doana (ARPAV-389), 1887 m, – km dallo spot più vicino
- Veneto – Monte Piana (ARPAV-394), 2262 m, – km dallo spot più vicino
- Veneto – Monte Cherz (ARPAV-602), 2010 m, – km dallo spot più vicino
- Veneto – Pale di San Martino (ARPAV-641), 2580 m, – km dallo spot più vicino
- Veneto – Tre Cime di Lavaredo (ARPAV-642), 2375 m, – km dallo spot più vicino
- Veneto – Val Visdende (ARPAV-688), 2001 m, – km dallo spot più vicino
- Veneto – Arabba (ARPAV-arabba), 1630 m, – km dallo spot più vicino
- Veneto (precipitazione) – Passo Falzarego (ARPAV-37), 2090 m, 0,7 km dallo spot più vicino
- Veneto (precipitazione) – Passo Pordoi (ARPAV-80), 2154 m, 1,2 km dallo spot più vicino
- Veneto (precipitazione) – Misurina (ARPAV-238), 1743 m, 2,4 km dallo spot più vicino
- Veneto (precipitazione) – Passo Valles (ARPAV-203), 2042 m, 4,6 km dallo spot più vicino
- Veneto (precipitazione) – Ponte Rio Cordon (Selva di Cadore) (ARPAV-505), 1764 m, 4,8 km dallo spot più vicino
- Veneto (precipitazione) – Pescul (ARPAV-132), 1402 m, 5 km dallo spot più vicino
- Veneto (precipitazione) – Pian del Crep (Val di Zoldo) (ARPAV-55), 1741 m, 5,2 km dallo spot più vicino
- Veneto (precipitazione) – Faloria (ARPAV-47), 2235 m, 5,4 km dallo spot più vicino
- Veneto (precipitazione) – Passo Monte Croce Comelico (ARPAV-91), 1621 m, 6,5 km dallo spot più vicino

Alto Adige: altezza neve alle 8:00, finestra di confronto 8:00 → 8:00. Veneto: neve fresca rilevata alle 8:00 dal Centro Valanghe di Arabba (stazioni automatiche e manuale di Arabba), finestra 8:00 → 8:00.
