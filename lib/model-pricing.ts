// lib/model-pricing.ts
// Source: Anthropic pricing page, OpenAI pricing page, Moonshot AI platform
// Last verified: July 2026
// Update this file whenever provider pricing changes.

export type ModelPricing = {
  provider: "anthropic" | "openai" | "kimi" | "gemini" | "groq";
  modelId: string;
  displayName: string;
  inputPricePerMillion: number;   // USD per 1M input tokens
  outputPricePerMillion: number;  // USD per 1M output tokens
  cacheWritePricePerMillion: number; // USD per 1M cache-write tokens (0 if unsupported)
  cacheReadPricePerMillion: number;  // USD per 1M cache-read tokens (0 if unsupported)
  supportsPromptCaching: boolean;
  supportsToolCalling: boolean;
};

// Anthropic: Cache write = 1.25x input price, Cache read = 0.1x input price
// Source: https://www.anthropic.com/pricing — July 2026
// OpenAI: Cached input = 50% of input price (automatic, no explicit write cost)
// Source: https://openai.com/api/pricing — July 2026
// Kimi: Moonshot AI pricing from https://platform.moonshot.ai/docs/pricing — July 2026
// Gemini: From https://ai.google.dev/pricing — July 2026

export const MODEL_PRICING: ModelPricing[] = [
  // ── Anthropic ──────────────────────────────────────────────────────────────
  {
    provider: "anthropic",
    modelId: "claude-opus-4-5",
    displayName: "Claude Opus 4.5",
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
    cacheWritePricePerMillion: 18.75, // 1.25 × $15.00
    cacheReadPricePerMillion: 1.50,   // 0.10 × $15.00
    supportsPromptCaching: true,
    supportsToolCalling: true,
  },
  {
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheWritePricePerMillion: 3.75,  // 1.25 × $3.00
    cacheReadPricePerMillion: 0.30,   // 0.10 × $3.00
    supportsPromptCaching: true,
    supportsToolCalling: true,
  },
  {
    provider: "anthropic",
    modelId: "claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    inputPricePerMillion: 1.0,
    outputPricePerMillion: 5.0,
    cacheWritePricePerMillion: 1.25,  // 1.25 × $1.00
    cacheReadPricePerMillion: 0.10,   // 0.10 × $1.00
    supportsPromptCaching: true,
    supportsToolCalling: true,
  },

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  {
    provider: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10.0,
    cacheWritePricePerMillion: 0,     // OpenAI caching is automatic — no explicit write cost
    cacheReadPricePerMillion: 1.25,   // 50% of input price for cached tokens
    supportsPromptCaching: true,
    supportsToolCalling: true,
  },
  {
    provider: "openai",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0.075,  // 50% of $0.15
    supportsPromptCaching: true,
    supportsToolCalling: true,
  },
  {
    provider: "openai",
    modelId: "o3-mini",
    displayName: "o3-mini",
    inputPricePerMillion: 1.10,
    outputPricePerMillion: 4.40,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0.55,   // 50% of $1.10
    supportsPromptCaching: true,
    supportsToolCalling: true,
  },
  {
    provider: "openai",
    modelId: "o4-mini",
    displayName: "o4-mini",
    inputPricePerMillion: 1.10,
    outputPricePerMillion: 4.40,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0.275,  // 25% of $1.10
    supportsPromptCaching: true,
    supportsToolCalling: true,
  },

  // ── Kimi (Moonshot AI) ─────────────────────────────────────────────────────
  // Source: https://platform.moonshot.ai/docs/pricing/billing — July 2026
  // Prices in CNY converted at ~7.25 CNY/USD: ¥0.012/1k = $1.66/M tokens
  {
    provider: "kimi",
    modelId: "moonshot-v1-8k",
    displayName: "Kimi Moonshot 8K",
    inputPricePerMillion: 1.66,
    outputPricePerMillion: 1.66,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    supportsPromptCaching: false,
    supportsToolCalling: true,
  },
  {
    provider: "kimi",
    modelId: "moonshot-v1-32k",
    displayName: "Kimi Moonshot 32K",
    inputPricePerMillion: 3.31,
    outputPricePerMillion: 3.31,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    supportsPromptCaching: false,
    supportsToolCalling: true,
  },
  {
    provider: "kimi",
    modelId: "moonshot-v1-128k",
    displayName: "Kimi Moonshot 128K",
    inputPricePerMillion: 8.29,
    outputPricePerMillion: 8.29,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    supportsPromptCaching: false,
    supportsToolCalling: true,
  },

  // ── Gemini ─────────────────────────────────────────────────────────────────
  {
    provider: "gemini",
    modelId: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    supportsPromptCaching: false,
    supportsToolCalling: true,
  },
  {
    provider: "gemini",
    modelId: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    inputPricePerMillion: 3.50,
    outputPricePerMillion: 10.50,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    supportsPromptCaching: false,
    supportsToolCalling: true,
  },
  {
    provider: "gemini",
    modelId: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash",
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    supportsPromptCaching: false,
    supportsToolCalling: true,
  },

  // ── Groq ───────────────────────────────────────────────────────────────────
  {
    provider: "groq",
    modelId: "llama-3.3-70b-versatile",
    displayName: "Llama 3.3 70B (Groq)",
    inputPricePerMillion: 0.59,
    outputPricePerMillion: 0.79,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    supportsPromptCaching: false,
    supportsToolCalling: true,
  },
  {
    provider: "groq",
    modelId: "llama-3.1-8b-instant",
    displayName: "Llama 3.1 8B (Groq)",
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.08,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    supportsPromptCaching: false,
    supportsToolCalling: true,
  },
  {
    provider: "groq",
    modelId: "mixtral-8x7b-32768",
    displayName: "Mixtral 8x7B (Groq)",
    inputPricePerMillion: 0.24,
    outputPricePerMillion: 0.24,
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    supportsPromptCaching: false,
    supportsToolCalling: false,
  },
];

export function getModelPricing(modelId: string): ModelPricing | undefined {
  return MODEL_PRICING.find((m) => m.modelId === modelId);
}

export function getProviderModels(provider: ModelPricing["provider"]): ModelPricing[] {
  return MODEL_PRICING.filter((m) => m.provider === provider);
}
