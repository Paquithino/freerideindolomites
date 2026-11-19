/* =========================================================
   FreeRide in Dolomites — CONFIGURAZIONE
   Qui si aggiungono/modificano spot, webcam e fonti.
   ========================================================= */

/* Avviso "lavori in corso" in cima al sito: metti false quando il sito è pronto */
export const LAVORI_IN_CORSO = true;

/* URL del Cloudflare Worker (cartella /worker). Lascia "" per chiamare
   le fonti direttamente dal browser. Esempio: "https://freeride-api.tuonome.workers.dev" */
export const WORKER_URL = "";

/* Giorni di previsione (max 16 con Open-Meteo). Oltre il 5° giorno l'affidabilità cala. */
export const FORECAST_DAYS = 10;


/* Modelli confrontati per la "Previsione FreeRide" (nomi Open-Meteo; se il primo non risponde si prova il successivo) */
export const MODELS = [
  {id: "icon",   label: "ICON · DWD (Germania)",        names: ["icon_seamless"]},
  {id: "icon2i", label: "ICON-2I · ItaliaMeteo",         names: ["italia_meteo_arpae_icon_2i"]},
  {id: "ecmwf",  label: "ECMWF (Europa)",                names: ["ecmwf_ifs", "ecmwf_ifs025"]},
  {id: "gfs",    label: "GFS · NOAA (USA)",              names: ["gfs_seamless"]},
  {id: "mf",     label: "Météo-France",                  names: ["meteofrance_seamless"]}
];

/* Regimi dei venti in quota (700 hPa, ~3.000 m) */
export const REGIMES = {
  SE:   {icon: "🌊", name: "Scirocco", desc: "correnti da sud-est: stau sui versanti sud, neve abbondante ma spesso pesante, quota neve alta"},
  SW:   {icon: "🌧", name: "Libeccio", desc: "correnti da sud-ovest: stau sui versanti sud e sulle Prealpi"},
  W:    {icon: "➡️", name: "Occidentale", desc: "correnti da ovest: precipitazioni in genere moderate"},
  N:    {icon: "❄️", name: "Nordstau", desc: "correnti da nord: neve sulla cresta di confine, a sud föhn e sereno"},
  NE:   {icon: "🌬", name: "Bora / grecale", desc: "correnti da nord-est: aria fredda e secca, neve in genere scarsa in montagna"},
  CALM: {icon: "·",  name: "Venti deboli", desc: "nessun flusso dominante in quota"}
};
/* Esposizione degli spot ai flussi: 2 = favorevole (stau), 1 = a volte, 0 = neutro, -1 = sottovento (föhn).
   Ipotesi basate su letteratura ed esperienza: verranno verificate con i dati delle stazioni. */
export const FLOW_EXPOSURE = {
  "sud":        {SE: 2, SW: 2, W: 0, N: -1, NE: 0},   // Dolomiti meridionali e Prealpi venete/trentine
  "interno":    {SE: 1, SW: 1, W: 0, N: 1,  NE: 0},   // Dolomiti interne (Gardena, Badia, Sella, Fassa)
  "nord":       {SE: 0, SW: 0, W: 1, N: 2,  NE: 0},   // vicino alla cresta di confine (Pusteria, Plose)
  "carniche":   {SE: 2, SW: 2, W: 1, N: 1,  NE: 0},   // Alpi Carniche di confine
  "prealpi-fvg":{SE: 2, SW: 2, W: 0, N: -1, NE: 0},   // Dolomiti Friulane / Prealpi
  "giulie":     {SE: 2, SW: 2, W: 0, N: 1,  NE: 1}    // Alpi Giulie (Canin, Tarvisiano)
};

/* Neve misurata: stazioni entro questa distanza dallo spot, e quante mostrarne */
export const STATIONS_MAX_KM = 20;
export const STATIONS_PER_SPOT = 3;

