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

function line(cls, text) {
  if (!logEl) return;
  const el = document.createElement("div");
  el.className = "line " + (cls || "");
  el.textContent = text;
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
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
    thinkingLabel.textContent = "thinking idle";
    stopBtn.classList.remove("visible");
    stopBtn.disabled = true;
    sendBtn.disabled = false;
  }
}
let sessions = [];
let activeSessionId = null;
function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSION_STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.sessions)) return null;
    return data;
  } catch {
    return null;
  }
}
function persistSessions() {
  try {
    localStorage.setItem(SESSION_STORE_KEY, JSON.stringify({ sessions, activeSessionId }));
  } catch {}
}
function ensureSession() {
  const data = loadSessions();
  if (data && data.sessions.length) {
    sessions = data.sessions;
    activeSessionId = data.activeSessionId || sessions[0].id;
  } else {
    createSession("session 1");
  }
  renderSessionBar();
  renderActiveLines();
}
function renderActiveLines() {
  logEl.replaceChildren();
  const s = sessions.find((x) => x.id === activeSessionId);
  if (!s) return;
  for (const L of s.lines || []) {
    const el = document.createElement("div");
    el.className = "line " + (L.cls || "");
    el.textContent = L.text;
    logEl.appendChild(el);
  }
  logEl.scrollTop = logEl.scrollHeight;
}
function renameSession(id) {
  const s = sessions.find((x) => x.id === id);
  if (!s) return;
  const current = s.title || "";
  const next = window.prompt("Rename session", current);
  if (next == null) return;
  const cleaned = String(next).trim();
  s.title = cleaned || null;
  persistSessions();
  renderSessionBar();
}
function renderSessionBar() {
  sessionListEl.replaceChildren();
  sessions.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "session-chip";
    btn.textContent = s.title || ("session " + (i + 1));
    btn.title = "click to switch · double-click to rename";
    if (s.id === activeSessionId) btn.classList.add("active");
    btn.addEventListener("click", () => switchSession(s.id));
    btn.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      renameSession(s.id);
    });
    sessionListEl.appendChild(btn);
  });
  const idx = sessions.findIndex((s) => s.id === activeSessionId);
  sessionLabel.textContent = "session " + (idx >= 0 ? idx + 1 : "?") + "/" + sessions.length;
  sessionDot.className = "dot ok";
}
function createSession(title) {
  const id = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const s = { id, title: title || null, lines: [], remoteSessionId: null };
  sessions.push(s);
  activeSessionId = id;
  persistSessions();
  renderSessionBar();
  renderActiveLines();
  return s;
}
function switchSession(id) {
  if (id === activeSessionId) return;
  activeSessionId = id;
  persistSessions();
  renderSessionBar();
  renderActiveLines();
}
function clearActiveSession() {
  const s = sessions.find((x) => x.id === activeSessionId);
  if (!s) return;
  s.lines = [];
  s.remoteSessionId = null;
  persistSessions();
  renderActiveLines();
  line("sys", "session cleared");
}
async function syncRemoteSessions() {
  if (!opencodeReachable || !window.HuayraSessionSync) {
    line("sys", "OpenCode offline; cannot sync remote sessions");
    return;
  }
  line("sys", "syncing remote sessions…");
  try {
    const remote = await window.HuayraSessionSync.listRemoteSessions(opencodeUrl, fetchWithTimeout);
    if (!remote || !remote.length) {
      line("sys", "no remote sessions");
      return;
    }
    let imported = 0;
    for (const r of remote) {
      if (sessions.some((s) => s.remoteSessionId === r.id)) continue;
      const title = r.title || ("remote " + String(r.id).slice(0, 8));
      const s = createSession(title);
      s.remoteSessionId = r.id;
      const msgs = await window.HuayraSessionSync.fetchRemoteMessages(opencodeUrl, r.id, fetchWithTimeout);
      for (const m of msgs) s.lines.push(m);
      imported++;
    }
    persistSessions();
    renderSessionBar();
    renderActiveLines();
    line("sys", "synced " + imported + " remote session(s)");
  } catch (e) {
    line("err", "sync failed: " + (e && e.message ? e.message : e));
  }
}

