(function () {
  const SESSION_STORE_KEY = "huayra.sessions.v1";
  const ACTIVE_STORE_KEY = "huayra.sessions.active";
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
    agent: localStorage.getItem("huayra.agent") || "-",
    model: localStorage.getItem("huayra.model") || "-",
    provider: "none",
    thinking: localStorage.getItem("huayra.thinking") || "idle",
    runMode: "idle",
    abort: null,
    remoteId: null,
    agents: [],
    models: [],
    mascot: localStorage.getItem("huayra.mascot") || "guardian",
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
        const savedActive = Number(localStorage.getItem(ACTIVE_STORE_KEY) || "0");
        state.active = Number.isInteger(savedActive) && savedActive >= 0 && savedActive < state.sessions.length ? savedActive : 0;
        state.remoteId = state.sessions[state.active].remoteId;
        return;
      }
    } catch {}
    state.sessions = [{ id: "local-1", title: "session 1", lines: [], remoteId: null }];
    state.active = 0;
  }
  function saveSessions() {
    localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(state.sessions));
    localStorage.setItem(ACTIVE_STORE_KEY, String(state.active));
  }
  async function activateSession(i) {
    if (i < 0 || i >= state.sessions.length) return;
    state.active = i;
    const sess = state.sessions[i];
    state.remoteId = sess.remoteId;
    saveSessions();
    renderSessions();
    renderLog();
    setText("session-label", sess.title);
    if (sess.remoteId && state.attachedUrl && window.HuayraSessionSync) {
      const msgs = await window.HuayraSessionSync.fetchRemoteMessages(state.attachedUrl, sess.remoteId, fetchWithTimeout);
      if (msgs.length) {
        sess.lines = msgs;
        saveSessions();
        renderLog();
      }
    }
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
      btn.textContent = sess.title + (sess.remoteId ? " ·" : "");
      btn.title = sess.remoteId ? sess.remoteId : "local · double-click to rename";
      btn.addEventListener("click", () => { activateSession(i); });
      btn.addEventListener("dblclick", async (ev) => {
        ev.preventDefault();
        const next = window.prompt("session title", sess.title);
        if (!next) return;
        sess.title = next.trim() || sess.title;
        saveSessions();
        renderSessions();
        const api = window.HuayraSessionSync;
        if (sess.remoteId && state.attachedUrl && api && api.renameRemoteSession) {
          await api.renameRemoteSession(state.attachedUrl, sess.remoteId, sess.title, fetchWithTimeout);
        }
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
    state.runMode = mode;
    const depth = state.thinking || "idle";
    setText("thinking-label", mode === "run" ? "thinking " + depth : "thinking");
    setDot("thinking-dot", mode === "idle" ? (depth === "idle" ? "" : "warn") : mode === "error" ? "err" : "warn");
    paintMascots(mode);
    const thinkSel = document.getElementById("thinking-select");
    if (thinkSel && thinkSel.value !== depth && (depth === "idle" || depth === "low" || depth === "medium" || depth === "high")) {
      thinkSel.value = depth;
    }
  }
  function mascotSrc(name, busy) {
    return "./assets/" + name + (busy ? "-busy.gif" : ".gif");
  }
  function paintMascots(mode) {
    const busy = mode === "run" || mode === "wait";
    const picked = state.mascot === "templar" ? "templar" : "guardian";
    const guardian = document.getElementById("guardian");
    const templar = document.getElementById("templar");
    const gImg = guardian && guardian.querySelector("img");
    const tImg = templar && templar.querySelector("img");
    if (gImg) gImg.src = mascotSrc("guardian", busy && picked === "guardian");
    if (tImg) tImg.src = mascotSrc("templar", busy && picked === "templar");
    if (guardian) {
      guardian.classList.toggle("on", picked === "guardian" || !busy);
      guardian.title = "Guardian " + (busy && picked === "guardian" ? "busy" : "idle") + ". Click to pick.";
    }
    if (templar) {
      templar.classList.toggle("on", picked === "templar" || busy);
      templar.title = "High Templar " + (busy && picked === "templar" ? "busy" : "idle") + ". Click to pick.";
    }
  }
  function pickMascot(name) {
    state.mascot = name === "templar" ? "templar" : "guardian";
    localStorage.setItem("huayra.mascot", state.mascot);
    paintMascots(state.runMode);
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
      setText("agent-label", "agent");
      setDot("agent-dot", "ok");
    }
    if (extra && extra.model) {
      state.model = extra.model;
      setText("model-label", "model");
      setDot("model-dot", "ok");
    }
    applyCatalog(extra || {});
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
        if (data && (data.healthy === true || data.ok === true || data.service)) return data;
        if (res.ok) return data || { ok: true };
      } catch {}
    }
    return null;
  }
  async function readModels(base) {
    try {
      const res = await fetchWithTimeout(base + "/v1/models", { method: "GET", mode: "cors" }, 1200);
      if (!res.ok) return [];
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || data.models || [];
      return list.map((m) => String((m && (m.id || m.name)) || "")).filter(Boolean);
    } catch {
      return [];
    }
  }
  async function readAgent(base) {
    try {
      const models = await readModels(base);
      const res = await fetchWithTimeout(base + "/agent", { method: "GET", mode: "cors" }, 1200);
      if (!res.ok) return models.length ? { agent: "default", model: models[0], agents: ["default"], models } : {};
      const data = await res.json();
      const row = Array.isArray(data) ? data[0] : data;
      const agent = (row && (row.name || row.id)) || "build";
      let model = (row && row.model) || "";
      const catalog = Array.isArray(row && row.agents) ? row.agents : Array.isArray(data && data.agents) ? data.agents : [];
      const agents = catalog.map((a) => String((a && (a.name || a.id)) || a || "")).filter(Boolean);
      if (!agents.includes(agent)) agents.unshift(agent);
      if (!model || model === "-") model = models[0] || model || "-";
      if (model && model !== "-" && !models.includes(model)) models.unshift(model);
      return { agent, model, agents, models };
    } catch {
      return {};
    }
  }
  function fillSelect(el, values, selected) {
    if (!el) return;
    const uniq = [];
    for (const v of values || []) {
      if (v && !uniq.includes(v)) uniq.push(v);
    }
    if (selected && selected !== "-" && !uniq.includes(selected)) uniq.unshift(selected);
    el.replaceChildren();
    if (!uniq.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "-";
      el.appendChild(opt);
      el.disabled = true;
      return;
    }
    for (const v of uniq) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      if (v === selected) opt.selected = true;
      el.appendChild(opt);
    }
    el.disabled = false;
    if (selected) el.value = selected;
  }
  function applyCatalog(extra) {
    if (!extra) return;
    const agentSel = document.getElementById("agent-select");
    const modelSel = document.getElementById("model-select");
    const thinkSel = document.getElementById("thinking-select");
    if (extra.agents) state.agents = extra.agents;
    if (extra.models) state.models = extra.models;
    fillSelect(agentSel, state.agents.length ? state.agents : extra.agent ? [extra.agent] : [], extra.agent || state.agent);
    fillSelect(modelSel, state.models.length ? state.models : extra.model ? [extra.model] : [], extra.model || state.model);
    if (thinkSel && state.thinking) thinkSel.value = state.thinking === "run" || state.thinking === "wait" ? "medium" : state.thinking;
    if (extra.agent && extra.agent !== "-") localStorage.setItem("huayra.agent", extra.agent);
    if (extra.model && extra.model !== "-") localStorage.setItem("huayra.model", extra.model);
  }
  async function pushAgentChoice() {
    const base = state.attachedUrl;
    if (!base) return;
    try {
      await fetchWithTimeout(base + "/agent", {
        method: "POST",
        mode: "cors",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: state.agent, model: state.model, thinking: state.thinking }),
      }, 1500);
    } catch {}
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
      syncRemoteSessions().catch(() => {});
      if (kind === "mock") {
        const live = await healthAt(DEFAULT_OPENCODE);
        if (live) {
          const liveExtra = await readAgent(DEFAULT_OPENCODE);
          setAttach("live", DEFAULT_OPENCODE, liveExtra);
          appendLine("sys", "hopped to live OpenCode " + DEFAULT_OPENCODE, false);
          syncRemoteSessions().catch(() => {});
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
      const res = await fetchWithTimeout(base + "/session", {
        method: "POST",
        mode: "cors",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: sess.title }),
      }, 2500);
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
        body: JSON.stringify({ parts: [{ type: "text", text: text }], agent: state.agent, model: state.model, thinking: state.thinking }),
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
        sess = { id: "remote-" + item.id, title: item.title || item.id.slice(0, 8), lines: [], remoteId: item.id };
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
    setText("session-label", activeSession().title);
  });
  document.getElementById("session-sync").addEventListener("click", () => { syncRemoteSessions(); });
  async function closeActiveSession() {
    const sess = activeSession();
    if (!sess) return;
    const api = window.HuayraSessionSync;
    if (sess.remoteId && state.attachedUrl && api && api.deleteRemoteSession) {
      await api.deleteRemoteSession(state.attachedUrl, sess.remoteId, fetchWithTimeout);
    }
    if (state.sessions.length <= 1) {
      sess.lines = [];
      sess.remoteId = null;
      sess.title = "session 1";
      state.remoteId = null;
      saveSessions();
      renderSessions();
      renderLog();
      appendLine("sys", "closed last session; index reset", false);
      return;
    }
    const idx = state.active;
    state.sessions.splice(idx, 1);
    state.active = Math.min(idx, state.sessions.length - 1);
    state.remoteId = state.sessions[state.active].remoteId;
    saveSessions();
    renderSessions();
    renderLog();
    appendLine("sys", "closed session", false);
  }
  document.getElementById("session-close").addEventListener("click", () => { closeActiveSession(); });
  document.getElementById("session-clear").addEventListener("click", () => {
    activeSession().lines = [];
    saveSessions();
    renderLog();
  });
  const guardianBtn = document.getElementById("guardian");
  const templarBtn = document.getElementById("templar");
  if (guardianBtn) guardianBtn.addEventListener("click", () => pickMascot("guardian"));
  if (templarBtn) templarBtn.addEventListener("click", () => pickMascot("templar"));
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
  const agentSel = document.getElementById("agent-select");
  const modelSel = document.getElementById("model-select");
  const thinkSel = document.getElementById("thinking-select");
  function persistCatalog() {
    if (state.agent && state.agent !== "-") localStorage.setItem("huayra.agent", state.agent);
    if (state.model && state.model !== "-") localStorage.setItem("huayra.model", state.model);
    if (state.thinking) localStorage.setItem("huayra.thinking", state.thinking);
  }
  if (agentSel) {
    agentSel.addEventListener("change", () => {
      state.agent = agentSel.value || state.agent;
      setDot("agent-dot", "ok");
      persistCatalog();
      pushAgentChoice();
    });
  }
  if (modelSel) {
    modelSel.addEventListener("change", () => {
      state.model = modelSel.value || state.model;
      setDot("model-dot", "ok");
      persistCatalog();
      pushAgentChoice();
    });
  }
  if (thinkSel) {
    thinkSel.addEventListener("change", () => {
      state.thinking = thinkSel.value || "idle";
      setText("thinking-label", "thinking");
      setDot("thinking-dot", state.thinking === "idle" ? "" : "warn");
      persistCatalog();
      pushAgentChoice();
    });
  }
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
  async function abortRemote() {
    if (state.abort) state.abort.abort();
    const base = state.attachedUrl;
    const sid = state.remoteId;
    if (!base || !sid) return;
    try {
      await fetchWithTimeout(base + "/session/" + encodeURIComponent(sid) + "/abort", { method: "POST", mode: "cors" }, 1500);
    } catch {}
  }
  stopBtn.addEventListener("click", () => { abortRemote(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") abortRemote();
  });
  loadSessions();
  renderSessions();
  renderLog();
  setThinking("idle");
  openGateIfNeeded();
  appendLine("sys", "Huayra playground. Credit Charles @zanneth. MIT.", false);
  probeOpenCode();
})();
