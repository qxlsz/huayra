(function () {
  const SESSION_STORE_KEY = "huayra.sessions.v1";
  const URL_STORE_KEY = "huayra.opencode.url";
  const GATE_STORE_KEY = "huayra.gate.ok";
  const DEFAULT_OPENCODE = "http://127.0.0.1:4096";
  const MOCK_OPENCODE = new URL("/__opencode", location.origin).href.replace(/\/$/, "");

  const logEl = document.getElementById("log");
  const form = document.getElementById("prompt-form");
  const promptEl = document.getElementById("prompt");
  const sendBtn = document.getElementById("send");
  const stopBtn = document.getElementById("stop");
  const sessionList = document.getElementById("session-list");
  const gateEl = document.getElementById("gate");
  const phraseEl = document.getElementById("phrase");

  const state = {
    sessions: [],
    active: 0,
    opencodeUrl: localStorage.getItem(URL_STORE_KEY) || DEFAULT_OPENCODE,
    attachedUrl: null,
    attachedKind: "none",
    agent: "-",
    model: "-",
    provider: "none",
    thinking: "idle",
    abort: null,
    remoteId: null,
  };

  function loadSessions() {
    try {
      const raw = JSON.parse(localStorage.getItem(SESSION_STORE_KEY) || "[]");
      if (Array.isArray(raw) && raw.length) {
        state.sessions = raw.map((s, i) => ({
          id: s.id || "local-" + (i + 1),
          title: s.title || "session " + (i + 1),
          lines: Array.isArray(s.lines) ? s.lines : [],
          remoteId: s.remoteId || null,
        }));
        return;
      }
    } catch {}
    state.sessions = [{ id: "local-1", title: "session 1", lines: [], remoteId: null }];
  }

  function saveSessions() {
    localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(state.sessions));
  }

  function activeSession() {
    return state.sessions[state.active] || state.sessions[0];
  }

  function appendLine(cls, text, persist) {
    const p = document.createElement("p");
    p.className = "line " + cls;
    p.textContent = text;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
    if (persist !== false) {
      const sess = activeSession();
      sess.lines.push({ cls, text });
      saveSessions();
    }
  }

  function renderLog() {
    logEl.replaceChildren();
    for (const line of activeSession().lines) {
      const p = document.createElement("p");
      p.className = "line " + line.cls;
      p.textContent = line.text;
      logEl.appendChild(p);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function renderSessions() {
    sessionList.replaceChildren();
    state.sessions.forEach((sess, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "session-chip" + (i === state.active ? " active" : "");
      btn.textContent = sess.title;
      btn.addEventListener("click", () => {
        state.active = i;
        state.remoteId = sess.remoteId;
        renderSessions();
        renderLog();
        setText("session-label", sess.title);
      });
      sessionList.appendChild(btn);
    });
    setText("session-label", activeSession().title);
  }

  function setDot(id, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = "dot" + (kind ? " " + kind : "");
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setThinking(mode) {
    state.thinking = mode;
    setText("thinking-label", "thinking " + mode);
    setDot("thinking-dot", mode === "idle" ? "" : mode === "error" ? "err" : "warn");
    const guardian = document.getElementById("guardian");
    const templar = document.getElementById("templar");
    if (guardian) guardian.classList.toggle("on", mode !== "run");
    if (templar) templar.classList.toggle("on", mode === "run" || mode === "wait");
  }

  function setAttach(kind, url, extra) {
    state.attachedKind = kind;
    state.attachedUrl = url;
    const label = document.getElementById("opencode-label");
    if (kind === "live") {
      setDot("opencode-dot", "ok");
      if (label) label.textContent = "OpenCode " + url.replace(/^https?:\/\//, "");
      setDot("provider-dot", "ok");
      setText("provider-label", "provider opencode");
      state.provider = "opencode";
    } else if (kind === "mock") {
      setDot("opencode-dot", "warn");
      if (label) label.textContent = "OpenCode mock";
      setDot("provider-dot", "warn");
      setText("provider-label", "provider mock");
      state.provider = "opencode";
    } else {
      setDot("opencode-dot", "err");
      if (label) label.textContent = "OpenCode offline";
      setDot("provider-dot", "");
      setText("provider-label", "provider none");
      state.provider = "none";
    }
    if (extra && extra.agent) {
      state.agent = extra.agent;
      setText("agent-label", "agent " + extra.agent);
      setDot("agent-dot", "ok");
    }
    if (extra && extra.model) {
      state.model = extra.model;
      setText("model-label", "model " + extra.model);
      setDot("model-dot", "ok");
    }
  }

  function fetchWithTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const merged = Object.assign({}, opts || {}, { signal: ctrl.signal });
    return fetch(url, merged).finally(() => clearTimeout(t));
  }

  async function healthAt(base) {
    const paths = ["/global/health", "/health", "/"];
    for (const path of paths) {
      try {
        const res = await fetchWithTimeout(base + path, { method: "GET", mode: "cors" }, 1200);
        if (!res.ok) continue;
        const data = await res.json().catch(() => ({}));
        if (data && (data.healthy === true || data.ok === true || data.service)) {
          return data;
        }
        if (res.ok) return data || { ok: true };
      } catch {}
    }
    return null;
  }

  async function readAgent(base) {
    try {
      const res = await fetchWithTimeout(base + "/agent", { method: "GET", mode: "cors" }, 1200);
      if (!res.ok) return {};
      const data = await res.json();
      return {
        agent: data.name || data.id || "build",
        model: data.model || "-",
      };
    } catch {
      return {};
    }
  }

  async function probeOpenCode(preferred) {
    const candidates = [];
    if (preferred) candidates.push(preferred);
    if (state.opencodeUrl && !candidates.includes(state.opencodeUrl)) candidates.push(state.opencodeUrl);
    if (!candidates.includes(DEFAULT_OPENCODE)) candidates.push(DEFAULT_OPENCODE);
    if (!candidates.includes(MOCK_OPENCODE)) candidates.push(MOCK_OPENCODE);

    for (const url of candidates) {
      const health = await healthAt(url);
      if (!health) continue;
      const extra = await readAgent(url);
      const kind = url.includes("/__opencode") ? "mock" : "live";
      setAttach(kind, url, extra);
      appendLine("sys", "attached " + kind + " " + url, false);
      if (kind === "mock") {
        const live = await healthAt(DEFAULT_OPENCODE);
        if (live) {
          const liveExtra = await readAgent(DEFAULT_OPENCODE);
          setAttach("live", DEFAULT_OPENCODE, liveExtra);
          appendLine("sys", "hopped to live OpenCode " + DEFAULT_OPENCODE, false);
          return DEFAULT_OPENCODE;
        }
      }
      return url;
    }
    setAttach("none", null, {});
    appendLine("sys", "OpenCode not reachable (tried " + candidates.join(", ") + ")", false);
    return null;
  }

  async function ensureRemoteSession() {
    const base = state.attachedUrl;
    if (!base) return null;
    const sess = activeSession();
    if (sess.remoteId) {
      state.remoteId = sess.remoteId;
      return sess.remoteId;
    }
    try {
      const res = await fetchWithTimeout(
        base + "/session",
        {
          method: "POST",
          mode: "cors",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: sess.title }),
        },
        2500,
      );
      if (!res.ok) return null;
      const data = await res.json();
      const id = data.id;
      if (!id) return null;
      sess.remoteId = id;
      state.remoteId = id;
      saveSessions();
      return id;
    } catch {
      return null;
    }
  }

  function parseSseText(chunk) {
    let out = "";
    const blocks = String(chunk).split("\n\n");
    for (const block of blocks) {
      const line = block.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        if (typeof obj === "string") out += obj;
        else if (obj.text) out += obj.text;
        else if (obj.delta && obj.delta.text) out += obj.delta.text;
        else if (obj.part && obj.part.text) out += obj.part.text;
      } catch {
        out += payload;
      }
    }
    return out;
  }

  async function sendPrompt(text) {
    appendLine("user", text);
    if (!state.attachedUrl) {
      const url = await probeOpenCode();
      if (!url) {
        appendLine("err", "no OpenCode host; shift-click the OpenCode pill to set a URL");
        return;
      }
    }
    const sid = await ensureRemoteSession();
    if (!sid) {
      appendLine("err", "could not open a remote session");
      return;
    }
    setThinking("run");
    sendBtn.disabled = true;
    stopBtn.classList.add("visible");
    const ctrl = new AbortController();
    state.abort = ctrl;
    const assistant = document.createElement("p");
    assistant.className = "line assistant";
    assistant.textContent = "";
    logEl.appendChild(assistant);
    try {
      const res = await fetch(state.attachedUrl + "/session/" + encodeURIComponent(sid) + "/prompt", {
        method: "POST",
        mode: "cors",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ parts: [{ type: "text", text }] }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        appendLine("err", "prompt failed (" + res.status + ")");
        assistant.remove();
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += parseSseText(dec.decode(value, { stream: true }));
        assistant.textContent = acc;
        logEl.scrollTop = logEl.scrollHeight;
      }
      if (acc) {
        activeSession().lines.push({ cls: "assistant", text: acc });
        saveSessions();
      } else {
        assistant.remove();
        appendLine("err", "empty reply");
      }
    } catch (err) {
      assistant.remove();
      if (err && err.name === "AbortError") appendLine("sys", "stopped");
      else appendLine("err", String(err && err.message ? err.message : err));
    } finally {
      state.abort = null;
      sendBtn.disabled = false;
      stopBtn.classList.remove("visible");
      setThinking("idle");
    }
  }

  async function syncRemoteSessions() {
    const api = window.HuayraSessionSync;
    if (!api || !state.attachedUrl) {
      appendLine("sys", "sync skipped: no attach");
      return;
    }
    const remote = await api.listRemoteSessions(state.attachedUrl, fetchWithTimeout);
    if (!remote || !remote.length) {
      appendLine("sys", "no remote sessions");
      return;
    }
    for (const item of remote) {
      let sess = state.sessions.find((s) => s.remoteId === item.id);
      if (!sess) {
        sess = {
          id: "remote-" + item.id,
          title: item.title || item.id.slice(0, 8),
          lines: [],
          remoteId: item.id,
        };
        state.sessions.push(sess);
      }
      const msgs = await api.fetchRemoteMessages(state.attachedUrl, item.id, fetchWithTimeout);
      if (msgs.length) sess.lines = msgs;
    }
    saveSessions();
    renderSessions();
    renderLog();
    appendLine("sys", "synced " + remote.length + " remote session(s)", false);
  }

  function openGateIfNeeded() {
    const required = new URLSearchParams(location.search).get("gate");
    if (!required) {
      setText("gate-label", "gate off");
      setDot("gate-dot", "ok");
      return;
    }
    if (sessionStorage.getItem(GATE_STORE_KEY) === "1") {
      setText("gate-label", "gate open");
      setDot("gate-dot", "ok");
      return;
    }
    setText("gate-label", "gate locked");
    setDot("gate-dot", "warn");
    gateEl.classList.add("open");
    gateEl.setAttribute("aria-hidden", "false");
  }

  document.getElementById("gate-skip").addEventListener("click", () => {
    gateEl.classList.remove("open");
    gateEl.setAttribute("aria-hidden", "true");
    setText("gate-label", "gate skipped");
    setDot("gate-dot", "warn");
  });
  document.getElementById("gate-unlock").addEventListener("click", () => {
    const required = new URLSearchParams(location.search).get("gate") || "";
    if (required && phraseEl.value !== required) {
      setText("gate-label", "gate denied");
      setDot("gate-dot", "err");
      return;
    }
    sessionStorage.setItem(GATE_STORE_KEY, "1");
    gateEl.classList.remove("open");
    gateEl.setAttribute("aria-hidden", "true");
    setText("gate-label", "gate open");
    setDot("gate-dot", "ok");
  });

  document.getElementById("session-new").addEventListener("click", () => {
    const n = state.sessions.length + 1;
    state.sessions.push({ id: "local-" + n, title: "session " + n, lines: [], remoteId: null });
    state.active = state.sessions.length - 1;
    state.remoteId = null;
    saveSessions();
    renderSessions();
    renderLog();
  });
  document.getElementById("session-sync").addEventListener("click", () => {
    syncRemoteSessions();
  });
  document.getElementById("session-clear").addEventListener("click", () => {
    activeSession().lines = [];
    saveSessions();
    renderLog();
  });

  document.getElementById("opencode-pill").addEventListener("click", (ev) => {
    if (ev.shiftKey) {
      const next = window.prompt("OpenCode URL", state.opencodeUrl || DEFAULT_OPENCODE);
      if (next) {
        state.opencodeUrl = next.replace(/\/+$/, "");
        localStorage.setItem(URL_STORE_KEY, state.opencodeUrl);
      }
    }
    probeOpenCode(state.opencodeUrl);
  });

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = promptEl.value.trim();
    if (!text) return;
    promptEl.value = "";
    sendPrompt(text);
  });
  promptEl.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      form.requestSubmit();
    }
  });
  stopBtn.addEventListener("click", () => {
    if (state.abort) state.abort.abort();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && state.abort) state.abort.abort();
  });

  loadSessions();
  renderSessions();
  renderLog();
  setThinking("idle");
  openGateIfNeeded();
  appendLine("sys", "Huayra playground. Credit Charles @zanneth. MIT.", false);
  probeOpenCode();
})();