const gateConfig = (function () {
  const params = new URLSearchParams(location.search);
  const requireGate = params.get("gate") === "1" || !!params.get("gate_hash");
  const gateHash = params.get("gate_hash") || null;
  return { requireGate, gateHash, unlocked: !requireGate };
})();

async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
async function resolveOpenCodeModel() {
  try {
    const res = await fetchWithTimeout(opencodeUrl + "/v1/models", { method: "GET", mode: "cors" }, 1500);
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data?.data || data?.models || []);
    if (!Array.isArray(list) || !list.length) return null;
    const m = list[0];
    return m?.id || m?.name || m?.model || null;
  } catch {
    return null;
  }
}
async function resolveOpenCodeAgent() {
  try {
    const res = await fetchWithTimeout(opencodeUrl + "/agent", { method: "GET", mode: "cors" }, 1500);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data === "string") return data;
    if (Array.isArray(data) && data.length) {
      const a = data[0];
      return a?.name || a?.id || a?.agent || null;
    }
    return data?.name || data?.id || data?.agent || data?.default || null;
  } catch {
    return null;
  }
}
function startProbeTimer() {
  if (probeTimer != null) { clearInterval(probeTimer); probeTimer = null; }
  probeTimer = setInterval(() => {
    if (!opencodeReachable) probeOpenCode({ quiet: true });
  }, 8000);
}
async function countRemoteSessions() {
  try {
    const res = await fetchWithTimeout(opencodeUrl + "/session", { method: "GET", mode: "cors" }, 1200);
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data?.sessions || data?.data || []);
    return Array.isArray(list) ? list.length : null;
  } catch {
    return null;
  }
}
async function probeOpenCode(opts = {}) {
  const quiet = !!opts.quiet;
  let ver = null;
  let attached = false;

  // Prefer /global/health, then /health, then root.
  for (const path of ["/global/health", "/health"]) {
    if (attached) break;
    try {
      const health = await fetchWithTimeout(opencodeUrl + path, { method: "GET", mode: "cors" }, 1200);
      if (health.ok) {
        const body = await health.json().catch(() => null);
        ver = body?.version || body?.ver || null;
        attached = true;
      }
    } catch {}
  }

  if (!attached) {
    try {
      const res = await fetchWithTimeout(opencodeUrl + "/", { method: "GET", mode: "cors" }, 1200);
      if (res.ok) attached = true;
    } catch {}
  }

  if (!attached) {
    opencodeReachable = false;
    provider = "none";
    providerDot.className = "dot";
    providerLabel.textContent = "provider none";
    setModelStatus(null);
    setAgentStatus(null);
    setOpenCodeStatus("err", "OpenCode offline");
    if (!quiet) {
      line("sys", "OpenCode not reachable at " + opencodeUrl);
      try {
        const mockHint = location.origin + "/__opencode";
        if (opencodeUrl !== mockHint) {
          line("sys", "tip: shift+click OpenCode pill and set URL to " + mockHint + " for local mock");
        }
      } catch {}
    }
    startProbeTimer();
    return false;
  }

  const model = await resolveOpenCodeModel();
  const agentName = await resolveOpenCodeAgent();
  const remoteCount = await countRemoteSessions();
  opencodeReachable = true;
  provider = "opencode";
  providerDot.className = "dot ok";
  providerLabel.textContent = "provider opencode";
  setModelStatus(model);
  setAgentStatus(agentName);
  const verBit = ver ? ` v${ver}` : "";
  const remoteBit = remoteCount != null ? ` · ${remoteCount} remote` : "";
  const agentBit = agentName ? ` · agent ${agentName}` : "";
  setOpenCodeStatus("ok", "OpenCode" + verBit);
  if (!quiet) line("sys", `attached OpenCode at ${opencodeUrl}` + verBit + (model ? ` · ${model}` : "") + agentBit + remoteBit);
  else line("sys", `OpenCode became reachable · ${opencodeUrl}` + verBit + (model ? ` · ${model}` : "") + agentBit + remoteBit);
  startProbeTimer();
  return true;
}

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
  const phrase = (phraseInput?.value || "").trim();
  if (!phrase) return;
  if (gateConfig.gateHash) {
    try {
      const enc = new TextEncoder().encode(phrase);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

async function ensureRemoteSession() {
  const s = sessions.find((x) => x.id === activeSessionId);
  if (!s) return null;
  if (s.remoteSessionId) return s.remoteSessionId;
  try {
    const res = await fetch(opencodeUrl + "/session", {
      method: "POST",
      mode: "cors",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: s.title || "huayra" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rid = data?.id || data?.sessionID || data?.sessionId || null;
    if (rid) {
      s.remoteSessionId = rid;
      persistSessions();
    }
    return rid;
  } catch {
    return null;
  }
}

async function streamReply(rid, text) {
  const attempts = [
    {
      url: opencodeUrl + "/session/" + encodeURIComponent(rid) + "/prompt",
      body: JSON.stringify({ parts: [{ type: "text", text }] }),
    },
    {
      url: opencodeUrl + "/session/" + encodeURIComponent(rid) + "/message",
      body: JSON.stringify({ role: "user", content: text }),
    },
  ];
  for (const a of attempts) {
    try {
      abortCtrl = new AbortController();
      const res = await fetch(a.url, {
        method: "POST",
        mode: "cors",
        headers: { "content-type": "application/json", accept: "text/event-stream, application/json, text/plain" },
        body: a.body,
        signal: abortCtrl.signal,
      });
      if (!res.ok) continue;
      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      if (ctype.includes("event-stream") || ctype.includes("ndjson") || ctype.includes("stream")) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let ass = "";
        const assEl = document.createElement("div");
        assEl.className = "line assistant";
        logEl.appendChild(assEl);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split(/\n/);
          buf = parts.pop() || "";
          for (const p of parts) {
            const t = p.replace(/^data:\s*/, "").trim();
            if (!t || t === "[DONE]") continue;
            try {
              const j = JSON.parse(t);
              const piece = j?.text || j?.delta || j?.content || j?.part?.text || "";
              if (piece) {
                ass += piece;
                assEl.textContent = ass;
                logEl.scrollTop = logEl.scrollHeight;
              }
            } catch {
              if (t) {
                ass += t;
                assEl.textContent = ass;
                logEl.scrollTop = logEl.scrollHeight;
              }
            }
          }
        }
        if (ass) {
          const s = sessions.find((x) => x.id === activeSessionId);
          if (s) { s.lines.push({ cls: "assistant", text: ass }); persistSessions(); }
        } else {
          assEl.remove();
        }
        return true;
      }
      const data = await res.json().catch(() => null);
      let out = "";
      if (typeof data === "string") out = data;
      else if (data?.text) out = data.text;
      else if (data?.content) out = typeof data.content === "string" ? data.content : JSON.stringify(data.content);
      else if (data?.message) out = data.message;
      else if (data) out = JSON.stringify(data);
      if (out) {
        line("assistant", out);
        return true;
      }
    } catch (e) {
      if (e && e.name === "AbortError") {
        line("sys", "stopped");
        return false;
      }
    }
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
  line("sys", "host gate required (?gate=1 or gate_hash)");
} else {
  setGateStatus(true);
}
line("sys", "Huayra playground · credit @zanneth · OpenCode target " + opencodeUrl);
probeOpenCode({ quiet: false });
try { promptEl.focus(); } catch {}

})();
