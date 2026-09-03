import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassphrase, verifyPassphrase } from "../src/host-gate.js";

test("hashes a passphrase without echoing it", () => {
  const phrase = "host-gate-test-phrase";
  const hash = hashPassphrase(phrase);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]+$/);
  assert.doesNotMatch(hash, /host-gate-test-phrase/);
  assert.equal(hash, hashPassphrase(phrase));
  assert.notEqual(hash, hashPassphrase(`${phrase}-x`));
});

test("verifies hashes and rejects empties", () => {
  const phrase = "another-phrase";
  const hash = hashPassphrase(phrase);
  assert.equal(verifyPassphrase(phrase, hash), true);
  assert.equal(verifyPassphrase(phrase, hash.toUpperCase()), true);
  assert.equal(verifyPassphrase("nope", hash), false);
  assert.equal(verifyPassphrase(phrase, "0".repeat(64)), false);
  assert.equal(verifyPassphrase("", hash), false);
  assert.equal(verifyPassphrase(phrase, "not-a-hash"), false);
  assert.throws(() => hashPassphrase(""), /passphrase required/);
});

test("uses SHA-256 and never returns the phrase", () => {
  assert.equal(
    hashPassphrase("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.throws(() => hashPassphrase(null), /passphrase required/);
  assert.throws(() => hashPassphrase(12), /passphrase required/);
  assert.equal(verifyPassphrase(null, "a".repeat(64)), false);
  assert.equal(verifyPassphrase("abc", null), false);
  assert.equal(verifyPassphrase("abc", "ab".repeat(31)), false);
  assert.equal(verifyPassphrase("abc", `${"a".repeat(64)}0`), false);
});

test("round-trips unicode without putting the phrase in the hash", () => {
  const phrase = "contraseña-π";
  const hash = hashPassphrase(phrase);
  assert.equal(verifyPassphrase(phrase, hash), true);
  assert.doesNotMatch(hash, /contraseña/);
  assert.doesNotMatch(hash, /π/);
});
