import assert from "node:assert/strict";
import { test } from "node:test";
import { SECRET_ENV_KEYS, assertNoSecrets, redactSecrets } from "../src/redact.js";

test("redacts known secret env values", () => {
  const env = {
    XAI_API_KEY: "xai-secret-value",
    OPENAI_API_KEY: "sk-test",
    HUAYRA_HOST_PHRASE: "gate-phrase",
  };
  const text = "key=xai-secret-value token=sk-test phrase=gate-phrase ok";
  assert.equal(redactSecrets(text, env), "key=[redacted] token=[redacted] phrase=[redacted] ok");
});

test("assertNoSecrets throws when a key would leak", () => {
  const env = { XAI_API_KEY: "leak-me" };
  assert.equal(assertNoSecrets("clean log", env), "clean log");
  assert.throws(() => assertNoSecrets("using leak-me", env), /secret material/);
});

test("leaves text alone when secrets are missing or empty", () => {
  assert.deepEqual([...SECRET_ENV_KEYS], [
    "XAI_API_KEY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "HUAYRA_HOST_PHRASE",
  ]);
  const text = "XAI_API_KEY=visible-name-only";
  assert.equal(redactSecrets(text, {}), text);
  assert.equal(redactSecrets(text, { XAI_API_KEY: "" }), text);
  assert.equal(redactSecrets(null, { XAI_API_KEY: "x" }), "");
  assert.equal(assertNoSecrets(undefined, {}), "");
});

test("redacts every occurrence of each known key", () => {
  const env = {
    OPENROUTER_API_KEY: "or-secret",
    XAI_API_KEY: "xai-secret-value",
  };
  assert.equal(
    redactSecrets("or-secret then or-secret and xai-secret-value", env),
    "[redacted] then [redacted] and [redacted]",
  );
});
