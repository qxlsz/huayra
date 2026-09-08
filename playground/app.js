(function () {
"use strict";
const SESSION_STORE_KEY = "huayra.playground.sessions.v1";
const logEl = document.getElementById("log");
const form = document.getElementById("prompt-form");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const stopBtn = document.getElementById("stop");
const opencodeDot = document.getElementById("opencode-dot");
const opencodeLabel = document.getElementById("opencode-label");
const providerDot = document.getElementById("provider-dot");
const providerLabel = document.getElementById("provider-label");
const agentDot = document.getElementById("agent-dot");
const agentLabel = document.getElementById("agent-label");
const modelDot = document.getElementById("model-dot");
const modelLabel = document.getElementById("model-label");
const thinkingDot = document.getElementById("thinking-dot");
const thinkingLabel = document.getElementById("thinking-label");
const gateDot = document.getElementById("gate-dot");
const gateLabel = document.getElementById("gate-label");
const sessionDot = document.getElementById("session-dot");
const sessionLabel = document.getElementById("session-label");
const sessionListEl = document.getElementById("session-list");
const sessionNewBtn = document.getElementById("session-new");
const sessionSyncBtn = document.getElementById("session-sync");
const sessionClearBtn = document.getElementById("session-clear");
const gateOverlay = document.getElementById("gate");
const phraseInput = document.getElementById("phrase");

const OPENCODE_STORE_KEY = "huayra.playground.opencodeUrl.v1";
function resolveOpenCodeUrl() {
  try {
    const q = new URLSearchParams(location.search).get("opencode");
    if (q && /^https?:\/\//i.test(q)) return q.replace(/\/$/, "");
  } catch {}
  try {
    const stored = localStorage.getItem(OPENCODE_STORE_KEY);
    if (stored && /^https?:\/\//i.test(stored)) return stored.replace(/\/$/, "");
  } catch {}
  return "http://127.0.0.1:4096";
}
function setOpenCodeUrl(url) {
  const cleaned = String(url || "").trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(cleaned)) return false;
  opencodeUrl = cleaned;
  try { localStorage.setItem(OPENCODE_STORE_KEY, cleaned); } catch {}
  return true;
}
let opencodeUrl = resolveOpenCodeUrl();
let opencodeReachable = false;
let provider = "none";
let probeTimer = null;
let abortCtrl = null;

function line(cls, text, opts) {
  if (!logEl) return;
  const persist = !opts || opts.persist !== false;
  const el = document.createElement("div");
  el.className = "line " + (cls || "");
  el.textContent = text;
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
  if (!persist) return;
  const s = sessions.find((x) => x.id === activeSessionId);
  if (s) {
    s.lines.push({ cls, text });
    persistSessions();
  }
}
function setOpenCodeStatus(kind, text) {
  opencodeDot.className = "dot" + (kind === "ok" ? " ok" : kind === "err" ? " err" : kind === "warn" ? " warn" : "");
  opencodeLabel.textContent = text;
}
function setModelStatus(name) {
  if (name) {
    modelDot.className = "dot ok";
    modelLabel.textContent = "model " + name;
  } else {
    modelDot.className = "dot";
    modelLabel.textContent = "model -";
  }
}
function setAgentStatus(name) {
  if (name) {
    agentDot.className = "dot ok";
    agentLabel.textContent = "agent " + name;
  } else {
    agentDot.className = "dot";
    agentLabel.textContent = "agent -";
  }
}
function setThinking(on) {
  if (on) {
    thinkingDot.className = "dot warn";
    thinkingLabel.textContent = "thinking";
    stopBtn.classList.add("visible");
    stopBtn.disabled = false;
    sendBtn.disabled = true;
  } else {
    thinkingDot.className = "dot";
    thinkingLabel.textContent = "thinking -";
    stopBtn.classList.remove("visible");
    stopBtn.disabled = true;
    sendBtn.disabled = false;
  }
}
function setProviderStatus(name) {
  if (name && name !== "none") {
    providerDot.className = "dot ok";
    providerLabel.textContent = "provider " + name;
  } else {
    providerDot.className = "dot";
    providerLabel.textContent = "provider -";
  }
}
function setSessionStatus(text) {
  sessionLabel.textContent = text || "session -";
  sessionDot.className = sessions.length ? "dot ok" : "dot";
}

let sessions = [];
let activeSessionId = null;

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSION_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s.id === "string");
  } catch {
    return [];
  }
}
function persistSessions() {
  try {
    localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(sessions));
  } catch {}
}
function renderSessionBar() {
  if (!sessionListEl) return;
  sessionListEl.innerHTML = "";
  sessions.forEach((s) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "session-chip" + (s.id === activeSessionId ? " active" : "");
    btn.textContent = s.title || s.id.slice(0, 8);
    btn.title = s.id;
    btn.addEventListener("click", () => {
      if (s.id === activeSessionId) return;
      switchSession(s.id);
    });
    btn.addEventListener("dblclick", () => {
      const next = window.prompt("Session title", s.title || "");
      if (next != null) {
        s.title = String(next).trim() || s.id.slice(0, 8);
        persistSessions();
        renderSessionBar();
      }
    });
    sessionListEl.appendChild(btn);
  });
  setSessionStatus(sessions.length ? sessions.length + " local" : "session -");
}
function ensureSession() {
  sessions = loadSessions();
  if (!sessions.length) {
    createSession("main");
  } else {
    if (!activeSessionId || !sessions.find((x) => x.id === activeSessionId)) {
      activeSessionId = sessions[0].id;
    }
    restoreActiveLog();
    renderSessionBar();
  }
}
function createSession(title) {
  const id = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const s = { id, title: title || id.slice(0, 8), lines: [], remoteSessionId: null };
  sessions.push(s);
  activeSessionId = id;
  persistSessions();
  if (logEl) logEl.innerHTML = "";
  renderSessionBar();
  return s;
}
function switchSession(id) {
  const s = sessions.find((x) => x.id === id);
  if (!s) return;
  activeSessionId = id;
  restoreActiveLog();
  renderSessionBar();
}
function restoreActiveLog() {
  if (!logEl) return;
  logEl.innerHTML = "";
  const s = sessions.find((x) => x.id === activeSessionId);
  if (!s) return;
  (s.lines || []).forEach((row) => {
    const el = document.createElement("div");
    el.className = "line " + (row.cls || "");
    el.textContent = row.text;
    logEl.appendChild(el);
  });
  logEl.scrollTop = logEl.scrollHeight;
}
function clearActiveSession() {
  const s = sessions.find((x) => x.id === activeSessionId);
  if (!s) return;
  s.lines = [];
  s.remoteSessionId = null;
  persistSessions();
  if (logEl) logEl.innerHTML = "";
  line("sys", "session cleared");
}

