import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { WINDOW_OPTIONS, shouldQuitOnLastWindow } from "../packaging/electron/shell.js";

test("desktop window stays dark and dense without opening a display", () => {
  assert.equal(WINDOW_OPTIONS.width, 1280);
  assert.equal(WINDOW_OPTIONS.height, 800);
  assert.equal(WINDOW_OPTIONS.backgroundColor, "#11111b");
  assert.equal(WINDOW_OPTIONS.autoHideMenuBar, true);
  assert.equal(WINDOW_OPTIONS.title, "Huayra");
  assert.equal(Object.isFrozen(WINDOW_OPTIONS), true);
});

test("last window quits except on macOS", () => {
  assert.equal(shouldQuitOnLastWindow("linux"), true);
  assert.equal(shouldQuitOnLastWindow("win32"), true);
  assert.equal(shouldQuitOnLastWindow("darwin"), false);
});

test("Electron package manifest does not require a display to inspect", () => {
  const pkg = JSON.parse(readFileSync(new URL("../packaging/electron/package.json", import.meta.url), "utf8"));
  assert.equal(pkg.main, "main.mjs");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.scripts.start, "electron .");
  assert.ok(pkg.devDependencies.electron);
});
