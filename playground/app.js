(function () {
  const SESSION_STORE_KEY = "huayra.sessions.v1";
  const ACTIVE_STORE_KEY = "huayra.sessions.active";
  const URL_STORE_KEY = "huayra.opencode.url";
  const GATE_STORE_KEY = "huayra.gate.ok";
  const DEFAULT_OPENCODE = "http://127.0.0.1:4096";
  const LIVE_PROXY = new URL("/__live", location.origin).href.replace(/\/$/, "");
  const MOCK_OPENCODE = new URL("/__opencode", location.origin).href.replace(/\/$/, "");
