// lib/cost-calculator.ts
// Calculates the USD cost of a single LLM API call given token usage counts
// and the model ID. Formula (per the spec):
//
//   cost = (input_tokens / 1_000_000 × input_price)
//        + (output_tokens / 1_000_000 × output_price)
//        + (cache_write_tokens / 1_000_000 × cache_write_price)
//        + (cache_read_tokens / 1_000_000 × cache_read_price)
//
// Note: For OpenAI, cache_write_tokens is always 0 (caching is automatic, no
// explicit write charge). cache_read_tokens maps to usage.prompt_tokens_details.cached_tokens.

import { getModelPricing } from "./model-pricing";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number; // Anthropic: cache_creation_input_tokens
  cacheReadTokens: number;  // Anthropic: cache_read_input_tokens / OpenAI: cached_tokens
};

export type CostBreakdown = {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
};

/**
 * Calculates the USD cost breakdown for a single LLM API call.
 * Returns all zeroes if the model is not found in the pricing table.
 */
export function calculateCost(modelId: string, usage: TokenUsage): CostBreakdown {
  const pricing = getModelPricing(modelId);

  if (!pricing) {
    console.warn(`[cost-calculator] Unknown model: ${modelId}. Cost will be reported as $0.`);
    return { inputCost: 0, outputCost: 0, cacheWriteCost: 0, cacheReadCost: 0, totalCost: 0 };
  }

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPricePerMillion;
  const cacheWriteCost = (usage.cacheWriteTokens / 1_000_000) * pricing.cacheWritePricePerMillion;
  const cacheReadCost = (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadPricePerMillion;
  const totalCost = inputCost + outputCost + cacheWriteCost + cacheReadCost;

  return { inputCost, outputCost, cacheWriteCost, cacheReadCost, totalCost };
}

/**
 * Sums an array of CostBreakdowns into a single aggregate.
 */
export function sumCosts(breakdowns: CostBreakdown[]): CostBreakdown {
  return breakdowns.reduce(
    (acc, b) => ({
      inputCost: acc.inputCost + b.inputCost,
      outputCost: acc.outputCost + b.outputCost,
      cacheWriteCost: acc.cacheWriteCost + b.cacheWriteCost,
      cacheReadCost: acc.cacheReadCost + b.cacheReadCost,
      totalCost: acc.totalCost + b.totalCost,
    }),
    { inputCost: 0, outputCost: 0, cacheWriteCost: 0, cacheReadCost: 0, totalCost: 0 }
  );
}

/**
 * Formats a USD cost value for display (e.g. 0.00034 → "$0.000340")
 */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.0001) return `$${usd.toFixed(8)}`;
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(4)}`;
}
