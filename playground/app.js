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

    const gateConfig = (function () {
      const params = new URLSearchParams(location.search);
      const requireGate = params.get("gate") === "1" || !!params.get("gate_hash");
      const expectedHash = (params.get("gate_hash") || "").toLowerCase();
      return { requireGate, expectedHash, unlocked: !requireGate };
    })();

    function line(cls, text) {
      const p = document.createElement("div");
      p.className = "line " + (cls || "");
      p.textContent = text;
      logEl.appendChild(p);
      logEl.scrollTop = logEl.scrollHeight;
      const s = activeSession();
      if (s) {
        s.lines.push({ cls: cls || "", text: String(text) });
        if (s.lines.length > 400) s.lines = s.lines.slice(-400);
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
        if (!data || !Array.isArray(data.sessions) || !data.sessions.length) return null;
        return data;
      } catch {
        return null;
      }
    }
    function persistSessions() {
      try {
        localStorage.setItem(SESSION_STORE_KEY, JSON.stringify({ sessions, activeId: activeSessionId }));
      } catch {}
    }
    function activeSession() {
      return sessions.find((s) => s.id === activeSessionId) || null;
    }
    function renderSessionBar() {
      sessionListEl.replaceChildren();
      sessions.forEach((s, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = s.title || ("session " + (i + 1));
        if (s.id === activeSessionId) btn.classList.add("active");
        btn.addEventListener("click", () => switchSession(s.id));
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
      return s;
    }
    function ensureSession() {
      const data = loadSessions();
      if (data) {
        sessions = data.sessions;
        activeSessionId = data.activeId || sessions[0]?.id || null;
        if (!activeSessionId && sessions.length) activeSessionId = sessions[0].id;
        if (!sessions.length) createSession();
        else renderSessionBar();
        const s = activeSession();
        if (s) {
          logEl.replaceChildren();
          for (const row of s.lines) {
            const p = document.createElement("div");
            p.className = "line " + (row.cls || "");
            p.textContent = row.text;
            logEl.appendChild(p);
          }
          logEl.scrollTop = logEl.scrollHeight;
        }
      } else {
        createSession();
      }
    }
    async function ensureRemoteSession(local) {
      if (!local) return null;
      if (local.remoteSessionId) return local.remoteSessionId;
      if (!opencodeReachable) return null;
      try {
        const res = await fetchWithTimeout(opencodeUrl + "/session", {
          method: "POST",
          mode: "cors",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: local.title || "Huayra session" }),
        }, 2500);
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        const rid = data?.id || data?.sessionID || data?.sessionId || null;
        if (rid) {
          local.remoteSessionId = rid;
          persistSessions();
        }
        return rid;
      } catch {
        return null;
      }
    }
    function switchSession(id) {
      const s = sessions.find((x) => x.id === id);
      if (!s) return;
      activeSessionId = id;
      persistSessions();
      renderSessionBar();
      logEl.replaceChildren();
      for (const row of s.lines) {
        const p = document.createElement("div");
        p.className = "line " + (row.cls || "");
        p.textContent = row.text;
        logEl.appendChild(p);
      }
      logEl.scrollTop = logEl.scrollHeight;
    }
    function clearActiveSession() {
      const s = activeSession();
      if (!s) return;
      s.lines = [];
      persistSessions();
      logEl.replaceChildren();
      line("sys", "session cleared");
    }
    async function syncRemoteSessions() {
      if (!opencodeReachable) {
        line("sys", "OpenCode unreachable; cannot sync sessions");
        return;
      }
      if (!window.HuayraSessionSync?.listRemoteSessions) {
        line("err", "session-sync helper missing");
        return;
      }
      const remote = await window.HuayraSessionSync.listRemoteSessions(opencodeUrl, fetchWithTimeout);
      if (!remote || !remote.length) {
        line("sys", "no remote sessions found");
        return;
      }
      let imported = 0;
      for (const r of remote) {
        if (sessions.some((s) => s.remoteSessionId === r.id)) continue;
        const s = createSession(r.title || ("remote " + r.id.slice(0, 8)));
        s.remoteSessionId = r.id;
        const msgs = await window.HuayraSessionSync.fetchRemoteMessages(opencodeUrl, r.id, fetchWithTimeout);
        for (const m of msgs) s.lines.push(m);
        imported++;
      }
      persistSessions();
      renderSessionBar();
      line("sys", "synced " + imported + " remote session(s)");
    }

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
      let model = null;
      let remoteCount = null;
      let hit = false;
      try {
        const health = await fetchWithTimeout(opencodeUrl + "/global/health", { method: "GET", mode: "cors" }, 1200);
        if (health.ok) {
          hit = true;
          const body = await health.json().catch(() => null);
          ver = body?.version || body?.ver || null;
        }
      } catch {}
      if (!hit) {
        try {
          const res = await fetchWithTimeout(opencodeUrl + "/", { method: "GET", mode: "cors" }, 1200);
          if (res.ok) hit = true;
        } catch {}
      }
      if (!hit) {
        try {
          const res = await fetchWithTimeout(opencodeUrl + "/session", { method: "GET", mode: "cors" }, 1200);
          if (res.ok) hit = true;
        } catch {}
      }
      if (!hit) {
        opencodeReachable = false;
        provider = "none";
        providerDot.className = "dot";
        providerLabel.textContent = "provider none";
        setModelStatus(null);
        setAgentStatus(null);
        setOpenCodeStatus("err", "OpenCode offline");
        if (!quiet) line("sys", "OpenCode not reachable at " + opencodeUrl);
        startProbeTimer();
        return false;
      }
      model = await resolveOpenCodeModel();
      remoteCount = await countRemoteSessions();
      opencodeReachable = true;
      provider = "opencode";
      providerDot.className = "dot ok";
      providerLabel.textContent = "provider opencode";
      setModelStatus(model);
      setAgentStatus(null);
      const verBit = ver ? ` v${ver}` : "";
      const remoteBit = remoteCount != null ? ` · ${remoteCount} remote` : "";
      setOpenCodeStatus("ok", "OpenCode" + verBit);
      if (!quiet) line("sys", `attached OpenCode at ${opencodeUrl}` + verBit + (model ? ` · ${model}` : "") + remoteBit);
      else line("sys", `OpenCode became reachable · ${opencodeUrl}` + verBit + (model ? ` · ${model}` : "") + remoteBit);
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
      const phrase = phraseInput.value || "";
      if (!gateConfig.expectedHash) {
        setGateStatus(true);
        line("sys", "gate unlocked (no hash configured)");
        return;
      }
      try {
        const enc = new TextEncoder().encode(phrase);
        const buf = await crypto.subtle.digest("SHA-256", enc);
        const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
        if (hex === gateConfig.expectedHash) {
          setGateStatus(true);
          line("sys", "gate unlocked");
        } else {
          line("err", "gate passphrase mismatch");
        }
      } catch (e) {
        line("err", "gate check failed");
      }
    }

    async function streamOpenCodeReply(rid, promptText) {
      const endpoints = [
        { url: opencodeUrl + "/session/" + encodeURIComponent(rid) + "/message", body: { parts: [{ type: "text", text: promptText }] } },
        { url: opencodeUrl + "/session/" + encodeURIComponent(rid) + "/prompt", body: { prompt: promptText } },
        { url: opencodeUrl + "/prompt", body: { sessionID: rid, prompt: promptText } },
      ];
      let lastErr = null;
      for (const ep of endpoints) {
        try {
          abortCtrl = new AbortController();
          const res = await fetch(ep.url, {
            method: "POST",
            mode: "cors",
            headers: { "content-type": "application/json", accept: "text/event-stream, application/json, text/plain" },
            body: JSON.stringify(ep.body),
            signal: abortCtrl.signal,
          });
          if (!res.ok) {
            lastErr = new Error("HTTP " + res.status);
            continue;
          }
          const ct = (res.headers.get("content-type") || "").toLowerCase();
          if (ct.includes("text/event-stream") || ct.includes("text/plain") || ct.includes("ndjson")) {
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = "";
            let acc = "";
            const out = document.createElement("div");
            out.className = "line assistant";
            logEl.appendChild(out);
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              const parts = buf.split(/\n/);
              buf = parts.pop() || "";
              for (const row of parts) {
                let t = row.trim();
                if (!t) continue;
                if (t.startsWith("data:")) t = t.slice(5).trim();
                if (t === "[DONE]") continue;
                try {
                  const j = JSON.parse(t);
                  const piece = j?.text || j?.content || j?.delta?.content || j?.message?.content || "";
                  if (piece) { acc += piece; out.textContent = acc; logEl.scrollTop = logEl.scrollHeight; }
                } catch {
                  acc += t + "\n";
                  out.textContent = acc;
                  logEl.scrollTop = logEl.scrollHeight;
                }
              }
            }
            if (acc.trim()) {
              const s = activeSession();
              if (s) { s.lines.push({ cls: "assistant", text: acc.trim() }); persistSessions(); }
            }
            return true;
          }
          const data = await res.json().catch(() => null);
          let text = "";
          if (typeof data === "string") text = data;
          else if (data?.text) text = data.text;
          else if (data?.content) text = typeof data.content === "string" ? data.content : JSON.stringify(data.content);
          else if (data?.message?.content) text = data.message.content;
          else if (data?.parts) text = (data.parts || []).map((p) => p?.text || "").join("\n");
          else text = JSON.stringify(data);
          if (text) line("assistant", text);
          return true;
        } catch (e) {
          if (e?.name === "AbortError") {
            line("sys", "request aborted");
            return false;
          }
          lastErr = e;
        } finally {
          abortCtrl = null;
        }
      }
      if (lastErr) line("err", "OpenCode request failed: " + (lastErr.message || lastErr));
      return false;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!gateConfig.unlocked) {
        line("err", "gate locked");
        return;
      }
      const text = (promptEl.value || "").trim();
      if (!text) return;
      promptEl.value = "";
      line("user", text);
      if (!opencodeReachable) {
        line("sys", "OpenCode offline. Start serve on the target, or shift-click the OpenCode pill to set the URL.");
        return;
      }
      setThinking(true);
      try {
        const local = activeSession();
        const rid = await ensureRemoteSession(local);
        if (rid && opencodeReachable) {
          await streamOpenCodeReply(rid, text);
        } else {
          line("sys", "could not open remote session");
        }
      } finally {
        setThinking(false);
      }
    });

    stopBtn.addEventListener("click", () => {
      if (abortCtrl) {
        abortCtrl.abort();
        abortCtrl = null;
      }
      setThinking(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && abortCtrl) {
        abortCtrl.abort();
        abortCtrl = null;
        setThinking(false);
      }
    });

    sessionNewBtn.addEventListener("click", () => {
      createSession();
      logEl.replaceChildren();
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