async function syncRemoteSessions() {
  if (!opencodeReachable) {
    line("sys", "OpenCode offline, cannot sync");
    return;
  }
  try {
    const res = await fetch(opencodeUrl + "/session", { mode: "cors" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.sessions || data.items || [];
    line("sys", "remote sessions: " + list.length, { persist: false });
  } catch (err) {
    line("err", "session sync failed: " + (err && err.message ? err.message : err));
  }
}

function sameOriginMockUrl() {
  try {
    return location.origin + "/__opencode";
  } catch {
    return null;
  }
}

async function tryAttachAt(base) {
  try {
    const res = await fetch(base + "/health", { mode: "cors", signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { ok: false };
    const data = await res.json().catch(() => ({}));
    return { ok: true, ver: data.version || data.service || "ok", data };
  } catch {
    return { ok: false };
  }
}

async function resolveAgentAndModel() {
  try {
    const res = await fetch(opencodeUrl + "/agent", { mode: "cors", signal: AbortSignal.timeout(2500) });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    const agent = data.name || data.agent || data.id || null;
    const model = data.model || data.modelId || null;
    if (agent) setAgentStatus(agent);
    if (model) setModelStatus(model);
    if (data.provider) {
      provider = String(data.provider);
      setProviderStatus(provider);
    }
  } catch {}
}

async function probeOpenCode(opts) {
  const quiet = opts && opts.quiet;
  const primary = await tryAttachAt(opencodeUrl);
  if (primary.ok) {
    opencodeReachable = true;
    setOpenCodeStatus("ok", "OpenCode " + (primary.ver || "up"));
    await resolveAgentAndModel();
    if (!quiet) {
      line("sys", "OpenCode attached at " + opencodeUrl + (primary.ver ? " · " + primary.ver : ""), { persist: false });
    }
    return true;
  }
  // offline, auto-attach the same-origin preview mock so npm run dev works
  const mockUrl = sameOriginMockUrl();
  if (mockUrl && mockUrl !== opencodeUrl) {
    const mock = await tryAttachAt(mockUrl);
    if (mock.ok) {
      opencodeUrl = mockUrl;
      opencodeReachable = true;
      const ver = mock.ver;
      setOpenCodeStatus("warn", "OpenCode mock " + (ver || "up"));
      await resolveAgentAndModel();
      if (!quiet) {
        line("sys", "OpenCode default offline; attached preview mock at " + opencodeUrl + (ver ? " · " + ver : ""), { persist: false });
      }
      return true;
    }
  }
  opencodeReachable = false;
  setOpenCodeStatus("err", "OpenCode offline");
  setAgentStatus(null);
  setModelStatus(null);
  setProviderStatus("none");
  if (!quiet) {
    const mockHint = sameOriginMockUrl();
    if (mockHint && opencodeUrl !== mockHint) {
      line("sys", "tip: shift+click OpenCode pill and set URL to " + mockHint + " for local mock", { persist: false });
    }
    line("sys", "OpenCode unreachable at " + opencodeUrl, { persist: false });
  }
  return false;
}

async function ensureRemoteSession() {
  const s = sessions.find((x) => x.id === activeSessionId);
  if (!s) return null;
  if (s.remoteSessionId) return s.remoteSessionId;
  try {
    const res = await fetch(opencodeUrl + "/session", {
      method: "POST",
      mode: "cors",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: s.title || s.id }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const rid = data.id || data.sessionId || data.session_id;
    if (!rid) throw new Error("no session id");
    s.remoteSessionId = rid;
    persistSessions();
    return rid;
  } catch (err) {
    line("err", "create session failed: " + (err && err.message ? err.message : err));
    return null;
  }
}

async function streamReply(rid, text) {
  abortCtrl = new AbortController();
  try {
    const res = await fetch(opencodeUrl + "/session/" + encodeURIComponent(rid) + "/message", {
      method: "POST",
      mode: "cors",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: text, role: "user" }),
      signal: abortCtrl.signal,
    });
    if (!res.ok) {
      line("err", "message failed: HTTP " + res.status);
      return false;
    }
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/event-stream") || ct.includes("stream")) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let got = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() || "";
        for (const p of parts) {
          const lineText = p.trim();
          if (!lineText || lineText.startsWith(":")) continue;
          let payload = lineText;
          if (lineText.startsWith("data:")) payload = lineText.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            const chunk =
              obj.content ||
              obj.text ||
              obj.delta ||
              (obj.message && (obj.message.content || obj.message.text)) ||
              null;
            if (chunk) {
              line("assistant", String(chunk));
              got = true;
            }
          } catch {
            if (payload) {
              line("assistant", payload);
              got = true;
            }
          }
        }
      }
      if (got) return true;
    } else {
      const data = await res.json().catch(() => null);
      if (data) {
        const reply =
          data.content ||
          data.text ||
          data.message ||
          (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
          JSON.stringify(data);
        line("assistant", String(reply));
        return true;
      }
    }
  } catch (err) {
    if (err && err.name === "AbortError") {
      line("sys", "aborted");
      return false;
    }
    line("err", "stream failed: " + (err && err.message ? err.message : err));
    return false;
  }
  line("err", "no reply from OpenCode (is serve reachable?)");
  return false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!gateConfig.unlocked) {
    line("sys", "gate locked");
    return;
  }
  const text = (promptEl.value || "").trim();
  if (!text) return;
  promptEl.value = "";
  line("user", text);
  if (!opencodeReachable) {
    line("sys", "OpenCode offline — start serve or set URL (shift+click OpenCode pill)");
    return;
  }
  setThinking(true);
  try {
    const rid = await ensureRemoteSession();
    if (!rid) {
      line("err", "could not create OpenCode session");
      return;
    }
    await streamReply(rid, text);
  } finally {
    setThinking(false);
    abortCtrl = null;
  }
});

