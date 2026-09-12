import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { hashPassphrase } from "../src/host-gate.js";
import { GATE_PATH, createHostGateHandler, gateRequiredFromEnv } from "../src/host-gate-http.js";

function listen(handler) {
  const server = createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];
    handler.handle(req, res, path);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

test("gate env only accepts a sha256 hex hash", () => {
  assert.equal(gateRequiredFromEnv({}), "");
  assert.equal(gateRequiredFromEnv({ HUAYRA_GATE_HASH: "short" }), "");
  const hash = hashPassphrase("secret");
  assert.equal(gateRequiredFromEnv({ HUAYRA_GATE_HASH: hash }), hash);
});

test("GET reports required without blocking static first paint", async () => {
  const hash = hashPassphrase("secret");
  const handler = createHostGateHandler({ HUAYRA_GATE_HASH: hash });
  const { server, port } = await listen(handler);
  try {
    const res = await fetch(`http://127.0.0.1:${port}${GATE_PATH}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.required, true);
    assert.equal(body.path, GATE_PATH);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("POST verifies the passphrase against the env hash", async () => {
  const hash = hashPassphrase("secret");
  const handler = createHostGateHandler({ HUAYRA_GATE_HASH: hash });
  const { server, port } = await listen(handler);
  try {
    const bad = await fetch(`http://127.0.0.1:${port}${GATE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrase: "nope" }),
    });
    assert.equal(bad.status, 401);
    const good = await fetch(`http://127.0.0.1:${port}${GATE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrase: "secret" }),
    });
    assert.equal(good.status, 200);
    assert.equal((await good.json()).ok, true);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("POST is a no-op unlock when no hash is configured", async () => {
  const handler = createHostGateHandler({});
  const { server, port } = await listen(handler);
  try {
    const res = await fetch(`http://127.0.0.1:${port}${GATE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrase: "anything" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.required, false);
    assert.equal(body.ok, true);
  } finally {
    server.close();
    await once(server, "close");
  }
});
