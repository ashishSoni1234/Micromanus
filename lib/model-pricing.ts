// lib/model-pricing.ts
// Source: Anthropic pricing page, OpenAI pricing page, Moonshot AI platform
// Last verified: July 2026
// Update this file whenever provider pricing changes.

export type ModelPricing = {
  provider: "anthropic" | "openai" | "kimi";
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
// Kimi: Per-token pricing not publicly available without account login
// Source: https://platform.moonshot.ai — July 2026 (TBD — fill in before production)

export const MODEL_PRICING: ModelPricing[] = [
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
    provider: "kimi",
    modelId: "kimi-k2.6",
    displayName: "Kimi K2.6",
    // TODO: Fill in actual pricing from https://platform.moonshot.ai/pricing
    inputPricePerMillion: 0,  // TBD
    outputPricePerMillion: 0, // TBD
    cacheWritePricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    supportsPromptCaching: false,
    supportsToolCalling: true,
  },
];

export function getModelPricing(modelId: string): ModelPricing | undefined {
  return MODEL_PRICING.find((m) => m.modelId === modelId);
}

export function getProviderModels(provider: ModelPricing["provider"]): ModelPricing[] {
  return MODEL_PRICING.filter((m) => m.provider === provider);
}
