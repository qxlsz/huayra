import { createHash, timingSafeEqual } from "node:crypto";

export function hashPassphrase(phrase) {
  if (typeof phrase !== "string" || phrase.length === 0) {
    throw new Error("passphrase required");
  }
  return createHash("sha256").update(phrase, "utf8").digest("hex");
}

export function verifyPassphrase(phrase, hash) {
  if (typeof phrase !== "string" || phrase.length === 0) {
    return false;
  }
  if (typeof hash !== "string" || !/^[0-9a-f]{64}$/i.test(hash)) {
    return false;
  }
  const actual = hashPassphrase(phrase);
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(hash.toLowerCase(), "hex"));
}
