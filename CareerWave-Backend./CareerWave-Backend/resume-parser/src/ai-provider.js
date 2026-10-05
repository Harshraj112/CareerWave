/**
 * ai-provider.js — single place where Career Wave talks to an LLM.
 *
 * Switch providers with one env var (server-side only, never in the frontend):
 *
 *   AI_PROVIDER=agentrouter   ← ACTIVE default for testing (model: claude-opus-4.8)
 *   AI_PROVIDER=openrouter    ← original Hecknex provider, kept intact as the alternative
 *   AI_PROVIDER=mock          ← deterministic offline responses for tests / demos
 *
 * AgentRouter exposes two wire formats on the same key:
 *   - Anthropic Messages:  POST {AGENTROUTER_BASE_URL}/v1/messages          (AGENTROUTER_API_STYLE=anthropic, default)
 *   - OpenAI Chat:         POST {AGENTROUTER_BASE_URL}/v1/chat/completions  (AGENTROUTER_API_STYLE=openai)
 *
 * Callers pass provider-neutral messages:
 *   { role: "system" | "user" | "assistant", content: string | Part[] }
 *   Part = { type: "text", text } | { type: "image", mimeType, base64 }
 */

const DEFAULTS = {
  agentrouter: {
    baseUrl: "https://agentrouter.org",
    model: "claude-opus-4.8",
    apiStyle: "anthropic",
  },
  openrouter: {
    // Original values from parser.js — unchanged.
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-6-luna",
  },
};

export function getProviderName() {
  return (process.env.AI_PROVIDER || "agentrouter").trim().toLowerCase();
}

export function getProviderConfig() {
  const provider = getProviderName();

  if (provider === "openrouter") {
    return {
      provider,
      apiKey: process.env.OPENROUTER_API_KEY || "",
      baseUrl: (process.env.OPENROUTER_BASE_URL || DEFAULTS.openrouter.baseUrl).replace(/\/+$/, ""),
      model: process.env.OPENROUTER_MODEL || DEFAULTS.openrouter.model,
      apiStyle: "openai",
    };
  }

  if (provider === "mock") {
    return { provider, apiKey: "mock", baseUrl: "", model: "mock", apiStyle: "mock" };
  }

  return {
    provider: "agentrouter",
    apiKey: process.env.AGENTROUTER_API_KEY || "",
    baseUrl: (process.env.AGENTROUTER_BASE_URL || DEFAULTS.agentrouter.baseUrl).replace(/\/+$/, ""),
    model: process.env.AGENTROUTER_MODEL || DEFAULTS.agentrouter.model,
    apiStyle: (process.env.AGENTROUTER_API_STYLE || DEFAULTS.agentrouter.apiStyle).toLowerCase(),
  };
}

/** Public, non-secret description of the active provider (safe to log / expose on /health). */
export function describeProvider() {
  const cfg = getProviderConfig();
  return { provider: cfg.provider, model: cfg.model, apiStyle: cfg.apiStyle, configured: isProviderConfigured() };
}

export function isProviderConfigured() {
  const cfg = getProviderConfig();
  return cfg.provider === "mock" || Boolean(cfg.apiKey);
}

export function assertProviderConfigured() {
  if (!isProviderConfigured()) {
    const cfg = getProviderConfig();
    const keyName = cfg.provider === "openrouter" ? "OPENROUTER_API_KEY" : "AGENTROUTER_API_KEY";
    const err = new Error(`AI provider "${cfg.provider}" is not configured: set ${keyName} in the backend .env`);
    err.code = "AI_NOT_CONFIGURED";
    err.status = 503;
    throw err;
  }
}

function parseExtraHeaders() {
  const raw = process.env.AGENTROUTER_EXTRA_HEADERS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.warn("[ai-provider] AGENTROUTER_EXTRA_HEADERS is not valid JSON; ignoring");
    return {};
  }
}

// ── Message format adapters ──────────────────────────────────────────────────

function toOpenAIContent(content) {
  if (typeof content === "string") return content;
  return content.map((part) =>
    part.type === "image"
      ? { type: "image_url", image_url: { url: `data:${part.mimeType};base64,${part.base64}` } }
      : { type: "text", text: part.text }
  );
}

function toAnthropicContent(content) {
  if (typeof content === "string") return content;
  return content.map((part) =>
    part.type === "image"
      ? { type: "image", source: { type: "base64", media_type: part.mimeType, data: part.base64 } }
      : { type: "text", text: part.text }
  );
}

