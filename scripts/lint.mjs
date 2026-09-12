import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, extname } from "node:path";

const ROOTS = ["src", "test", "scripts", "packaging", "playground"];
const SKIP_DIRS = new Set(["node_modules", "dist"]);

async function collect(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        await collect(path, acc);
      }
      continue;
    }
    if (extname(entry.name) === ".js" || extname(entry.name) === ".mjs") {
      acc.push(path);
    }
  }
  return acc;
}

const files = [];
for (const root of ROOTS) {
  await collect(root, files);
}

let failed = 0;
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed += 1;
    process.stderr.write(result.stderr || `syntax error: ${file}\n`);
  }
}

const consoleSrc = await readFile(join("playground", "app.js"), "utf8");
 if (consoleSrc.includes("DecompressionStream") || consoleSrc.includes("(0, eval)")) {
  failed += 1;
  process.stderr.write("playground/app.js must stay plain JS (no gzip eval loader)\n");
}
if (!consoleSrc.includes("function probeOpenCode") || !consoleSrc.includes("SESSION_STORE_KEY")) {
  failed += 1;
  process.stderr.write("playground/app.js is truncated; expected a full prompt console\n");
}
const mascotSrc = await readFile(join("scripts", "mascot-gifs.mjs"), "utf8");
if (!mascotSrc.includes("guardian-busy.gif") || !mascotSrc.includes("writeMascotGifs")) {
  failed += 1;
  process.stderr.write("scripts/mascot-gifs.mjs missing Guardian/Templar GIF payload\n");
}
const playgroundHtml = await readFile(join("playground", "index.html"), "utf8");
if (!playgroundHtml.includes("./assets/guardian.gif") || !playgroundHtml.includes("./assets/templar.gif")) {
  failed += 1;
  process.stderr.write("playground/index.html must reference Guardian/Templar GIFs\n");
}
if (!consoleSrc.includes("function paintMascots") || !consoleSrc.includes("mascotSrc")) {
  failed += 1;
  process.stderr.write("playground/app.js missing mascot GIF idle/busy swap\n");
}
if (!consoleSrc.includes("function abortRemote") || !consoleSrc.includes("/abort")) {
  failed += 1;
  process.stderr.write("playground/app.js missing OpenCode session abort\n");
}
if (!consoleSrc.includes("function closeActiveSession") || !consoleSrc.includes("deleteRemoteSession")) {
  failed += 1;
  process.stderr.write("playground/app.js missing session index close\n");
}
const syncSrc = await readFile(join("playground", "session-sync.js"), "utf8");
if (!syncSrc.includes("renameRemoteSession") || !consoleSrc.includes("renameRemoteSession")) {
  failed += 1;
  process.stderr.write("session index missing remote rename (PATCH title)\n");
}

if (failed > 0) {
  process.exit(1);
}
