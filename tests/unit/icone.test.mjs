import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

/* misura di un PNG o JPEG letta dall'intestazione del file */
function misura(f){
  const b = readFileSync(f);
  if(b.toString("ascii", 1, 4) === "PNG") return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for(let i = 2; i < b.length;){
    const m = b[i + 1], l = b.readUInt16BE(i + 2);
    if(m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + l;
  }
  return null;
}

test("icone nuove: esistono e hanno la misura giusta", () => {
  for(const [f, w] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512], ["favicon-32.png", 32]]){
    assert.ok(existsSync("public/" + f), f);
    assert.deepEqual(misura("public/" + f), [w, w], f);
  }
  assert.equal(existsSync("public/icon.svg"), false, "l'icona vecchia non deve tornare");
});

test("manifest: punta solo a icone che esistono", () => {
  const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  assert.ok(m.icons.length >= 2);
  for(const i of m.icons){
    assert.ok(existsSync("public/" + i.src), i.src);
    assert.deepEqual(misura("public/" + i.src).join("x"), i.sizes);
  }
});

test("ogni pagina usa le icone nuove e la copertina con la versione per telefono", () => {
  for(const f of ["index.html", "html/info.html", "html/precipitazioni.html", "html/contatti.html"]){
    const h = readFileSync(f, "utf8");
    assert.match(h, /rel="apple-touch-icon" href="apple-touch-icon\.png"/, f);
    assert.match(h, /rel="icon" href="favicon-32\.png"/, f);
    assert.doesNotMatch(h, /icon\.svg|background-image:url\('copertina/, f);
  }
  for(const f of ["html/info.html", "html/contatti.html"]) assert.match(readFileSync(f, "utf8"), /<source media="\(max-width:699px\)" srcset="copertina-mobile\.jpg">/);
  const [w, h] = misura("public/copertina-mobile.jpg");
  assert.ok(h > w * 0.8, "la copertina del telefono è quasi quadrata");
});