async function readError(response) {
  const text = await response.text().catch(() => "");
  return text.slice(0, 600);
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function callOpenAIStyle(cfg, messages, { temperature, maxTokens, json }) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.provider === "openrouter") {
    // Same attribution headers the original OpenRouter implementation sent.
    headers["HTTP-Referer"] = "https://hecknex-resume-parser.app";
    headers["X-Title"] = "Hecknex Resume Parser";
  } else {
    Object.assign(headers, parseExtraHeaders());
  }

  // OpenRouter's base already ends in /api/v1; AgentRouter's base is the bare host.
  const url = cfg.provider === "openrouter" ? `${cfg.baseUrl}/chat/completions` : `${cfg.baseUrl}/v1/chat/completions`;

  const body = {
    model: cfg.model,
    messages: messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
    temperature,
    max_tokens: maxTokens,
  };
  if (json && (cfg.provider === "openrouter" || process.env.AGENTROUTER_JSON_MODE === "true")) {
    body.response_format = { type: "json_object" };
  }

  const timer = withTimeout(Number(process.env.AI_TIMEOUT_MS || 180000));
  try {
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: timer.signal });
    if (!response.ok) {
      const err = new Error(`${cfg.provider} API error (${response.status}): ${await readError(response)}`);
      err.status = 502;
      err.upstreamStatus = response.status;
      throw err;
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw Object.assign(new Error(`Invalid response format from ${cfg.provider}`), { status: 502 });
    return typeof text === "string" ? text : text.map((p) => p.text || "").join("");
  } finally {
    timer.done();
  }
}

async function callAnthropicStyle(cfg, messages, { temperature, maxTokens }) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => p.text || "").join("\n")))
    .join("\n\n");
  const chat = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: toAnthropicContent(m.content) }));

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": cfg.apiKey,
    Authorization: `Bearer ${cfg.apiKey}`,
    "anthropic-version": process.env.AGENTROUTER_ANTHROPIC_VERSION || "2023-06-01",
    ...parseExtraHeaders(),
  };

  const body = { model: cfg.model, max_tokens: maxTokens, temperature, messages: chat };
  if (system) body.system = system;

  const timer = withTimeout(Number(process.env.AI_TIMEOUT_MS || 180000));
  try {
    const response = await fetch(`${cfg.baseUrl}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: timer.signal,
    });
    if (!response.ok) {
      const err = new Error(`agentrouter API error (${response.status}): ${await readError(response)}`);
      err.status = 502;
      err.upstreamStatus = response.status;
      throw err;
    }
    const data = await response.json();
    const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    if (!text) throw Object.assign(new Error("Invalid response format from agentrouter"), { status: 502 });
    return text;
  } finally {
    timer.done();
  }
}

let mockHandler = null;
/** Tests / demo: register a function (messages, options) => string used when AI_PROVIDER=mock. */
export function setMockHandler(fn) {
  mockHandler = fn;
}

/**
 * Send a chat request to the active provider and return the raw text reply.
 * @param {Array} messages provider-neutral messages
 * @param {{ temperature?: number, maxTokens?: number, json?: boolean, task?: string }} options
 */
export async function chat(messages, options = {}) {
  const opts = { temperature: 0, maxTokens: Number(process.env.AI_MAX_TOKENS || 8000), json: true, ...options };
  const cfg = getProviderConfig();

  if (cfg.provider === "mock") {
    if (!mockHandler) throw Object.assign(new Error("AI_PROVIDER=mock but no mock handler registered"), { status: 503 });
    return mockHandler(messages, opts);
  }

  assertProviderConfigured();
  console.log(`🔄 [ai] ${opts.task || "request"} → ${cfg.provider} (${cfg.model}, ${cfg.apiStyle})`);

  if (cfg.apiStyle === "anthropic") return callAnthropicStyle(cfg, messages, opts);
  return callOpenAIStyle(cfg, messages, opts);
}

/**
 * Pull a JSON object out of an LLM reply. Claude-family models usually obey
 * "JSON only", but may still wrap it in ``` fences or add a sentence.
 */
export function extractJson(text) {
  if (text && typeof text === "object") return text;
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* fall through */
    }
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      /* fall through */
    }
  }
  const err = new Error("AI response was not valid JSON");
  err.status = 502;
  err.raw = raw.slice(0, 400);
  throw err;
}

/** chat() + extractJson() in one call. */
export async function chatJson(messages, options = {}) {
  const text = await chat(messages, { ...options, json: true });
  return extractJson(text);
}
