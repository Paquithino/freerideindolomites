/* Server statico minimo per i test (nessuna dipendenza): serve il progetto come fa "npm run dev".
   Prima la cartella del progetto, poi public/ (come Vite). Porta: PORT o 4317. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TIPI = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon"};
const PORT = +process.env.PORT || 4317;

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if(p.endsWith("/")) p += "index.html";
  p = normalize(p).replace(/^(\.\.[/\\])+/, "");
  for(const base of [ROOT, resolve(ROOT, "public")]){
    const f = resolve(base, "." + p);
    if(!f.startsWith(ROOT)) break;
    try{
      if(!(await stat(f)).isFile()) continue;
      res.writeHead(200, {"Content-Type": TIPI[extname(f)] || "application/octet-stream", "Cache-Control": "no-store"});
      return res.end(await readFile(f));
    }catch(e){}
  }
  res.writeHead(404); res.end("non trovato");
}).listen(PORT, () => console.log(`server di test su http://localhost:${PORT}`));
