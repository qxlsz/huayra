import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenCodeMock, OPENCODE_MOCK_PREFIX } from "../src/opencode-mock.js";
import { previewListen, safeDistFile } from "../src/preview.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const { host, port } = previewListen(process.argv);
const mock = createOpenCodeMock();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer((req, res) => {
  const url = req.url || "/";
  const pathOnly = url.split("?")[0] || "/";

  if (pathOnly === OPENCODE_MOCK_PREFIX || pathOnly.startsWith(OPENCODE_MOCK_PREFIX + "/")) {
    const sub =
      pathOnly === OPENCODE_MOCK_PREFIX
        ? "/"
        : pathOnly.slice(OPENCODE_MOCK_PREFIX.length) || "/";
    if (mock.handle(req, res, sub)) return;
    res.writeHead(404, {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  const file = safeDistFile(dist, url);
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
  process.stdout.write(`opencode mock  http://${host}:${port}${OPENCODE_MOCK_PREFIX}\n`);
});
