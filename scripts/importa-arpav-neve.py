"""
Importa i dati di neve forniti dal Centro Valanghe di Arabba (ARPAV) in un file compatto
usato dalla calibrazione (scripts/calibra.mjs): dati-storici/arpav-neve.json

Ingressi (come li manda ARPAV, già estratti dai .7z):
  - <id>_<nome>_Altezza_neve_ORARI_*.csv   altezza neve oraria (giorno;ora;valore, ora solare, solo dati validi)
  - Hn_Stazioni_automatiche_*.xlsx          neve fresca alle 8:00 (24 h) per stagione, un foglio per inverno
  - Altezza_neve_Arabba_*.xlsx               neve fresca e al suolo alle 8:00, stazione manuale di Arabba
(i .xls vanno prima salvati come .xlsx, per esempio aprendoli e risalvandoli)

Uso:  python3 scripts/importa-arpav-neve.py <cartella con i file>
Regole:
  - neve fresca (hn) = valore ufficiale ARPAV alle 8:00 di quel giorno (neve caduta nelle 24 ore precedenti);
  - cella vuota = 0 cm SOLO se quel giorno la stazione ha misurato l'altezza neve tra le 6 e le 10;
    altrimenti il giorno è considerato mancante (sensore fermo) e non entra nella calibrazione;
  - hs8 = altezza neve al suolo alle 8:00 (dai dati orari), per controllo.
"""
import sys, os, re, glob, json, csv, datetime as dt
import pandas as pd

COLONNE = {"M.Piana": "394", "C.Doana": "389", "Ravales": "385", "M.A.Ornella": "382", "C.Pradazzo": "383",
           "C.Baldi": "384", "M.Cherz": "602", "Falzarego": "347", "Tre Cime": "642", "Pale S.Martino": "641", "Val Visdende": "688"}

def num(v):
    if v is None or (isinstance(v, float) and v != v): return None
    s = str(v).strip().replace(",", ".")
    if s == "": return None
    try: return float(s)
    except ValueError: return None

def main(cartella):
    st = {}
    # 1. altezza neve oraria → presenza del dato e valore alle 8:00
    for f in sorted(glob.glob(os.path.join(cartella, "*_Altezza_neve_ORARI_*.csv"))):
        base = os.path.basename(f)
        m = re.match(r"(\d+)_(.+?)_Altezza_neve_ORARI", base)
        sid, nome = m.group(1), m.group(2).replace("_", " ").replace("(", "").replace(")", "")
        quota = re.search(r"Q(\d{3,4})", nome)
        mattino, hs8 = {}, {}
        with open(f, encoding="latin-1") as fh:
            for r in csv.DictReader(fh, delimiter=";"):
                g = dt.datetime.strptime(r["giorno"], "%d/%m/%Y").date().isoformat()
                h = int(r["ora"][:2]); v = num(r["valore"])
                if v is None: continue
                if 6 <= h <= 10: mattino[g] = True
                if h == 8: hs8[g] = round(v)
        nome = re.sub(r"\s+nivo\b|\s+Q\d+", "", nome).strip()
        st[sid] = {"nome": nome, "tipo": "automatica", **({"quota": int(quota.group(1))} if quota else {}),
                   "hn": {}, "hs8": hs8, "_mattino": mattino}
    # 2. neve fresca ufficiale alle 8:00 (stazioni automatiche)
    for f in glob.glob(os.path.join(cartella, "Hn_Stazioni_automatiche*.xlsx")):
        for foglio, d in pd.read_excel(f, sheet_name=None, header=None).items():
            riga = next(i for i in range(len(d)) if str(d.iat[i, 0]).strip().startswith("Data"))
            nomi = [str(x).strip() for x in d.iloc[riga].tolist()]
            for i in range(riga + 1, len(d)):
                g = d.iat[i, 0]
                if not isinstance(g, (dt.datetime, pd.Timestamp)): continue
                g = g.date().isoformat()
                for c, nm in enumerate(nomi[1:], start=1):
                    sid = COLONNE.get(nm)
                    if not sid or sid not in st: continue
                    v = num(d.iat[i, c])
                    if v is None and st[sid]["_mattino"].get(g): v = 0.0     # vuoto con sensore attivo = niente neve
                    if v is not None: st[sid]["hn"][g] = round(v)
    # 3. Arabba, stazione manuale (le date nel file sono di un anno "modello": contano mese e giorno della stagione)
    for f in glob.glob(os.path.join(cartella, "Altezza_neve_Arabba*.xlsx")):
        d = pd.read_excel(f, header=None)
        riga_st = next(i for i in range(len(d)) if re.match(r"\d{4}-\d{4}", str(d.iat[i, 1])))
        riga = riga_st + 1
        ar = {"nome": "Arabba", "tipo": "manuale", "quota": 1630, "hn": {}, "hs8": {}}
        for c in range(1, d.shape[1], 2):
            stagione = str(d.iat[riga_st, c]).strip()
            if not re.match(r"\d{4}-\d{4}", stagione): continue
            a0 = int(stagione[:4])
            for i in range(riga + 1, len(d)):
                g = d.iat[i, 0]
                if not isinstance(g, (dt.datetime, pd.Timestamp)): continue
                anno = a0 if g.month >= 7 else a0 + 1
                try: data = dt.date(anno, g.month, g.day).isoformat()
                except ValueError: continue                      # 29 febbraio negli anni non bisestili
                hs, hn = num(d.iat[i, c]), num(d.iat[i, c + 1])
                if hs is not None: ar["hs8"][data] = round(hs)
                if hn is not None: ar["hn"][data] = round(hn)
                elif hs is not None: ar["hn"][data] = 0           # misura fatta, nessuna neve fresca
        st["arabba"] = ar
    for s in st.values(): s.pop("_mattino", None)
    out = {"fonte": "ARPAV – Centro Valanghe di Arabba, dati forniti su richiesta (prot. 98455, novembre 2026)",
           "note": "hn = neve fresca alle 8:00 (ora solare) nelle 24 ore precedenti; hs8 = altezza neve al suolo alle 8:00. cm.",
           "stazioni": st}
    dest = os.path.join(os.path.dirname(__file__), "..", "dati-storici", "arpav-neve.json")
    json.dump(out, open(dest, "w"), ensure_ascii=False, separators=(",", ":"))
    for sid, s in st.items():
        hn = s["hn"]; print(f"{sid:>6} {s['nome']:<28} giorni hn {len(hn):4}  con neve {sum(1 for v in hn.values() if v > 0):3}  totale {sum(hn.values()):5} cm")
    print("scritto", os.path.normpath(dest), f"{os.path.getsize(dest)/1024:.0f} KB")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
