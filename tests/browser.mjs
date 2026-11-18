/* Quale browser usare per i test.
   Su macOS 12 Playwright non può scaricare il suo Chromium: usiamo un browser già installato
   (Brave per primo, poi Chrome, Edge, Chromium). Su GitHub si usa quello di Playwright.
   Per forzarne uno: CHROME_PATH="/percorso/del/browser" npm test */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CANDIDATI = {
  darwin: ["Brave Browser.app/Contents/MacOS/Brave Browser", "Google Chrome.app/Contents/MacOS/Google Chrome",
           "Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "Chromium.app/Contents/MacOS/Chromium"]
    .flatMap(a => ["/Applications/" + a, join(homedir(), "Applications", a)]),
  linux: ["/usr/bin/brave-browser", "/usr/bin/brave", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  win32: ["C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"]
};

export function browserLocale(){
  if(process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if(process.env.CI) return null;                       // GitHub: Chromium di Playwright
  return (CANDIDATI[process.platform] || []).find(p => existsSync(p)) || null;
}

/* Safari (WebKit) solo dove Playwright lo supporta: su GitHub sempre, sul Mac solo se richiesto */
export const conSafari = () => !!process.env.CI || process.env.SAFARI === "1";

// npm run test:setup → dice quale browser verrà usato
if(import.meta.url === `file://${process.argv[1]}`){
  const b = browserLocale();
  if(b) console.log(`✓ I test useranno: ${b}`);
  else console.log("✗ Nessun browser trovato. Installa Brave o Chrome, oppure indica il percorso con CHROME_PATH.");
  console.log(conSafari() ? "✓ Test anche su Safari (WebKit)" : "· Safari (WebKit) saltato su questo computer: gira sui test di GitHub");
}
