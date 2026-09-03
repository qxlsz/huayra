import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(rel) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

test("Electron host uses the shared URL helper", () => {
  const main = read("../packaging/electron/main.mjs");
  assert.match(main, /from "\.\.\/\.\.\/src\/host-url\.js"/);
  assert.match(main, /resolveHuayraUrl/);
  assert.match(main, /backgroundColor: "#11111b"/);
});

test("Docker and compose keep the console on 8080 without printing secrets", () => {
  const dockerfile = read("../packaging/Dockerfile");
  const compose = read("../packaging/docker-compose.yml");
  assert.match(dockerfile, /EXPOSE 8080/);
  assert.match(dockerfile, /npm run build/);
  assert.match(dockerfile, /CMD \["npm", "run", "preview"/);
  assert.match(compose, /"8080:8080"/);
  assert.match(compose, /XAI_API_KEY: \$\{XAI_API_KEY:-\}/);
  assert.doesNotMatch(compose, /echo .*XAI_API_KEY/);
  assert.doesNotMatch(dockerfile, /echo .*XAI_API_KEY/);
});

test("playground stays a dark static shell", () => {
  const html = read("../playground/index.html");
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /lang="en"/);
  assert.match(html, /<title>Huayra playground<\/title>/);
});

test("LICENSE keeps upstream MIT credit", () => {
  const license = read("../LICENSE");
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 zanneth/);
});
