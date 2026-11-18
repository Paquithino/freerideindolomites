/* Bollettini di prova nel formato EAWS CAAMLv6 (testi inventati, struttura ufficiale) */
const oggi = new Date().toISOString().slice(0, 10);
const t = (d, h) => `${d}T${String(h).padStart(2, "0")}:00:00Z`;
const domani = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
const ieri = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

export const DATA = oggi;

export const VENETO = [{
  bulletinID: "test-dolomiti", lang: "it", unscheduled: false,
  publicationTime: t(ieri, 16), validTime: {startTime: t(ieri, 16), endTime: t(oggi, 16)},
  regions: [{regionID: "IT-34-BL-02", name: "Dolomiti Ampezzane"}, {regionID: "IT-34-BL-03", name: "Cadore"},
            {regionID: "IT-34-BL-04", name: "Civetta e Zoldo"}, {regionID: "IT-34-BL-05", name: "Marmolada"}],
  dangerRatings: [{mainValue: "considerable", elevation: {lowerBound: "2200"}}, {mainValue: "moderate", elevation: {upperBound: "2200"}}],
  avalancheProblems: [
    {problemType: "wind_slab", elevation: {lowerBound: "2200"}, aspects: ["N", "NE", "E", "NW"], avalancheSize: 2, snowpackStability: "poor", frequency: "some"},
    {problemType: "persistent_weak_layers", elevation: {lowerBound: "2400"}, aspects: ["N", "NE"], avalancheSize: 3}
  ],
  avalancheActivity: {highlights: "TEST accumuli di neve ventata sopra i 2200 m.", comment: "Primo paragrafo di prova.<br/><br/>Secondo paragrafo di prova."},
  snowpackStructure: {comment: "TEST manto nevoso con croste superficiali."},
  travelAdvisory: {comment: "TEST evitare i pendii ripidi sottovento."},
  tendency: [{tendencyType: "decreasing", highlights: "TEST lento consolidamento.", validTime: {endTime: t(domani, 16)}}],
  source: {provider: {name: "ARPAV – Centro Valanghe di Arabba"}}
}, {
  bulletinID: "test-prealpi", lang: "it",
  validTime: {startTime: t(ieri, 16), endTime: t(oggi, 16)},
  regions: [{regionID: "IT-34-VI-01", name: "Prealpi Vicentine"}],
  dangerRatings: [{mainValue: "moderate"}],
  avalancheProblems: [{problemType: "wet_snow", aspects: ["S", "SE", "SW"], validTimePeriod: "later"}],
  avalancheActivity: {highlights: "TEST neve bagnata nel pomeriggio."},
  source: {provider: {name: "ARPAV"}}
}];

/* testo malevolo: il sito deve mostrarlo come testo, mai eseguirlo */
export const MALEVOLO = [{
  bulletinID: "test-xss", lang: "de",
  validTime: {startTime: t(ieri, 16), endTime: t(oggi, 16)},
  regions: [{regionID: "IT-32-BZ-08", name: "<img src=x onerror=\"window.__xss=1\">Gruppo Sella"}],
  dangerRatings: [{mainValue: "high"}],
  avalancheProblems: [{problemType: "new_snow", aspects: ["N"]}],
  avalancheActivity: {highlights: "<script>window.__xss=1</script>TEST pericolo forte", comment: "<b onmouseover=\"window.__xss=1\">ciao</b><br/>riga due"},
  source: {provider: {name: "Lawinenwarndienst Südtirol"}}
}];
