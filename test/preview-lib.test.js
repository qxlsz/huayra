import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseFlag, previewListen, safeDistFile } from "../src/preview.js";

test("preview listen flags default to the Docker host port", () => {
  assert.deepEqual(previewListen(["node", "preview.mjs"]), { host: "127.0.0.1", port: 8080 });
  assert.deepEqual(previewListen(["node", "preview.mjs", "--host", "0.0.0.0", "--port", "8080"]), {
    host: "0.0.0.0",
    port: 8080,
  });
  assert.equal(parseFlag(["--host"], "host", "127.0.0.1"), "127.0.0.1");
  assert.equal(parseFlag(["--port", ""], "port", "8080"), "8080");
});

test("safeDistFile serves index and blocks traversal", () => {
  const dist = mkdtempSync(join(tmpdir(), "huayra-dist-"));
  writeFileSync(join(dist, "index.html"), "<html>ok</html>");

  assert.equal(safeDistFile(dist, "/"), join(dist, "index.html"));
  assert.equal(safeDistFile(dist, "/index.html?cache=1"), join(dist, "index.html"));
  assert.equal(safeDistFile(dist, "/../package.json"), null);
  assert.equal(safeDistFile(dist, "/%2e%2e/package.json"), null);
  assert.equal(safeDistFile(dist, "/%"), null);
});