/* Servizi valanghe (file EAWS CAAMLv6). I bollettini sono quelli ufficiali:
   IT-34 = AINEVA Veneto; IT-32-BZ / IT-32-TN = servizi provinciali Alto Adige e Trentino (membri AINEVA, via Euregio);
   IT-36 = Friuli Venezia Giulia. */
export const PROVIDERS = ["IT-32-BZ", "IT-32-TN", "IT-34", "IT-36"];
export const PROV_NAME = {"IT-32-BZ":"Alto Adige", "IT-32-TN":"Trentino", "IT-34":"Veneto", "IT-36":"Friuli VG"};
export const AINEVA_URL = "https://bollettini.aineva.it/bulletin/latest";
export const AV_LINKS = [
  {t:"AINEVA – bollettini valanghe ufficiali (tutte le regioni)", u:AINEVA_URL},
  {t:"Euregio – Alto Adige, Trentino, Tirolo (avalanche.report)", u:"https://avalanche.report/bulletin/latest"},
  {t:"Meteo Alto Adige – valanghe e meteo montagna", u:"https://meteo.provincia.bz.it/"},
  {t:"Meteotrentino – valanghe e meteo", u:"https://www.meteotrentino.it/"},
  {t:"ARPA Veneto – neve e valanghe", u:"https://www.arpa.veneto.it/"}
];

/* Webcam: ogni elemento può essere
   {t:"titolo", img:"URL immagine"}     → immagine mostrata nel sito (aggiornata ogni 5 min)
   {t:"titolo", embed:"URL viewer"}     → panorama 360° Panomax caricato al tocco
   {t:"titolo", u:"URL pagina"}         → semplice link
   'src' = credito/fonte mostrato sotto l'immagine. */
export const PX = "https://panodata.panomax.com/cams/";
export const FERATEL = id => `https://wtvhspt.feratel.com/hotspot/35/${id}/0.jpeg?design=v5&dcsdesign=feratel4`;
export const SUPERSKI = {t:"Tutte le webcam Dolomiti Superski", u:"https://mydolomiti.dolomitisuperski.com/en/live-info/webcam"};
export const PANOMAX_ALL = {t:"Webcam Panomax 360° (Cortina, Civetta, Sesto…)", u:"https://www.panomax.com/en/all-cameras.html"};

/* Spot
   lat/lon: punto rappresentativo del terreno freeride · elev: quota di riferimento (m) per il meteo
   av.ids: micro-regioni EAWS (prefisso) · av.kw: parole chiave nel nome della micro-regione
   q: quote Vetta / Metà / Base (m): base in paese, vetta in cima agli impianti, metà a metà;
      dove la vetta degli impianti non è quella del terreno freeride la correggiamo (vedi "nota") */
