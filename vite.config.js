import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/* In sviluppo (npm run dev) gli indirizzi delle pagine (spot/cortina/, valanghe/ …) non sono file:
   li mandiamo all'app, e guida/ alla pagina della guida. In produzione le pagine vere le crea
   scripts/genera-pagine.mjs dopo la build. */
export const ROTTE_APP = /^\/(spot|previsione|pianifica|valanghe|webcam)(\/|$)/;
const pagineInSviluppo = {
  name: "freeride-pagine",
  configureServer(server){
    server.middlewares.use((req, _res, next) => {
      const p = (req.url || "").split("?")[0];
      if(ROTTE_APP.test(p)) req.url = "/index.html";
      else if(/^\/guida\/?$/.test(p)) req.url = "/html/info.html";
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
        info: resolve(root, "html/info.html")
      }
    }
  }
});
