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

function line(cls, text, opts = {}) {
  if (!logEl) return;
  const el = document.createElement("div");
  el.className = "line " + (cls || "");
  el.textContent = text;
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
  if (opts.persist === false) return;
  const s = sessions.find((x) => x.id === activeSessionId);
  if (s) {
    s.lines.push({ cls, text });
    persistSessions();
  }
}
