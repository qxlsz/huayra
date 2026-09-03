import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on("error", reject);
  });
}

async function waitForOutput(child, needle, timeoutMs = 5000) {
  let buf = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [chunk] = await Promise.race([
      once(child.stdout, "data"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("preview startup timeout")), deadline - Date.now())),
    ]);
    buf += chunk.toString();
    if (buf.includes(needle)) {
      return buf;
    }
  }
  throw new Error("preview startup timeout");
}

test("preview serves the playground and blocks path traversal", async (t) => {
  const build = spawn(process.execPath, ["scripts/build.mjs"], { cwd: root, stdio: "inherit" });
  const [buildCode] = await once(build, "exit");
  assert.equal(buildCode, 0);

  const port = await freePort();
  const preview = spawn(process.execPath, ["scripts/preview.mjs", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    preview.kill("SIGTERM");
  });
  await waitForOutput(preview, `http://127.0.0.1:${port}`);

  const page = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Huayra playground/);

  const missing = await fetch(`http://127.0.0.1:${port}/nope.html`);
  assert.equal(missing.status, 404);

  const traversal = await fetch(`http://127.0.0.1:${port}/../package.json`);
  assert.equal(traversal.status, 404);

  const encoded = await fetch(`http://127.0.0.1:${port}/%2e%2e/package.json`);
  assert.equal(encoded.status, 404);
});
