// OpenCode session index helpers (Huayra playground)
window.HuayraSessionSync = (function () {
  async function listRemoteSessions(opencodeUrl, fetchWithTimeout) {
    try {
      const res = await fetchWithTimeout(opencodeUrl + "/session", { method: "GET", mode: "cors" }, 1500);
      if (!res.ok) return null;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.sessions || data?.data || []);
      if (!Array.isArray(list)) return null;
      return list.map((s) => ({
        id: s?.id || s?.sessionID || s?.sessionId || null,
        title: s?.title || s?.name || null,
      })).filter((s) => s.id);
    } catch {
      return null;
    }
  }
  async function fetchRemoteMessages(opencodeUrl, remoteId, fetchWithTimeout) {
    if (!remoteId) return [];
    try {
      const res = await fetchWithTimeout(
        opencodeUrl + "/session/" + encodeURIComponent(remoteId) + "/message",
        { method: "GET", mode: "cors" },
        2500
      );
      if (!res.ok) return [];
      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data?.messages || data?.data || []);
      if (!Array.isArray(rows)) return [];
      const out = [];
      for (const row of rows) {
        const role = (row?.info?.role || row?.role || "").toLowerCase();
        const parts = row?.parts || row?.content || [];
        let text = "";
        if (typeof parts === "string") text = parts;
        else if (Array.isArray(parts)) {
          text = parts.map((p) => p?.text || p?.content || "").filter(Boolean).join("\n");
        } else if (row?.text) text = row.text;
        text = String(text || "").trim();
        if (!text) continue;
        if (role === "user" || role === "human") out.push({ cls: "user", text });
        else if (role === "assistant" || role === "ai" || role === "model") out.push({ cls: "assistant", text });
        else out.push({ cls: "sys", text });
      }
      return out;
    } catch {
      return [];
    }
  }
  async function deleteRemoteSession(opencodeUrl, remoteId, fetchWithTimeout) {
    if (!remoteId) return false;
    try {
      const res = await fetchWithTimeout(
        opencodeUrl + "/session/" + encodeURIComponent(remoteId),
        { method: "DELETE", mode: "cors" },
        1500
      );
      return Boolean(res && res.ok);
    } catch {
      return false;
    }
  }
  return { listRemoteSessions, fetchRemoteMessages, deleteRemoteSession };
})();
