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

    function uid() {
      return "s_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }
    function setOpenCodeStatus(kind, text) {
      opencodeDot.className = "dot" + (kind === "ok" ? " ok" : kind === "err" ? " err" : " warn");
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
      for (const s of sessions) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "session-chip" + (s.id === activeSessionId ? " active" : "");
        btn.textContent = s.title || s.id;
        btn.addEventListener("click", () => switchSession(s.id));
        sessionListEl.appendChild(btn);
      }
      const idx = sessions.findIndex((s) => s.id === activeSessionId) + 1;
      sessionLabel.textContent = "session " + idx + "/" + sessions.length;
    }
    function createSession(opts = {}) {
      const s = {
        id: uid(),
        title: opts.title || ("session " + (sessions.length + 1)),
        lines: [],
        remoteSessionId: opts.remoteSessionId || null,
      };
      sessions.push(s);
      activeSessionId = s.id;
      persistSessions();
      renderSessionBar();
      return s;
    }

    async function ensureRemoteSession(local) {
      if (!local) return null;
      if (local.remoteSessionId) return local.remoteSessionId;
      if (!opencodeReachable) return null;
      try {
        const res = await fetch(opencodeUrl + "/session", {
          method: "POST",
          mode: "cors",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: local.title || undefined }),
          signal: abortCtrl ? abortCtrl.signal : undefined,
        });
        if (!res.ok) return null;
        const body = await res.json().catch(() => null);
        const rid = body?.id || body?.session?.id || body?.sessionID || null;
        if (rid) {
          local.remoteSessionId = rid;
          persistSessions();
          return rid;
        }
      } catch (err) {
        if (err?.name === "AbortError") throw err;
      }
      return null;
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
      s.remoteSessionId = null;
      persistSessions();
      logEl.replaceChildren();
      line("sys", "session cleared");
    }

    async function syncRemoteSessions() {
      if (!opencodeReachable) {
        line("sys", "OpenCode unreachable; cannot sync sessions");
        return;
      }
      const helper = window.HuayraSessionSync;
      if (!helper || typeof helper.listRemoteSessions !== "function") {
        line("err", "session-sync helper missing");
        return;
      }
      if (sessionSyncBtn) sessionSyncBtn.disabled = true;
      try {
        const remote = await helper.listRemoteSessions(opencodeUrl, fetchWithTimeout);
        if (!remote || !remote.length) {
          line("sys", "no remote OpenCode sessions to import");
          return;
        }
        const known = new Set(
          sessions.map((s) => s.remoteSessionId).filter(Boolean)
        );
        let imported = 0;
        for (const r of remote) {
          if (!r.id || known.has(r.id)) continue;
          const title = (r.title && String(r.title).trim()) || ("remote " + r.id.slice(0, 8));
          let lines = [];
          if (typeof helper.fetchRemoteMessages === "function") {
            try {
              lines = await helper.fetchRemoteMessages(opencodeUrl, r.id, fetchWithTimeout);
            } catch {
              lines = [];
            }
          }
          createSession({ title, remoteSessionId: r.id });
          const s = activeSession();
          if (s && lines.length) {
            s.lines = lines;
            persistSessions();
          }
          known.add(r.id);
          imported += 1;
        }
        if (imported === 0) {
          line("sys", "session index already in sync (" + remote.length + " remote)");
        } else {
          line("sys", "imported " + imported + " remote session" + (imported === 1 ? "" : "s"));
          const last = sessions[sessions.length - 1];
          if (last) switchSession(last.id);
        }
        renderSessionBar();
      } catch (err) {
        line("err", "session sync failed: " + (err?.message || String(err)));
      } finally {
        if (sessionSyncBtn) sessionSyncBtn.disabled = false;
      }
    }

    function maybeAutoTitle(text) {
      const s = activeSession();
      if (!s) return;
      const defaultTitle = /^session\s+\d+$/i.test(s.title || "");
      if (!defaultTitle) return;
      const t = String(text || "").trim().replace(/\s+/g, " ").slice(0, 40);
      if (!t) return;
      s.title = t;
      persistSessions();
      renderSessionBar();
    }
    function ensureSession() {
      const loaded = loadSessions();
      if (loaded) {
        sessions = loaded.sessions;
        activeSessionId = loaded.activeId || sessions[0].id;
        if (!sessions.find((s) => s.id === activeSessionId)) activeSessionId = sessions[0].id;
        renderSessionBar();
        const s = activeSession();
        if (s && s.lines.length) {
          logEl.replaceChildren();
          for (const row of s.lines) {
            const p = document.createElement("div");
            p.className = "line " + (row.cls || "");
            p.textContent = row.text;
            logEl.appendChild(p);
          }
          logEl.scrollTop = logEl.scrollHeight;
        }
        return;
      }
      createSession({ title: "session 1" });
    }
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

    const gateConfig = (function () {
      const params = new URLSearchParams(location.search);
      const gate = params.get("gate");
      const gateHash = params.get("gate_hash") || params.get("gateHash");
      const requireGate = gate === "1" || gate === "true" || !!(gateHash && /^[0-9a-f]{64}$/i.test(gateHash));
      return { requireGate, gateHash: gateHash || null, unlocked: !requireGate };
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
      let healthVersion = null;
      try {
        const healthRes = await fetchWithTimeout(opencodeUrl + "/global/health", { method: "GET", mode: "cors" }, 1500);
        if (healthRes.ok) {
          try {
            const body = await healthRes.json();
            healthVersion = body?.version || body?.opencode || body?.name || null;
            if (typeof healthVersion === "object") healthVersion = healthVersion?.version || null;
          } catch {}
          opencodeReachable = true;
          provider = "opencode";
          providerDot.className = "dot ok";
          providerLabel.textContent = "provider opencode";
          setOpenCodeStatus("ok", healthVersion ? `OpenCode ${healthVersion}` : "OpenCode attached");
          const model = await resolveOpenCodeModel();
          if (model) setModelStatus(model);
          setAgentStatus("opencode");
          const remoteN = await countRemoteSessions();
          const remoteBit = remoteN != null ? ` · ${remoteN} remote session${remoteN === 1 ? "" : "s"}` : "";
          const verBit = healthVersion ? ` · ${healthVersion}` : "";
          if (!quiet) line("sys", `attached OpenCode at ${opencodeUrl}` + verBit + (model ? ` · ${model}` : "") + remoteBit);
          else line("sys", `OpenCode became reachable · ${opencodeUrl}` + verBit + (model ? ` · ${model}` : "") + remoteBit);
          if (probeTimer != null) { clearInterval(probeTimer); probeTimer = null; }
          return;
        }
      } catch {}
      try {
        const res = await fetchWithTimeout(opencodeUrl + "/v1/models", { method: "GET", mode: "cors" }, 1500);
        if (res.ok) {
          opencodeReachable = true;
          provider = "opencode";
          providerDot.className = "dot ok";
          providerLabel.textContent = "provider opencode";
          setOpenCodeStatus("ok", "OpenCode attached");
          const model = await resolveOpenCodeModel();
          if (model) setModelStatus(model);
          setAgentStatus("opencode");
          const remoteN = await countRemoteSessions();
          const remoteBit = remoteN != null ? ` · ${remoteN} remote session${remoteN === 1 ? "" : "s"}` : "";
          if (!quiet) line("sys", `attached OpenCode at ${opencodeUrl}` + (model ? ` · ${model}` : "") + remoteBit);
          else line("sys", `OpenCode became reachable · ${opencodeUrl}` + (model ? ` · ${model}` : "") + remoteBit);
          if (probeTimer != null) { clearInterval(probeTimer); probeTimer = null; }
          return;
        }
      } catch {}
      opencodeReachable = false;
      provider = "none";
      providerDot.className = "dot";
      providerLabel.textContent = "provider none";
      setOpenCodeStatus("warn", `OpenCode unreachable (${opencodeUrl})`);
      if (!quiet) { setModelStatus(null); setAgentStatus(null); }
      startProbeTimer();
    }

    function setGateStatus(unlocked) {
      gateConfig.unlocked = unlocked;
      if (unlocked) {
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
        line("err", "gate phrase mismatch");
        return;
      }
      setGateStatus(true);
      line("sys", "gate unlocked (no hash check)");
    }

    async function sendPrompt(text) {
      const raw = String(text || "").trim();
      if (!raw) return;
      if (!gateConfig.unlocked) {
        line("err", "gate locked");
        return;
      }
      promptEl.value = "";
      line("user", raw);
      maybeAutoTitle(raw);
      if (!opencodeReachable) {
        line("sys", "OpenCode not attached; prompt not sent");
        return;
      }
      setThinking(true);
      abortCtrl = new AbortController();
      try {
        const local = activeSession();
        const rid = await ensureRemoteSession(local);
        const endpoints = [];
        if (rid) {
          endpoints.push({
            url: opencodeUrl + "/session/" + encodeURIComponent(rid) + "/prompt",
            body: { parts: [{ type: "text", text: raw }] },
          });
          endpoints.push({
            url: opencodeUrl + "/session/" + encodeURIComponent(rid) + "/message",
            body: { parts: [{ type: "text", text: raw }] },
          });
        }
        endpoints.push({
          url: opencodeUrl + "/prompt",
          body: { prompt: raw, sessionID: rid || undefined },
        });
        let replied = false;
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep.url, {
              method: "POST",
              mode: "cors",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(ep.body),
              signal: abortCtrl.signal,
            });
            if (!res.ok) continue;
            const data = await res.json().catch(() => null);
            let out = "";
            if (typeof data === "string") out = data;
            else if (data?.text) out = data.text;
            else if (data?.message) out = typeof data.message === "string" ? data.message : (data.message?.content || data.message?.text || "");
            else if (data?.parts) out = (data.parts || []).map((p) => p?.text || "").filter(Boolean).join("\n");
            else if (data?.content) out = typeof data.content === "string" ? data.content : JSON.stringify(data.content);
            out = String(out || "").trim();
            if (out) {
              line("assistant", out);
              replied = true;
              break;
            }
            if (res.ok) {
              line("sys", "prompt accepted (empty body)");
              replied = true;
              break;
            }
          } catch (err) {
            if (err?.name === "AbortError") throw err;
          }
        }
        if (!replied) line("err", "OpenCode did not return a reply");
      } catch (err) {
        if (err?.name === "AbortError") line("sys", "stopped");
        else line("err", "send failed: " + (err?.message || String(err)));
      } finally {
        setThinking(false);
        abortCtrl = null;
      }
    }

    function abortInFlight() {
      const s = activeSession();
      const rid = s?.remoteSessionId;
      if (rid && opencodeReachable) {
        fetch(opencodeUrl + "/session/" + encodeURIComponent(rid) + "/abort", {
          method: "POST",
          mode: "cors",
        }).catch(() => {});
      }
      if (abortCtrl) {
        try { abortCtrl.abort(); } catch {}
        abortCtrl = null;
      }
      setThinking(false);
    }

    // Wire UI
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendPrompt(promptEl.value);
    });
    promptEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPrompt(promptEl.value);
      }
    });
    stopBtn.addEventListener("click", () => abortInFlight());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") abortInFlight();
    });
    sessionNewBtn.addEventListener("click", () => {
      createSession();
      logEl.replaceChildren();
      line("sys", "new session");
    });
    if (sessionSyncBtn) {
      sessionSyncBtn.addEventListener("click", () => {
        syncRemoteSessions();
      });
    }
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
