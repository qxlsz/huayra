import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { shouldAutoTitle, titleFromPrompt } from "../src/session-title.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("titleFromPrompt slugs the first line and drops empties", () => {
  assert.equal(titleFromPrompt(""), "");
  assert.equal(titleFromPrompt("   \n"), "");
  assert.equal(titleFromPrompt("fix the session bar"), "fix the session bar");
  assert.equal(titleFromPrompt("  two   spaces  "), "two spaces");
  const long = "rewrite the OpenCode attach probe so live hosts win over the mock when both answer";
  const titled = titleFromPrompt(long);
  assert.ok(titled.length <= 40);
  assert.ok(titled.startsWith("rewrite the OpenCode"));
  assert.doesNotMatch(titled, /\s$/);
});

test("shouldAutoTitle only rewrites default session N labels", () => {
  assert.equal(shouldAutoTitle(""), true);
  assert.equal(shouldAutoTitle(null), true);
  assert.equal(shouldAutoTitle("session 1"), true);
  assert.equal(shouldAutoTitle("Session 12"), true);
  assert.equal(shouldAutoTitle("fix the session bar"), false);
  assert.equal(shouldAutoTitle("index seed"), false);
});

test("playground wires auto-title after the remote session exists", async () => {
  const src = await readFile(join(root, "playground", "app.js"), "utf8");
  assert.match(src, /function titleFromPrompt/);
  assert.match(src, /function shouldAutoTitle/);
  assert.match(src, /async function autoTitleFromPrompt/);
  assert.match(src, /await autoTitleFromPrompt\(text\)/);
  assert.match(src, /renameRemoteSession/);
});
