// OpenCode SSE parse helpers (Huayra playground)
window.HuayraSse = (function () {
  let sseBuf = "";
  function partKind(obj) {
    if (obj == null || typeof obj === "string") return "text";
    const raw = String(
      (obj.part && obj.part.type) ||
      (obj.properties && obj.properties.part && obj.properties.part.type) ||
      obj.kind ||
      ""
    ).toLowerCase();
    if (raw === "reasoning" || raw === "thinking" || raw === "think") return "think";
    return "text";
  }
  function textFromPartEvent(obj) {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;
    if (typeof obj.text === "string" && partKind(obj) === "text") return obj.text;
    if (obj.delta && typeof obj.delta.text === "string") return obj.delta.text;
    if (obj.part && typeof obj.part.text === "string") return obj.part.text;
    if (obj.properties && obj.properties.part && typeof obj.properties.part.text === "string") {
      return obj.properties.part.text;
    }
    if (typeof obj.text === "string") return obj.text;
    return "";
  }
  function parseSseEvents(chunk, flush) {
    sseBuf += String(chunk || "");
    const events = [];
    const blocks = sseBuf.split("\n\n");
    sseBuf = flush ? "" : (blocks.pop() || "");
    for (const block of blocks) {
      const line = block.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        const text = textFromPartEvent(obj);
        if (text) events.push({ kind: partKind(obj), text });
      } catch {
        events.push({ kind: "text", text: payload });
      }
    }
    return events;
  }
  function parseSseText(chunk, flush) {
    return parseSseEvents(chunk, flush)
      .filter((e) => e.kind !== "think")
      .map((e) => e.text)
      .join("");
  }
  function reset() {
    sseBuf = "";
  }
  return { partKind, textFromPartEvent, parseSseEvents, parseSseText, reset };
})();
