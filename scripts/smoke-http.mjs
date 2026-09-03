import { setTimeout as delay } from "node:timers/promises";

export async function waitForOk(url, { contains, timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (res.ok && (!contains || text.includes(contains))) {
        return text;
      }
      last = `${res.status} ${text.slice(0, 80)}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await delay(250);
  }
  throw new Error(`smoke failed for ${url}: ${last}`);
}
