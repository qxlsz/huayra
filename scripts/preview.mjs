import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

function arg(name, fallback) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1 || !process.argv[index + 1]) {
    return fallback;
  }
  return process.argv[index + 1];
}

const host = arg("host", "127.0.0.1");
const port = Number(arg("port", "8080"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function safeFile(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const candidate = resolve(dist, rel);
  const inside = relative(dist, candidate);
  if (inside.startsWith("..") || normalize(inside).startsWith("..")) {
    return null;
  }
  return candidate;
}

const server = createServer((req, res) => {
  const file = safeFile(req.url);
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found\n");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  process.stdout.write(`huayra preview http://${host}:${port}\n`);
});
