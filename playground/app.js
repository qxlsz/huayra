(function () {
  var parts = window.__HUAYRA_APP_PARTS || [];
  var src = parts.join("");
  if (!src || src.indexOf("SESSION_STORE_KEY") < 0) {
    console.error("Huayra app.js parts incomplete");
    return;
  }
  var s = document.createElement("script");
  s.textContent = src;
  document.head.appendChild(s);
})();
