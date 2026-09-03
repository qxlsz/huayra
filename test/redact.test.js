import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNoSecrets, redactSecrets } from "../src/redact.js";

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
