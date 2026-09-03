import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, extname } from "node:path";

const ROOTS = ["src", "test", "scripts", "packaging"];
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

if (failed > 0) {
  process.exit(1);
}
