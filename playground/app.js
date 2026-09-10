(async function () {
  const res = await fetch("./console.js");
  const text = await res.text();
  (0, eval)(text);
})();
