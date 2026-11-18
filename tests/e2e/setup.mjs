/* Prima dei test nel browser: genera un file dati dimostrativo fresco (come quello del robot) */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export default function setup(){
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const tmp = resolve(root, "tests/.tmp");
  mkdirSync(tmp, {recursive: true});
  execFileSync(process.execPath, ["scripts/aggiorna-dati.mjs", "--demo"], {cwd: root, stdio: "ignore",
    env: {...process.env, OUT_FILE: resolve(tmp, "ultimo.json"), ARCHIVIO_DIR: resolve(tmp, "archivio")}});
}
