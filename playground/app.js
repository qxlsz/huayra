(async function () {
  const b64 = "PLACEHOLDER";
  const bin = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bin]).stream().pipeThrough(ds);
  const text = await new Response(stream).text();
  (0, eval)(text);
})();
