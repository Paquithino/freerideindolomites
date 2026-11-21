/* =========================================================
   CREA PAGINE EN — costruisce html/en/{info,contatti,precipitazioni}.html
   dalle pagine italiane: testata, menu e piè di pagina tradotti col dizionario
   (js/lingua-en.js), il contenuto principale preso da html/en/parti/<nome>.html.
   Da rilanciare quando cambi la testata o il piè di pagina delle pagine italiane:
     node scripts/crea-pagine-en.mjs
   ========================================================= */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { impostaLingua, traduciHTML, url } from "../js/i18n.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RADICE = "https://paquithino.github.io/freerideindolomites/";
const PAGINE = [["info", "guida/"], ["contatti", "contatti/"], ["precipitazioni", "precipitazioni/"]];
impostaLingua("en");
const attr = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

for(const [nome, percorso] of PAGINE){
  const it = readFileSync(join(ROOT, "html", nome + ".html"), "utf8");
  const parte = readFileSync(join(ROOT, "html", "en", "parti", nome + ".html"), "utf8");
  const titolo = parte.match(/<!--title: ([\s\S]*?)-->/)[1], desc = parte.match(/<!--description: ([\s\S]*?)-->/)[1];
  const corpo = parte.replace(/<!--(title|description): [\s\S]*?-->\n?/g, "");
  const i = it.indexOf("</header>") + "</header>".length, j = it.indexOf("</main>") + "</main>".length;
  let h = traduciHTML(it.slice(0, i)) + "\n" + corpo.trim() + traduciHTML(it.slice(j));
  const en = RADICE + url(percorso, "en");
  h = h.replace('<html lang="it">', '<html lang="en">')
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${titolo}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(desc)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attr(titolo)}">`)
    .replace(/<meta property="og:locale" content="[^"]*">/, '<meta property="og:locale" content="en_GB">')
    .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${en}"`)
    .replace(/(["'(])\.\.\/(css|js|assets)\//g, "$1../../$2/")
    .replace(/<span>(\d+) spot<\/span>/g, "<span>$1 spots</span>")
    // link interni ancora in italiano → indirizzi inglesi
    .replace(/(<a\b[^>]*?\shref=")([^"]*)(")/g, (m, a, x, b) =>
      !x || /^(https?:|mailto:|#|\.\.\/|\/|en\/)/.test(x) || /\.(png|jpg|svg|json|xml|txt|webmanifest)$/.test(x) ? m : a + (url(x === "./" ? "" : x, "en") || "en/") + b);
  writeFileSync(join(ROOT, "html", "en", nome + ".html"), h.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n<!-- creata da scripts/crea-pagine-en.mjs: modifica html/en/parti/" + nome + ".html e rilancia lo script -->"));
  const resto = [...h.matchAll(/>([^<>]*[a-zà-ù]{3,}[^<>]*)</g)].map(m => m[1].trim()).filter(x => /\b(il|di|che|della|per|non|sono|gli|dei)\b/.test(x));
  console.log(`html/en/${nome}.html` + (resto.length ? `  · testi ancora in italiano: ${resto.length}\n   - ` + resto.slice(0, 8).join("\n   - ") : ""));
}
