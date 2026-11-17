import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // percorsi relativi: il sito funziona anche in una sottocartella (es. GitHub Pages /nome-repo/)
  base: "./",
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
