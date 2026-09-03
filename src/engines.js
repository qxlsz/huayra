export const PROVIDERS = Object.freeze(["demo", "grok", "opencode", "cursor", "custom"]);

export const OPENCODE_DEFAULT_URL = "http://127.0.0.1:4096";

export const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";

export const ENGINE_PRESETS = Object.freeze({
  grok: Object.freeze({
    id: "grok",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-4.5",
    local: false,
  }),
  openai: Object.freeze({
    id: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: null,
    local: false,
  }),
  openrouter: Object.freeze({
    id: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: null,
    local: false,
  }),
  ollama: Object.freeze({
    id: "ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: null,
    local: true,
  }),
  "lm-studio": Object.freeze({
    id: "lm-studio",
    baseUrl: "http://127.0.0.1:1234/v1",
    model: null,
    local: true,
  }),
  vllm: Object.freeze({
    id: "vllm",
    baseUrl: null,
    model: null,
    local: true,
  }),
  cursor: Object.freeze({
    id: "cursor",
    baseUrl: "http://127.0.0.1:8008/v1",
    model: null,
    local: true,
  }),
});

export function isKnownProvider(id) {
  return PROVIDERS.includes(id);
}

export function isLocalEngineUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}

export function chatCompletionsUrl(baseUrl) {
  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    throw new Error("baseUrl required");
  }
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/v1/chat/completions")) {
    return trimmed;
  }
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}${CHAT_COMPLETIONS_PATH}`;
}

export function resolvePreset(id) {
  const preset = ENGINE_PRESETS[id];
  if (!preset) {
    throw new Error(`Unknown engine preset: ${id}`);
  }
  return { ...preset };
}

export function resolveEngine(input = {}) {
  const provider = input.provider ?? "demo";
  if (!isKnownProvider(provider)) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  if (provider === "demo") {
    return {
      provider,
      baseUrl: null,
      model: input.model || "demo",
      local: true,
      chatPath: CHAT_COMPLETIONS_PATH,
    };
  }

  if (provider === "grok") {
    const preset = resolvePreset("grok");
    return {
      provider,
      baseUrl: input.baseUrl || preset.baseUrl,
      model: input.model || preset.model,
      local: false,
      chatPath: CHAT_COMPLETIONS_PATH,
    };
  }

  if (provider === "opencode") {
    const baseUrl = input.baseUrl || OPENCODE_DEFAULT_URL;
    return {
      provider,
      baseUrl,
      model: input.model || "opencode",
      local: isLocalEngineUrl(baseUrl),
      chatPath: CHAT_COMPLETIONS_PATH,
    };
  }

  if (provider === "cursor") {
    const preset = resolvePreset("cursor");
    const baseUrl = input.baseUrl || preset.baseUrl;
    return {
      provider,
      baseUrl,
      model: input.model || "cursor",
      local: isLocalEngineUrl(baseUrl),
      chatPath: CHAT_COMPLETIONS_PATH,
    };
  }

  const baseUrl = typeof input.baseUrl === "string" ? input.baseUrl.trim() : "";
  const model = typeof input.model === "string" ? input.model.trim() : "";
  if (!baseUrl || !model) {
    throw new Error("custom provider requires baseUrl and model");
  }
  return {
    provider,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
    local: isLocalEngineUrl(baseUrl),
    chatPath: CHAT_COMPLETIONS_PATH,
  };
}
