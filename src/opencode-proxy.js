/**
 * Same-origin preview proxy to a reachable OpenCode serve.
 * Browser attach often fails CORS against 127.0.0.1:4096; the preview
 * process can still reach it and stream SSE back on /__live.
 */

import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export const OPENCODE_LIVE_PREFIX = "/__live";

export function liveTargetFromEnv(env = process.env) {
  const raw = typeof env.OPENCODE_URL === "string" ? env.OPENCODE_URL.trim() : "";
  if (raw) return raw.replace(/\/+$/, "");
  return "http://127.0.0.1:4096";
}

function hopHeaders(req) {
  const headers = {};
  const skip = new Set(["host", "connection", "content-length", "transfer-encoding"]);
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (!key || skip.has(key.toLowerCase())) continue;
    headers[key] = value;
  }
  if (!headers.accept) headers.accept = "application/json, text/event-stream, */*";
  return headers;
}

export function createOpenCodeLiveProxy(env = process.env) {
  const targetBase = liveTargetFromEnv(env);

  function handle(req, res, subPath) {
    let dest;
    try {
      dest = new URL((subPath || "/") + (req.url && req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""), targetBase + "/");
    } catch {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "bad live target" }));
      return true;
    }
    const lib = dest.protocol === "https:" ? httpsRequest : httpRequest;
    const upstream = lib(
      dest,
      {
        method: req.method || "GET",
        headers: hopHeaders(req),
        timeout: 30000,
      },
      (up) => {
        const headers = {
          "access-control-allow-origin": "*",
          "cache-control": up.headers["cache-control"] || "no-store",
        };
        const ct = up.headers["content-type"];
        if (ct) headers["content-type"] = ct;
        res.writeHead(up.statusCode || 502, headers);
        up.pipe(res);
      }
    );
    upstream.on("timeout", () => {
      upstream.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "live OpenCode timeout" }));
      } else {
        res.end();
      }
    });
    upstream.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "live OpenCode unreachable", target: targetBase }));
      } else {
        res.end();
      }
    });
    if (req.method === "GET" || req.method === "HEAD" || req.method === "DELETE") {
      upstream.end();
    } else {
      req.pipe(upstream);
    }
    return true;
  }

  return { handle, targetBase };
}