// Enter sends, Shift+Enter inserts newline (textarea)
if (promptEl) {
  promptEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  });
}

function abortInFlight() {
  if (abortCtrl) abortCtrl.abort();
  const s = sessions.find((x) => x.id === activeSessionId);
  const rid = s?.remoteSessionId;
  if (rid && opencodeReachable) {
    fetch(opencodeUrl + "/session/" + encodeURIComponent(rid) + "/abort", {
      method: "POST",
      mode: "cors",
    }).catch(() => {});
  }
  setThinking(false);
}
stopBtn.addEventListener("click", () => abortInFlight());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (abortCtrl) {
      e.preventDefault();
      abortInFlight();
    }
  }
});

sessionNewBtn.addEventListener("click", () => {
  createSession(null);
  line("sys", "new session");
});
sessionSyncBtn.addEventListener("click", () => {
  syncRemoteSessions();
});
sessionClearBtn.addEventListener("click", () => clearActiveSession());

const opencodePill = document.getElementById("opencode-pill");
if (opencodePill) {
  opencodePill.addEventListener("click", (e) => {
    if (e.shiftKey) {
      const next = window.prompt("OpenCode base URL", opencodeUrl);
      if (next && setOpenCodeUrl(next)) {
        line("sys", "OpenCode URL set to " + opencodeUrl);
        probeOpenCode({ quiet: false });
      }
      return;
    }
    probeOpenCode({ quiet: false });
  });
}

