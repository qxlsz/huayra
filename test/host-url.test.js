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

test("ignores non-string and missing env values", () => {
  assert.equal(resolveHuayraUrl({ HUAYRA_URL: undefined }), DEFAULT_HUAYRA_URL);
  assert.equal(resolveHuayraUrl({ HUAYRA_URL: null }), DEFAULT_HUAYRA_URL);
  assert.equal(resolveHuayraUrl({ HUAYRA_URL: 8080 }), DEFAULT_HUAYRA_URL);
  assert.equal(resolveHuayraUrl({ HUAYRA_URL: "\n\t" }), DEFAULT_HUAYRA_URL);
});

test("reads process.env when no map is passed", () => {
  const previous = process.env.HUAYRA_URL;
  process.env.HUAYRA_URL = "http://127.0.0.1:9999";
  try {
    assert.equal(resolveHuayraUrl(), "http://127.0.0.1:9999");
  } finally {
    if (previous === undefined) {
      delete process.env.HUAYRA_URL;
    } else {
      process.env.HUAYRA_URL = previous;
    }
  }
});
