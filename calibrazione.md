# Calibrazione dei modelli

Generata il 2026-11-17 su 30 stazioni nivometriche (Alto Adige: open data Provincia di Bolzano, CC0; Veneto: ARPAV, CC BY 4.0) e 3059 giornate negli inverni 2023-24, 2024-25, 2025-26, 2026-27.

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

## Zona: Alto Adige (3059 giornate)

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
| W | 65 | 166 | 91 | 1,82 |

## Zona: Veneto (0 giornate)

Troppe poche giornate per un'analisi separata.

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
- Veneto – Arabba (ARPAV-3), 1642 m, 1,2 km dallo spot più vicino
- Veneto – Passo Falzarego nivo (Q1988) (ARPAV-347), 1988 m, 1,5 km dallo spot più vicino
- Veneto – Monti Alti di Ornella (ARPAV-382), 2227 m, 1,7 km dallo spot più vicino
- Veneto – Ra Valles (ARPAV-385), 2592 m, 2,7 km dallo spot più vicino
- Veneto – Monte Cherz (ARPAV-602), 2010 m, 2,8 km dallo spot più vicino
- Veneto – Malga Ciapela (ARPAV-11), 1475 m, 3,1 km dallo spot più vicino
- Veneto – Cima Pradazzo (ARPAV-383), 2195 m, 3,7 km dallo spot più vicino
- Veneto – Col dei Baldi (ARPAV-384), 1913 m, 3,7 km dallo spot più vicino
- Veneto – Andraz - Cernadoi (ARPAV-657), 1520 m, 4,2 km dallo spot più vicino
- Veneto – Tre Cime di Lavaredo (ARPAV-642), 2375 m, 5 km dallo spot più vicino
- Veneto – Pale di San Martino (ARPAV-641), 2580 m, 6,1 km dallo spot più vicino
- Veneto – Monte Piana (ARPAV-394), 2262 m, 6,1 km dallo spot più vicino
- Veneto – Casera Coltrondo (ARPAV-395), 1929 m, 7,9 km dallo spot più vicino
- Veneto – Malga Losch (ARPAV-390), 1757 m, 11,5 km dallo spot più vicino
- Veneto (precipitazione) – Passo Falzarego (ARPAV-37), 2090 m, 0,7 km dallo spot più vicino
- Veneto (precipitazione) – Passo Pordoi (ARPAV-80), 2154 m, 1,2 km dallo spot più vicino
- Veneto (precipitazione) – Misurina (ARPAV-238), 1743 m, 2,4 km dallo spot più vicino
- Veneto (precipitazione) – Passo Valles (ARPAV-203), 2042 m, 4,6 km dallo spot più vicino
- Veneto (precipitazione) – Ponte Rio Cordon (Selva di Cadore) (ARPAV-505), 1764 m, 4,8 km dallo spot più vicino
- Veneto (precipitazione) – Pescul (ARPAV-132), 1402 m, 5 km dallo spot più vicino
- Veneto (precipitazione) – Pian del Crep (Val di Zoldo) (ARPAV-55), 1741 m, 5,2 km dallo spot più vicino
- Veneto (precipitazione) – Faloria (ARPAV-47), 2235 m, 5,4 km dallo spot più vicino
- Veneto (precipitazione) – Passo Monte Croce Comelico (ARPAV-91), 1621 m, 6,5 km dallo spot più vicino

Alto Adige: altezza neve alle 8:00, finestra di confronto 8:00 → 8:00. Veneto: altezza neve media giornaliera (dati storici ARPAV), finestra 12:00 → 12:00.
