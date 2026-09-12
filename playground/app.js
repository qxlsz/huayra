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
