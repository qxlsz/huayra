import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { createOpenCodeLiveProxy, liveTargetFromEnv, OPENCODE_LIVE_PREFIX } from "../src/opencode-proxy.js";

test("liveTargetFromEnv defaults to local OpenCode serve", () => {
  assert.equal(liveTargetFromEnv({}), "http://127.0.0.1:4096");
  assert.equal(liveTargetFromEnv({ OPENCODE_URL: "http://127.0.0.1:4096/" }), "http://127.0.0.1:4096");
  assert.equal(OPENCODE_LIVE_PREFIX, "/__live");
});

test("live proxy forwards health and SSE from a reachable serve", async (t) => {
  const upstream = createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/global/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ healthy: true, version: "test-serve" }));
      return;
    }
    if (url.startsWith("/session/s1/prompt")) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write("event: part\ndata: {\"type\":\"text\",\"text\":\"hi\"}\n\n");
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  t.after(() => upstream.close());
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const port = upstream.address().port;

  const proxy = createOpenCodeLiveProxy({ OPENCODE_URL: `http://127.0.0.1:${port}` });
  const server = createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];
    const sub = path.slice(OPENCODE_LIVE_PREFIX.length) || "/";
    proxy.handle(req, res, sub);
  });
  t.after(() => server.close());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const p = server.address().port;

  const health = await fetch(`http://127.0.0.1:${p}${OPENCODE_LIVE_PREFIX}/global/health`);
  assert.equal(health.status, 200);
  const body = await health.json();
  assert.equal(body.healthy, true);

  const sse = await fetch(`http://127.0.0.1:${p}${OPENCODE_LIVE_PREFIX}/session/s1/prompt`, { method: "POST" });
  assert.equal(sse.status, 200);
  const text = await sse.text();
  assert.match(text, /\"text\":\"hi\"/);
});
