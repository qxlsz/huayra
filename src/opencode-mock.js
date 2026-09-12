/**
 * Minimal OpenCode-compatible mock for local preview attach testing.
 * Not a full server; only the routes the playground probes and uses.
 */

import { randomBytes } from "node:crypto";

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, accept",
  });
  res.end(payload);
}

function corsPreflight(res) {
  res.writeHead(204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, accept",
    "access-control-max-age": "86400",
  });
  res.end();
}

function id() {
  return "sess_" + randomBytes(6).toString("hex");
}

export function createOpenCodeMock() {
  /** @type {Map<string, { id: string, title: string, messages: Array<{role:string,text:string}> }>} */
  const sessions = new Map();
  const seedId = "sess_index_seed";
  sessions.set(seedId, {
    id: seedId,
    title: "index seed",
    messages: [
      { role: "user", text: "list sessions" },
      { role: "assistant", text: "mock reply: session index is live" },
    ],
  });

  const agents = [
    { id: "build", name: "build", model: "mock-model" },
    { id: "plan", name: "plan", model: "mock-model" },
    { id: "explore", name: "explore", model: "mock-small" },
  ];
  const models = [
    { id: "mock-model", object: "model", owned_by: "huayra-mock" },
    { id: "mock-small", object: "model", owned_by: "huayra-mock" },
  ];
  const current = { agent: "build", model: "mock-model", thinking: "idle" };

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @param {string} path pathname under the mock mount (no query), e.g. "/global/health"
   * @returns {boolean} true if handled
   */
  function handle(req, res, path) {
    const method = (req.method || "GET").toUpperCase();
    if (method === "OPTIONS") {
      corsPreflight(res);
      return true;
    }

    if ((path === "/global/health" || path === "/health") && method === "GET") {
      json(res, 200, { healthy: true, ok: true, version: "mock-1.0.0" });
      return true;
    }

    if ((path === "/" || path === "") && method === "GET") {
      json(res, 200, { ok: true, service: "opencode-mock" });
      return true;
    }

    if (path === "/v1/models" && method === "GET") {
      json(res, 200, { data: models });
      return true;
    }

    if (path === "/agent" && method === "GET") {
      json(res, 200, {
        name: current.agent,
        id: current.agent,
        model: current.model,
        provider: "opencode-mock",
        agents,
      });
      return true;
    }

    if (path === "/agent" && method === "POST") {
      let body = "";
      req.on("data", (c) => {
        body += c;
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          if (parsed.agent || parsed.name || parsed.id) {
            current.agent = String(parsed.agent || parsed.name || parsed.id);
          }
          if (parsed.model) current.model = String(parsed.model);
          if (parsed.thinking) current.thinking = String(parsed.thinking);
        } catch {}
        json(res, 200, {
          name: current.agent,
          id: current.agent,
          model: current.model,
          provider: "opencode-mock",
          agents,
        });
      });
      return true;
    }

    if (path === "/session" && method === "GET") {
      const list = [...sessions.values()].map((s) => ({ id: s.id, title: s.title }));
      json(res, 200, list);
      return true;
    }

    if (path === "/session" && method === "POST") {
      let body = "";
      req.on("data", (c) => {
        body += c;
      });
      req.on("end", () => {
        let title = "huayra";
        try {
          const parsed = JSON.parse(body || "{}");
          if (parsed?.title) title = String(parsed.title);
        } catch {}
        const sid = id();
        sessions.set(sid, { id: sid, title, messages: [] });
        json(res, 200, { id: sid, title });
      });
      return true;
    }

    const msgMatch = path.match(/^\/session\/([^/]+)\/message$/);
    if (msgMatch && method === "GET") {
      const s = sessions.get(decodeURIComponent(msgMatch[1]));
      if (!s) {
        json(res, 404, { error: "session not found" });
        return true;
      }
      json(
        res,
        200,
        s.messages.map((m) => ({
          role: m.role,
          parts: [{ type: "text", text: m.text }],
        })),
      );
      return true;
    }

    const promptMatch = path.match(/^\/session\/([^/]+)\/prompt$/);
    const messagePostMatch = path.match(/^\/session\/([^/]+)\/message$/);
    if ((promptMatch || messagePostMatch) && method === "POST") {
      const sid = decodeURIComponent((promptMatch || messagePostMatch)[1]);
      let s = sessions.get(sid);
      if (!s) {
        s = { id: sid, title: "huayra", messages: [] };
        sessions.set(sid, s);
      }
      let body = "";
      req.on("data", (c) => {
        body += c;
      });
      req.on("end", () => {
        let userText = "";
        try {
          const parsed = JSON.parse(body || "{}");
          if (Array.isArray(parsed?.parts)) {
            userText = parsed.parts.map((p) => p?.text || "").filter(Boolean).join("\n");
          } else if (typeof parsed?.content === "string") {
            userText = parsed.content;
          } else if (typeof parsed?.text === "string") {
            userText = parsed.text;
          }
          if (parsed.agent) current.agent = String(parsed.agent);
          if (parsed.model) current.model = String(parsed.model);
          if (parsed.thinking) current.thinking = String(parsed.thinking);
        } catch {}
        userText = String(userText || "").trim() || "(empty)";
        s.messages.push({ role: "user", text: userText });
        const snippet = userText.slice(0, 200);
        const reply = `mock reply [${current.agent}/${current.model}]: ${snippet}`;
        s.messages.push({ role: "assistant", text: reply });

        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "access-control-allow-origin": "*",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        const tokens = ["mock reply: ", ...snippet.split(/(\s+)/).filter((t) => t.length > 0)];
        for (const token of tokens) {
          res.write(`data: ${JSON.stringify({ text: token })}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
      });
      return true;
    }

    const abortMatch = path.match(/^\/session\/([^/]+)\/abort$/);
    if (abortMatch && method === "POST") {
      json(res, 200, { ok: true });
      return true;
    }

    const sessionOne = path.match(/^\/session\/([^/]+)$/);
    if (sessionOne && method === "DELETE") {
      const sid = decodeURIComponent(sessionOne[1]);
      const existed = sessions.delete(sid);
      json(res, existed ? 200 : 404, existed ? { ok: true, id: sid } : { error: "session not found" });
      return true;
    }

    return false;
  }

  return { handle, sessions, current, agents, models };
}

/** Mount path prefix used by preview (no trailing slash). */
export const OPENCODE_MOCK_PREFIX = "/__opencode";
