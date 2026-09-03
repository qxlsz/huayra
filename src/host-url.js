export const DEFAULT_HUAYRA_URL = "http://127.0.0.1:8080";

export function resolveHuayraUrl(env = process.env) {
  const raw = env?.HUAYRA_URL;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return DEFAULT_HUAYRA_URL;
}
