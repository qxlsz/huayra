/**
 * Same-origin preview proxy to a reachable OpenCode serve.
 * Browser attach often fails CORS against 127.0.0.1:4096; the preview
 * process can still reach it and stream SSE back on /__live.
 *
 * Health probes are answered locally with a short timeout so a dead
 * serve does not block first paint or the OpenCode attach hop.
 */

import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export const OPENCODE_LIVE_PREFIX = "/__live";
export const LIVE_PROBE_MS = 800;

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

export function probeLiveTarget(targetBase, timeoutMs = LIVE_PROBE_MS) {
  return new Promise((resolve) => {
    let dest;
    try {
      dest = new URL("/global/health", targetBase + "/");
    } catch {
      resolve({ ok: false, error: "bad live target", target: targetBase });
      return;
    }
    const lib = dest.protocol === "https:" ? httpsRequest : httpRequest;
    const req = lib(
      dest,
      {
        method: "GET",
        headers: { accept: "application/json" },
        timeout: timeoutMs,
      },
      (up) => {
        const chunks = [];
        up.on("data", (c) => chunks.push(c));
        up.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let data = {};
          try {
            data = JSON.parse(raw || "{}");
          } catch {
            data = {};
          }
          const healthy =
            up.statusCode === 200 &&
            (data.healthy === true || data.ok === true || Boolean(data.service) || Boolean(data.version));
          if (healthy) {
            resolve({
              ok: true,
              healthy: true,
              target: targetBase,
              version: data.version || null,
              service: data.service || "opencode",
            });
          } else {
            resolve({
              ok: false,
              error: "live OpenCode unhealthy",
              target: targetBase,
              status: up.statusCode,
            });
          }
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "live OpenCode timeout", target: targetBase });
    });
    req.on("error", () => {
      resolve({ ok: false, error: "live OpenCode unreachable", target: targetBase });
    });
    req.end();
  });
}

function writeJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function isLocalHealthPath(path) {
  return (
    path === "/global/health" ||
    path === "/health" ||
    path === "/status" ||
    path === "/" ||
    path === ""
  );
}

export function createOpenCodeLiveProxy(env = process.env) {
  const targetBase = liveTargetFromEnv(env);

  function handle(req, res, subPath) {
    const method = (req.method || "GET").toUpperCase();
    const pathOnly = (subPath || "/").split("?")[0] || "/";

    if (method === "GET" && isLocalHealthPath(pathOnly)) {
      probeLiveTarget(targetBase).then((probe) => {
        if (probe.ok) writeJson(res, 200, probe);
        else writeJson(res, 502, probe);
      });
      return true;
    }

    let dest;
    try {
      dest = new URL(
        (subPath || "/") + (req.url && req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""),
        targetBase + "/",
      );
    } catch {
      writeJson(res, 502, { error: "bad live target" });
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
      },
    );
    upstream.on("timeout", () => {
      upstream.destroy();
      if (!res.headersSent) {
        writeJson(res, 504, { error: "live OpenCode timeout" });
      } else {
        res.end();
      }
    });
    upstream.on("error", () => {
      if (!res.headersSent) {
        writeJson(res, 502, { error: "live OpenCode unreachable", target: targetBase });
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

  return { handle, targetBase, probe: () => probeLiveTarget(targetBase) };
}
