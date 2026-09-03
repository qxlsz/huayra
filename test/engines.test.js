import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CHAT_COMPLETIONS_PATH,
  ENGINE_PRESETS,
  OPENCODE_DEFAULT_URL,
  PROVIDERS,
  chatCompletionsUrl,
  isKnownProvider,
  isLocalEngineUrl,
  resolveEngine,
  resolvePreset,
} from "../src/engines.js";

test("providers match the fork contract", () => {
  assert.deepEqual([...PROVIDERS], ["demo", "grok", "opencode", "cursor", "custom"]);
});

test("OpenCode default matches AGENTS.md", () => {
  assert.equal(OPENCODE_DEFAULT_URL, "http://127.0.0.1:4096");
});

test("documented presets keep their hosts and Grok model", () => {
  assert.equal(ENGINE_PRESETS.grok.baseUrl, "https://api.x.ai/v1");
  assert.equal(ENGINE_PRESETS.grok.model, "grok-4.5");
  assert.equal(ENGINE_PRESETS.ollama.baseUrl, "http://127.0.0.1:11434/v1");
  assert.equal(ENGINE_PRESETS["lm-studio"].baseUrl, "http://127.0.0.1:1234/v1");
  assert.equal(ENGINE_PRESETS.cursor.baseUrl, "http://127.0.0.1:8008/v1");
  assert.equal(ENGINE_PRESETS.vllm.baseUrl, null);
});

test("docs/engines.md stays aligned with coded presets", () => {
  const docs = readFileSync(new URL("../docs/engines.md", import.meta.url), "utf8");
  assert.match(docs, /https:\/\/api\.x\.ai\/v1/);
  assert.match(docs, /grok-4\.5/);
  assert.match(docs, /http:\/\/127\.0\.0\.1:11434\/v1/);
  assert.match(docs, /http:\/\/127\.0\.0\.1:1234\/v1/);
  assert.match(docs, /http:\/\/127\.0\.0\.1:8008\/v1/);
  assert.match(docs, /\/v1\/chat\/completions/);
});

test("resolveEngine covers built-in providers", () => {
  assert.equal(resolveEngine().provider, "demo");
  assert.equal(resolveEngine({ provider: "demo" }).baseUrl, null);

  const grok = resolveEngine({ provider: "grok" });
  assert.equal(grok.baseUrl, "https://api.x.ai/v1");
  assert.equal(grok.model, "grok-4.5");
  assert.equal(grok.local, false);
  assert.equal(grok.chatPath, CHAT_COMPLETIONS_PATH);
  assert.equal("apiKey" in grok, false);

  const opencode = resolveEngine({ provider: "opencode" });
  assert.equal(opencode.baseUrl, OPENCODE_DEFAULT_URL);
  assert.equal(opencode.local, true);

  const cursor = resolveEngine({ provider: "cursor" });
  assert.equal(cursor.baseUrl, ENGINE_PRESETS.cursor.baseUrl);
  assert.equal(cursor.local, true);
});

test("custom engines require base URL and model", () => {
  assert.throws(() => resolveEngine({ provider: "custom" }), /baseUrl and model/);
  assert.throws(() => resolveEngine({ provider: "custom", baseUrl: "http://127.0.0.1:8000/v1" }), /baseUrl and model/);

  const engine = resolveEngine({
    provider: "custom",
    baseUrl: "http://127.0.0.1:8000/v1/",
    model: "local-model",
  });
  assert.equal(engine.baseUrl, "http://127.0.0.1:8000/v1");
  assert.equal(engine.model, "local-model");
  assert.equal(engine.local, true);
});

test("unknown providers and presets are rejected", () => {
  assert.throws(() => resolveEngine({ provider: "mystery" }), /Unknown provider/);
  assert.throws(() => resolvePreset("mystery"), /Unknown engine preset/);
  assert.deepEqual(resolvePreset("grok").baseUrl, ENGINE_PRESETS.grok.baseUrl);
});

test("localhost engines are marked local", () => {
  assert.equal(isLocalEngineUrl("http://127.0.0.1:11434/v1"), true);
  assert.equal(isLocalEngineUrl("http://localhost:1234/v1"), true);
  assert.equal(isLocalEngineUrl("https://api.x.ai/v1"), false);
  assert.equal(isLocalEngineUrl("not a url"), false);
});

test("chat completions URLs stay OpenAI-compatible", () => {
  assert.equal(chatCompletionsUrl("https://api.x.ai/v1"), "https://api.x.ai/v1/chat/completions");
  assert.equal(
    chatCompletionsUrl("https://api.x.ai/v1/chat/completions"),
    "https://api.x.ai/v1/chat/completions",
  );
  assert.equal(chatCompletionsUrl("http://127.0.0.1:8000"), "http://127.0.0.1:8000/v1/chat/completions");
  assert.equal(chatCompletionsUrl("  https://api.x.ai/v1///  "), "https://api.x.ai/v1/chat/completions");
  assert.throws(() => chatCompletionsUrl(""), /baseUrl required/);
  assert.throws(() => chatCompletionsUrl("   "), /baseUrl required/);
});

test("isKnownProvider and named presets stay complete", () => {
  assert.equal(isKnownProvider("demo"), true);
  assert.equal(isKnownProvider("custom"), true);
  assert.equal(isKnownProvider("openai"), false);
  assert.equal(resolvePreset("openai").baseUrl, "https://api.openai.com/v1");
  assert.equal(resolvePreset("openrouter").baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(resolvePreset("vllm").baseUrl, null);
  const copy = resolvePreset("ollama");
  copy.baseUrl = "mutated";
  assert.equal(ENGINE_PRESETS.ollama.baseUrl, "http://127.0.0.1:11434/v1");
});

test("overrides do not leak keys or flip remote hosts to local", () => {
  const grok = resolveEngine({
    provider: "grok",
    model: "grok-custom",
    baseUrl: "https://api.x.ai/v1/",
    apiKey: "should-not-copy",
  });
  assert.equal(grok.model, "grok-custom");
  assert.equal(grok.local, false);
  assert.equal("apiKey" in grok, false);

  const remoteOpen = resolveEngine({
    provider: "opencode",
    baseUrl: "https://opencode.example/v1",
    model: "remote-open",
  });
  assert.equal(remoteOpen.local, false);
  assert.equal(remoteOpen.model, "remote-open");

  const remoteCursor = resolveEngine({
    provider: "cursor",
    baseUrl: "https://proxy.example/v1",
  });
  assert.equal(remoteCursor.local, false);

  const demo = resolveEngine({ provider: "demo", model: "offline-harness" });
  assert.equal(demo.model, "offline-harness");
  assert.equal(demo.local, true);
});

test("custom remote engines and whitespace fields", () => {
  assert.throws(() => resolveEngine({ provider: "custom", baseUrl: "  ", model: "m" }), /baseUrl and model/);
  assert.throws(() => resolveEngine({ provider: "custom", baseUrl: "https://api.example/v1", model: "  " }), /baseUrl and model/);
  const remote = resolveEngine({
    provider: "custom",
    baseUrl: "https://api.example/v1/",
    model: "acct/model",
  });
  assert.equal(remote.baseUrl, "https://api.example/v1");
  assert.equal(remote.local, false);
  assert.equal(isLocalEngineUrl("http://[::1]:11434/v1"), true);
});