export const SPOTS = [
 {id:"cortina", flow:"sud", name:"Cortina d'Ampezzo", area:"Veneto", lat:46.535, lon:12.105, elev:2400,
  zones:"Tofane, Cristallo, Faloria, Pomedes", q:{top:2932, mid:2107, base:1282},
  av:{p:["IT-34"], ids:["IT-34-BL-02"], kw:["ampezzo"]},
  cams:[PANOMAX_ALL, SUPERSKI]},
 {id:"alta-badia", flow:"interno", name:"Val Badia · Alta Badia", area:"Alto Adige", lat:46.56, lon:11.89, elev:2300,
  zones:"Piz La Ila, Gardenaccia, Puez, Sassongher", q:{top:2500, mid:2010, base:1520},
  av:{p:["IT-32-BZ"], ids:[], kw:["badia","gader","puez","fanes"]},
  cams:[
    {t:"Corvara – Boè 2.224 m", img:FERATEL(6321), src:"feratel / altabadia.org"},
    {t:"La Villa – Piz La Ila 2.077 m", img:FERATEL(6323), src:"feratel / altabadia.org"},
    {t:"San Cassiano – Piz Sorega 2.003 m", img:FERATEL(6324), src:"feratel / altabadia.org"},
    {t:"Badia – La Crusc 2.062 m", img:FERATEL(6326), src:"feratel / altabadia.org"},
    {t:"Tutte le webcam Alta Badia", u:"https://altabadia.org/en/info-service/alta-badia-webcam.html"}]},
 {id:"val-gardena", flow:"interno", name:"Val Gardena", area:"Alto Adige", lat:46.57, lon:11.74, elev:2300,
  zones:"Seceda, Ciampinoi, Sassolungo, Dantercepies", q:{top:2518, mid:1877, base:1236},
  av:{p:["IT-32-BZ"], ids:["IT-32-BZ-18-02"], kw:["gröden","groeden","gardena"]},
  cams:[
    {t:"Seceda 2.450 m – 360°", embed:"https://valgardena.panomax.com/seceda", src:"Panomax / valgardena.it"},
    {t:"Colfosco – Passo Gardena 2.122 m", img:"https://wtvhspt.feratel.com/hotspot/35/6322/2.jpeg?design=v5&dcsdesign=feratel4", src:"feratel / altabadia.org"},
    {t:"Tutte le webcam Val Gardena", u:"https://www.valgardena.it/en/webcams/seceda-panocam/"}]},
 {id:"val-di-fassa", flow:"interno", name:"Val di Fassa", area:"Trentino", lat:46.47, lon:11.77, elev:2300,
  zones:"Belvedere, Col Rodella, Ciampac, Buffaure", q:{top:2630, mid:2048, base:1465},
  av:{p:["IT-32-TN"], ids:[], kw:["fassa"]},
  cams:[
    {t:"Canazei – Belvedere, Col dei Rossi", img:PX+"1343/col_dei_rossi.jpg", src:"Panomax / fassa.com"},
    {t:"Belvedere – Snowpark", img:PX+"1343/belvedere_snowpark.jpg", src:"Panomax / fassa.com"},
    {t:"Alba – Ciampac skiarea", img:PX+"1674/skiareaciampac.jpg", src:"Panomax / fassa.com"},
    {t:"Ciampac – Colac", img:PX+"1674/colac.jpg", src:"Panomax / fassa.com"},
    {t:"Tutte le webcam Val di Fassa", u:"https://fassa.com/it/meteo-e-webcam/webcam"}]},
 {id:"cadore", flow:"sud", name:"Cadore · Misurina", area:"Veneto", lat:46.56, lon:12.27, elev:2100,
  zones:"Marmarole, Sorapiss, Cadini di Misurina, Antelao", q:{top:2200, mid:1978, base:1756},
  av:{p:["IT-34"], ids:["IT-34-BL-04"], kw:["cadore"]},
  cams:[SUPERSKI]},
 {id:"marmolada", flow:"sud", name:"Marmolada", area:"Veneto", lat:46.435, lon:11.865, elev:3000,
  zones:"Punta Rocca, Pian dei Fiacconi, Serauta, Padon", q:{top:3270, mid:2360, base:1450},
  av:{p:["IT-34","IT-32-TN"], ids:["IT-34-BL-01"], kw:["marmolada"]},
  cams:[
    {t:"Passo Fedaia – Marmolada", img:PX+"1343/lagofedaia.jpg", src:"Panomax / fassa.com"},
    {t:"Marmolada – Gran Vernel", img:PX+"1343/marmoladafedaia.jpg", src:"Panomax / fassa.com"},
    {t:"Porta Vescovo – vista Marmolada 360°", embed:"https://portavescovo.panomax.com/", src:"Panomax"}]},
 {id:"sella", flow:"interno", name:"Gruppo Sella", area:"Alto Adige", lat:46.51, lon:11.83, elev:2900,
  zones:"Val Mezdì, Val Lasties, Piz Boè, Val Setus", q:{top:2950, mid:2235, base:1520, nota:"vetta Sass Pordoi"},
  av:{p:["IT-32-BZ","IT-32-TN","IT-34"], ids:[], kw:["sella"]},
  cams:[
    {t:"Sassolungo e Sella da Col dei Rossi", img:PX+"1343/sassolungo_e_sella.jpg", src:"Panomax / fassa.com"},
    {t:"Passo Sella – Torri del Sella, Piz Ciavazes", img:PX+"1343/torrisella_pizciavaces.jpg", src:"Panomax / fassa.com"},
    {t:"Corvara – Boè 2.224 m", img:FERATEL(6321), src:"feratel / altabadia.org"}]},
 {id:"pordoi", flow:"interno", name:"Passo Pordoi · Sass Pordoi", area:"Trentino", lat:46.49, lon:11.81, elev:2700,
  zones:"Canale Holzer, Forcella Pordoi, Val Lasties", q:{top:2950, mid:2208, base:1465, nota:"vetta Sass Pordoi"},
  av:{p:["IT-32-TN","IT-34"], ids:[], kw:["fassa","pordoi"]},
  cams:[
    {t:"Forcella Pordoi", img:PX+"1343/forcella_pordoi.jpg", src:"Panomax / fassa.com"},
    {t:"Passo Pordoi – Rifugio Sass Becè", img:PX+"1293/passo_pordoi.jpg", src:"Panomax / fassa.com"},
    {t:"Sass Pordoi 2.950 m (pagina)", u:"https://www.fassa.com/en/webcam/canazei-belvedere-col-rodella-passo-pordoi/webcam-canazei-passo-pordoi"}]},
 {id:"san-martino", flow:"sud", name:"San Martino di Castrozza", area:"Trentino", lat:46.265, lon:11.81, elev:2600,
  zones:"Pale di San Martino, Rosetta, Tognola, Passo Rolle", q:{top:2380, mid:1915, base:1450},
  av:{p:["IT-32-TN"], ids:[], kw:["pale","san martino","primiero"]},
  cams:[SUPERSKI]},
 {id:"val-zoldana", flow:"sud", name:"Val di Zoldo", area:"Veneto", lat:46.37, lon:12.16, elev:2000,
  zones:"Pelmo, Civetta lato Zoldo, Passo Staulanza", q:{top:2100, mid:1550, base:1000},
  av:{p:["IT-34"], ids:["IT-34-BL-01"], kw:["zoldano"]},
  cams:[PANOMAX_ALL, SUPERSKI]},
 {id:"arabba", flow:"sud", name:"Arabba · Porta Vescovo", area:"Veneto", lat:46.49, lon:11.88, elev:2450,
  zones:"Porta Vescovo, Bec de Roces, Passo Campolongo", q:{top:2478, mid:1962, base:1446, nota:"vetta Porta Vescovo"},
  av:{p:["IT-34"], ids:["IT-34-BL-01"], kw:["agordino"]},
  cams:[
    {t:"Bec de Roces – 360°", embed:"https://arabba.panomax.com/", src:"Panomax"},
    {t:"Porta Vescovo – 360°", embed:"https://portavescovo.panomax.com/", src:"Panomax"},
    {t:"Arabba (Skyline)", u:"https://www.skylinewebcams.com/webcam/italia/veneto/belluno/arabba-dolomiti.html"}]},
 {id:"lagazuoi", flow:"sud", name:"Lagazuoi · Falzarego", area:"Veneto", lat:46.525, lon:12.01, elev:2650,
  zones:"Lagazuoi, Col Gallina, Averau", q:{top:2752, mid:2017, base:1282, nota:"vetta Lagazuoi"},
  av:{p:["IT-34"], ids:["IT-34-BL-02"], kw:["ampezzo"]},
  cams:[PANOMAX_ALL, SUPERSKI]},
 {id:"giau", flow:"sud", name:"Passo Giau · Cinque Torri", area:"Veneto", lat:46.48, lon:12.05, elev:2300,
  zones:"Passo Giau, Nuvolau, Cinque Torri", q:{top:2932, mid:2107, base:1282},
  av:{p:["IT-34"], ids:["IT-34-BL-02"], kw:["ampezzo"]},
  cams:[PANOMAX_ALL, SUPERSKI]},
 {id:"civetta", flow:"sud", name:"Civetta · Alleghe", area:"Veneto", lat:46.40, lon:12.03, elev:2100,
  zones:"Monte Civetta, Col dei Baldi, Fertazza", q:{top:2100, mid:1550, base:1000},
  av:{p:["IT-34"], ids:["IT-34-BL-01"], kw:["agordino"]},
  cams:[PANOMAX_ALL, SUPERSKI]},
 {id:"san-pellegrino", flow:"sud", name:"San Pellegrino · Falcade", area:"Trentino", lat:46.38, lon:11.79, elev:2300,
  zones:"Col Margherita, Costabella, Tre Valli", q:{top:2513, mid:1852, base:1190},
  av:{p:["IT-32-TN","IT-34"], ids:[], kw:["fassa","pellegrino"]},
  cams:[
    {t:"Passo San Pellegrino", img:"https://wtvthmb.feratel.com/thumbnails/6415.jpeg?t=38&design=v5", src:"feratel / fassa.com"},
    {t:"Col Margherita", img:"https://wtvthmb.feratel.com/thumbnails/6414.jpeg?t=38&design=v5", src:"feratel / fassa.com"},
    {t:"Falcade – Le Buse, Cime di Focobon", img:"https://4k.meteocam.it/live/pub/meteocam10_4.jpg", src:"meteocam / fassa.com"}]},
 {id:"tre-cime", flow:"nord", name:"Tre Cime · Alta Pusteria", area:"Alto Adige", lat:46.66, lon:12.34, elev:2200,
  zones:"Monte Elmo, Croda Rossa, Dolomiti di Sesto", q:{top:2200, mid:1755, base:1310},
  av:{p:["IT-32-BZ"], ids:["IT-32-BZ-20"], kw:["sexten","sesto"]},
  cams:[PANOMAX_ALL, SUPERSKI]},
 {id:"plan-de-corones", flow:"nord", name:"Plan de Corones · Braies", area:"Alto Adige", lat:46.72, lon:12.0, elev:2200,
  zones:"Plan de Corones, Dolomiti di Braies", q:{top:2275, mid:1588, base:901},
  av:{p:["IT-32-BZ"], ids:["IT-32-BZ-19"], kw:["prags","braies"]},
  cams:[SUPERSKI]},
 {id:"alpe-di-siusi", flow:"interno", name:"Alpe di Siusi · Sciliar", area:"Alto Adige", lat:46.54, lon:11.63, elev:2200,
  zones:"Sciliar, Denti di Terrarossa, Sassopiatto", q:{top:2210, mid:1905, base:1600},
  av:{p:["IT-32-BZ"], ids:[], kw:["schlern","sciliar","rosengarten","seiser"]},
  cams:[{t:"Seiser Alm (Panocam)", u:"https://www.valgardena.it/en/webcams/seiser-alm-panocam/"}, SUPERSKI]},
 {id:"latemar", flow:"interno", name:"Latemar · Carezza", area:"Alto Adige", lat:46.37, lon:11.54, elev:2300,
  zones:"Latemar, Catinaccio, Passo Costalunga", q:{top:2500, mid:2025, base:1550},
  av:{p:["IT-32-BZ","IT-32-TN"], ids:[], kw:["latemar","fleims","fiemme","rosengarten"]},
  cams:[
    {t:"Carezza – Pra di Tori", img:"https://wtvthmb.feratel.com/thumbnails/6240.jpeg?t=38&design=v3", src:"feratel / fassa.com"},
    {t:"Catinaccio – Ciampedie 360°", img:"https://www.realcam4k.it/live/pub/11_360ok.jpg", src:"realcam / fassa.com"},
    {t:"Webcam Obereggen / Latemar", u:"https://obereggen.com/en/News/Webcam-Livecam"}]},
 {id:"plose", flow:"nord", name:"Plose · Bressanone", area:"Alto Adige", lat:46.70, lon:11.72, elev:2350,
  zones:"Plose, Odle di Eores, Sass de Putia", q:{top:2499, mid:1783, base:1067},
  av:{p:["IT-32-BZ"], ids:["IT-32-BZ-18-01"], kw:["lüsner","luson"]},
  cams:[SUPERSKI]},
 {id:"brenta", flow:"sud", name:"Dolomiti di Brenta · Campiglio", area:"Trentino", lat:46.23, lon:10.86, elev:2400,
  zones:"Grostè, Spinale, Pradalago", q:{top:2500, mid:2000, base:1500},
  av:{p:["IT-32-TN"], ids:[], kw:["brenta"]},
  cams:[]},
 /* ---------- Friuli Venezia Giulia ---------- */
 {id:"sappada", flow:"carniche", name:"Sappada · Peralba", area:"Friuli VG", group:"Alpi Carniche", lat:46.59, lon:12.72, elev:2000,
  zones:"Monte Siera, Peralba, Creta Forata, Hochweißstein", q:{top:2000, mid:1500, base:1000},
  av:{p:["IT-36","IT-34"], ids:[], kw:["sappada","comelico","carnic"]},
  cams:[]},
 {id:"forni-di-sopra", flow:"prealpi-fvg", name:"Forni di Sopra · Dolomiti Friulane", area:"Friuli VG", group:"Dolomiti Friulane", lat:46.43, lon:12.56, elev:2000,
  zones:"Varmost, Cridola, Monfalconi, Clap Varmost", q:{top:2073, mid:1496, base:920},
  av:{p:["IT-36"], ids:[], kw:["dolomiti friulane","friulian dolomites","prealpi carniche","carnic pre"]},
  cams:[]},
 {id:"piancavallo", flow:"prealpi-fvg", name:"Piancavallo · Cavallo", area:"Friuli VG", group:"Dolomiti Friulane", lat:46.12, lon:12.52, elev:1900,
  zones:"Monte Cavallo, Cimon dei Furlani, Tremol", q:{top:1780, mid:1530, base:1280},
  av:{p:["IT-36"], ids:[], kw:["prealpi carniche","carnic pre","cavallo"]},
  cams:[]},
 {id:"zoncolan", flow:"carniche", name:"Zoncolan · Coglians", area:"Friuli VG", group:"Alpi Carniche", lat:46.55, lon:12.90, elev:1900,
  zones:"Monte Zoncolan, Coglians, Crostis, Val Pesarina", q:{top:1780, mid:1365, base:950},
  av:{p:["IT-36"], ids:[], kw:["carnic"]},
  cams:[]},
 {id:"pramollo", flow:"carniche", name:"Passo Pramollo · Nassfeld", area:"Friuli VG", group:"Alpi Carniche", lat:46.56, lon:13.28, elev:1950,
  zones:"Monte Cavallo di Pontebba, Gartnerkofel, Creta di Aip", q:{top:2019, mid:1314, base:610},
  av:{p:["IT-36"], ids:[], kw:["carnic"]},
  cams:[]},
 {id:"sella-nevea", flow:"giulie", name:"Sella Nevea · Canin", area:"Friuli VG", group:"Alpi Giulie", lat:46.37, lon:13.47, elev:2100,
  zones:"Monte Canin, Bila Pec, Montasio, Prevala", q:{top:1863, mid:1497, base:1131},
  av:{p:["IT-36"], ids:[], kw:["giulie","julian","canin"]},
  cams:[]},
 {id:"tarvisio", flow:"giulie", name:"Tarvisio · Lussari", area:"Friuli VG", group:"Alpi Giulie", lat:46.48, lon:13.54, elev:1750,
  zones:"Monte Lussari, Jôf di Miezegnot, Mangart, Fusine", q:{top:1780, mid:1265, base:750},
  av:{p:["IT-36"], ids:[], kw:["giulie","julian","tarvis"]},
  cams:[]}
];

export const AREAS = ["Tutti", "★ Preferiti", "Alto Adige", "Trentino", "Veneto", "Friuli VG"];
