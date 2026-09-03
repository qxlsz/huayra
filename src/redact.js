export const SECRET_ENV_KEYS = Object.freeze([
  "XAI_API_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "HUAYRA_HOST_PHRASE",
]);

export function redactSecrets(text, env = process.env) {
  let out = String(text ?? "");
  for (const key of SECRET_ENV_KEYS) {
    const value = env?.[key];
    if (typeof value === "string" && value.length > 0) {
      out = out.split(value).join("[redacted]");
    }
  }
  return out;
}

export function assertNoSecrets(text, env = process.env) {
  const redacted = redactSecrets(text, env);
  if (redacted !== String(text ?? "")) {
    throw new Error("refusing to emit secret material");
  }
  return redacted;
}
