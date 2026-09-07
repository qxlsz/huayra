(function () {
  const parts = window.__HUAYRA_APP_PARTS || [];
  const code = parts.join("");
  try {
    // eslint-disable-next-line no-new-func
    new Function(code)();
  } catch (e) {
    console.error("Huayra app load failed", e);
    const log = document.getElementById("log");
    if (log) {
      const p = document.createElement("div");
      p.className = "line err";
      p.textContent = "console load failed: " + (e && e.message ? e.message : e);
      log.appendChild(p);
    }
  }
})();
