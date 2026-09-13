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
