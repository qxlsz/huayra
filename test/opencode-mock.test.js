import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createOpenCodeMock, OPENCODE_MOCK_PREFIX } from "../src/opencode-mock.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("opencode mock health and agent routes", async () => {
  const mock = createOpenCodeMock();
  const req = { method: "GET", on() {} };
  const chunks = [];
  const res = {
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      chunks.push(body);
    },
  };
  assert.equal(mock.handle(req, res, "/global/health"), true);
  assert.equal(res.status, 200);
  const body = JSON.parse(chunks.join(""));
  assert.equal(body.healthy, true);
  assert.equal(body.ok, true);
  assert.match(body.version, /^mock-/);

  const chunks2 = [];
  const res2 = {
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      chunks2.push(body);
    },
  };
  assert.equal(mock.handle({ method: "GET", on() {} }, res2, "/agent"), true);
  const agent = JSON.parse(chunks2.join(""));
  assert.equal(agent.name, "build");

  const chunks3 = [];
  const res3 = {
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      chunks3.push(body);
    },
  };
  assert.equal(mock.handle({ method: "GET", on() {} }, res3, "/session"), true);
  const list = JSON.parse(chunks3.join(""));
  assert.equal(Array.isArray(list), true);
  assert.equal(list[0].id, "sess_index_seed");
  assert.equal(list[0].title, "index seed");

  const chunks4 = [];
  const res4 = {
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      chunks4.push(body);
    },
  };
  assert.equal(mock.handle({ method: "POST", on() {} }, res4, "/session/sess_index_seed/abort"), true);
  assert.equal(res4.status, 200);
  assert.equal(JSON.parse(chunks4.join("")).ok, true);
});

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
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("preview startup timeout")), Math.max(0, deadline - Date.now())),
      ),
    ]);
    buf += chunk.toString();
    if (buf.includes(needle)) return buf;
  }
  throw new Error("preview startup timeout");
}

test("preview mounts OpenCode mock under /__opencode", async (t) => {
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

  const health = await fetch(`http://127.0.0.1:${port}${OPENCODE_MOCK_PREFIX}/global/health`);
  assert.equal(health.status, 200);
  const h = await health.json();
  assert.equal(h.ok, true);

  const models = await fetch(`http://127.0.0.1:${port}${OPENCODE_MOCK_PREFIX}/v1/models`);
  assert.equal(models.status, 200);
  const m = await models.json();
  assert.ok(Array.isArray(m.data) && m.data.length);

  const create = await fetch(`http://127.0.0.1:${port}${OPENCODE_MOCK_PREFIX}/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "t" }),
  });
  assert.equal(create.status, 200);
  const sess = await create.json();
  assert.ok(sess.id);

  const prompt = await fetch(
    `http://127.0.0.1:${port}${OPENCODE_MOCK_PREFIX}/session/${encodeURIComponent(sess.id)}/prompt`,
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ parts: [{ type: "text", text: "hello mock" }] }),
    },
  );
  assert.equal(prompt.status, 200);
  const streamText = await prompt.text();
  assert.match(streamText, /mock reply/);
  const joined = streamText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("data:") && !l.includes("[DONE]"))
    .map((l) => {
      try {
        return JSON.parse(l.slice(5).trim()).text || "";
      } catch {
        return "";
      }
    })
    .join("");
  assert.match(joined, /hello mock/);
  assert.ok((streamText.match(/^data:/gm) || []).length >= 3, "expected multi-chunk SSE");
});