const gateSkip = document.getElementById("gate-skip");
const gateUnlock = document.getElementById("gate-unlock");
const gateConfig = {
  requireGate: false,
  unlocked: true,
  gateHash: null,
};
(function initGateFromQuery() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("gate") === "1" || q.get("gate") === "true") gateConfig.requireGate = true;
    const h = q.get("gate_hash");
    if (h && /^[a-f0-9]{64}$/i.test(h)) {
      gateConfig.gateHash = h;
      gateConfig.requireGate = true;
    }
  } catch {}
})();

function setGateStatus(open) {
  gateConfig.unlocked = !!open;
  if (open) {
    gateOverlay.classList.remove("open");
    gateOverlay.setAttribute("aria-hidden", "true");
    gateDot.className = "dot ok";
    gateLabel.textContent = "gate open";
  } else {
    gateOverlay.classList.add("open");
    gateOverlay.setAttribute("aria-hidden", "false");
    gateDot.className = "dot warn";
    gateLabel.textContent = "gate locked";
  }
}
async function tryUnlockGate() {
  const phrase = (phraseInput && phraseInput.value) || "";
  if (gateConfig.gateHash) {
    try {
      const enc = new TextEncoder().encode(phrase);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (hex.toLowerCase() === gateConfig.gateHash.toLowerCase()) {
        setGateStatus(true);
        line("sys", "gate unlocked");
        return;
      }
    } catch {}
    line("err", "gate unlock failed");
    return;
  }
  setGateStatus(true);
  line("sys", "gate unlocked");
}
if (gateSkip) {
  gateSkip.addEventListener("click", () => {
    setGateStatus(true);
    line("sys", "gate skipped");
  });
}
if (gateUnlock) {
  gateUnlock.addEventListener("click", () => tryUnlockGate());
}
if (phraseInput) {
  phraseInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tryUnlockGate();
    }
  });
}

// Boot: paint sessions and status immediately, gate does not block first paint
ensureSession();
stopBtn.disabled = true;
if (gateConfig.requireGate) {
  setGateStatus(false);
  line("sys", "host gate required (?gate=1 or gate_hash)", { persist: false });
} else {
  setGateStatus(true);
}
line("sys", "Huayra playground · credit @zanneth · OpenCode target " + opencodeUrl, { persist: false });
probeOpenCode({ quiet: false });
try { promptEl.focus(); } catch {}

})();
