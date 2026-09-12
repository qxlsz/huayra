import { existsSync, statSync } from "node:fs";
import { normalize, relative, resolve } from "node:path";

export function parseFlag(argv, name, fallback) {
  const flag = `--${name}`;
  const index = argv.indexOf(flag);
  if (index === -1 || argv[index + 1] == null || argv[index + 1] === "") {
    return fallback;
  }
  return argv[index + 1];
}

export function previewListen(argv = process.argv) {
  return {
    host: parseFlag(argv, "host", "127.0.0.1"),
    port: Number(parseFlag(argv, "port", "8080")),
  };
}

export function safeDistFile(distRoot, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  } catch {
    return null;
  }
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const candidate = resolve(distRoot, rel);
  const inside = relative(distRoot, candidate);
  if (inside.startsWith("..") || normalize(inside).startsWith("..")) {
    return null;
  }
  return candidate;
}

function existingFile(path) {
  return Boolean(path && existsSync(path) && statSync(path).isFile());
}

/** Prefer dist, then playground so first paint works before `npm run build`. */
export function resolvePreviewFile(distRoot, playgroundRoot, urlPath) {
  const distFile = safeDistFile(distRoot, urlPath);
  if (existingFile(distFile)) return { root: distRoot, file: distFile };
  const playFile = safeDistFile(playgroundRoot, urlPath);
  if (existingFile(playFile)) return { root: playgroundRoot, file: playFile };
  return null;
}
