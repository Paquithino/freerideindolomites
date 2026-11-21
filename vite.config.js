import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/* In sviluppo (npm run dev) gli indirizzi delle pagine (spot/cortina/, valanghe/ …) non sono file:
   li mandiamo all'app, e guida/ alla pagina della guida. In produzione le pagine vere le crea
   scripts/genera-pagine.mjs dopo la build. */
export const ROTTE_APP = /^\/(spot|previsione|pianifica|valanghe|webcam)(\/|$)/;
export const ROTTE_APP_EN = /^\/en(\/?$|\/(spot|forecast|avalanches|webcams)(\/|$))/;
const pagineInSviluppo = {
  name: "freeride-pagine",
  configureServer(server){
    server.middlewares.use((req, _res, next) => {
      const p = (req.url || "").split("?")[0];
      const q = (req.url || "").includes("?") ? "?" + req.url.split("?")[1] : "";
      if(ROTTE_APP.test(p) || ROTTE_APP_EN.test(p)) req.url = "/index.html" + q;
      else if(/^\/en\/guide\/?$/.test(p)) req.url = "/html/en/info.html";
      else if(/^\/en\/contact\/?$/.test(p)) req.url = "/html/en/contatti.html";
      else if(/^\/en\/precipitation\/?$/.test(p)) req.url = "/html/en/precipitazioni.html" + q;
      else if(/^\/guida\/?$/.test(p)) req.url = "/html/info.html";
      else if(/^\/contatti\/?$/.test(p)) req.url = "/html/contatti.html";
      else if(/^\/precipitazioni\/?(\?|$)/.test(p)) req.url = "/html/precipitazioni.html" + ((req.url || "").includes("?") ? "?" + req.url.split("?")[1] : "");
      next();
    });
  }
};

export default defineConfig({
  // percorsi relativi + tag <base> nelle pagine: il sito funziona in una sottocartella (GitHub Pages) e con un dominio
  base: "./",
  plugins: [pagineInSviluppo],
  server: { port: 5173, open: true },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        info: resolve(root, "html/info.html"),
        precipitazioni: resolve(root, "html/precipitazioni.html"),
        contatti: resolve(root, "html/contatti.html"),
        infoEn: resolve(root, "html/en/info.html"),
        precipitazioniEn: resolve(root, "html/en/precipitazioni.html"),
        contattiEn: resolve(root, "html/en/contatti.html")
      }
    }
  }
});
