import { verifyPassphrase } from "./host-gate.js";

export const GATE_PATH = "/__gate";

export function gateRequiredFromEnv(env = process.env) {
  const hash = typeof env.HUAYRA_GATE_HASH === "string" ? env.HUAYRA_GATE_HASH.trim().toLowerCase() : "";
  if (/^[0-9a-f]{64}$/.test(hash)) return hash;
  return "";
}

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 4096) {
        resolve("");
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", () => resolve(""));
  });
}

/**
 * Host-gate HTTP handler. Static files are served first; this never wraps
 * the playground HTML. Call after first paint from the client.
 */
export function createHostGateHandler(env = process.env) {
  const hash = gateRequiredFromEnv(env);

  async function handle(req, res, path) {
    if (path !== GATE_PATH && path !== GATE_PATH + "/") return false;
    const method = (req.method || "GET").toUpperCase();
    if (method === "OPTIONS") {
      res.writeHead(204, { allow: "GET, POST, OPTIONS" });
      res.end();
      return true;
    }
    if (method === "GET") {
      json(res, 200, { required: Boolean(hash), path: GATE_PATH });
      return true;
    }
    if (method === "POST") {
      if (!hash) {
        json(res, 200, { ok: true, required: false });
        return true;
      }
      const raw = await readBody(req);
      let phrase = "";
      try {
        const parsed = JSON.parse(raw || "{}");
        phrase = typeof parsed.phrase === "string" ? parsed.phrase : "";
      } catch {
        phrase = "";
      }
      const ok = verifyPassphrase(phrase, hash);
      json(res, ok ? 200 : 401, { ok, required: true });
      return true;
    }
    json(res, 405, { error: "method not allowed" });
    return true;
  }

  return { handle, required: Boolean(hash), hash };
}
