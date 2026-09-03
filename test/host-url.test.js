import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_HUAYRA_URL, resolveHuayraUrl } from "../src/host-url.js";

test("defaults to the local Docker / Electron port", () => {
  assert.equal(DEFAULT_HUAYRA_URL, "http://127.0.0.1:8080");
  assert.equal(resolveHuayraUrl({}), DEFAULT_HUAYRA_URL);
  assert.equal(resolveHuayraUrl({ HUAYRA_URL: "" }), DEFAULT_HUAYRA_URL);
  assert.equal(resolveHuayraUrl({ HUAYRA_URL: "   " }), DEFAULT_HUAYRA_URL);
});

test("uses HUAYRA_URL when set", () => {
  assert.equal(
    resolveHuayraUrl({ HUAYRA_URL: "https://huayra.example" }),
    "https://huayra.example",
  );
  assert.equal(
    resolveHuayraUrl({ HUAYRA_URL: "  https://huayra.example/  " }),
    "https://huayra.example/",
  );
});
