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
const OPENCODE_DEFAULT = "http://127.0.0.1:4096";
const REPROBE_MS = 10000;
function resolveOpenCodeUrl() {
  try {
    const q = new URLSearchParams(location.search).get("opencode");
    if (q && /^https?:\/\//i.test(q)) return q.replace(/\/$/, "");
  } catch {}
  try {
    const stored = localStorage.getItem(OPENCODE_STORE_KEY);
    if (stored && /^https?:\/\//i.test(stored)) return stored.replace(/\/$/, "");
  } catch {}
  return OPENCODE_DEFAULT;
}
function setOpenCodeUrl(url) {
  const cleaned = String(url || "").trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(cleaned)) return false;
  preferredOpenCodeUrl = cleaned;
  opencodeUrl = cleaned;
  try { localStorage.setItem(OPENCODE_STORE_KEY, cleaned); } catch {}
  return true;
}
function isMockUrl(url) {
  try {
    const mock = location.origin + "/__opencode";
    return url === mock;
  } catch {
    return false;
  }
}
function stopPreferredReprobe() {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
}
function startPreferredReprobe() {
  stopPreferredReprobe();
  if (!preferredOpenCodeUrl || isMockUrl(preferredOpenCodeUrl)) return;
  if (opencodeUrl === preferredOpenCodeUrl && opencodeReachable) return;
  probeTimer = setInterval(() => {
    if (document.hidden) return;
    tryPreferredOpenCode();
  }, REPROBE_MS);
}
async function tryPreferredOpenCode() {
  if (!preferredOpenCodeUrl || isMockUrl(preferredOpenCodeUrl)) return false;
  if (opencodeUrl === preferredOpenCodeUrl && opencodeReachable) {
    stopPreferredReprobe();
    return true;
  }
  const hit = await tryAttachAt(preferredOpenCodeUrl);
  if (!hit.ok) return false;
  opencodeUrl = preferredOpenCodeUrl;
  opencodeReachable = true;
  setOpenCodeStatus("ok", "OpenCode " + (hit.ver || "up"));
  await resolveAgentAndModel();
  stopPreferredReprobe();
  line(
    "sys",
    "OpenCode serve reached at " + preferredOpenCodeUrl + (hit.ver ? " · " + hit.ver : "") + " (switched from mock)",
    { persist: false },
  );
  return true;
}
let preferredOpenCodeUrl = resolveOpenCodeUrl();
let opencodeUrl = preferredOpenCodeUrl;
let opencodeReachable = false;
let provider = "none";
let probeTimer = null;
let abortCtrl = null;

// NOTE: remainder of file restored in follow-up if truncated - full file is 810 lines
console.error("INCOMPLETE_PUSH");
})();
