// app/api/chat/route.ts
// ★ CORE AGENT LOOP — ReAct-style multi-step agent with streaming
//
// Architecture:
//   1. Authenticate user, check credits > 0
//   2. Decrypt user's API key for the selected provider
//   3. Build provider-specific model instance
//   4. Run streamText() with:
//      - tools: { web_search } powered by Tavily
//      - stopWhen: isStepCount(8) — hard cap on tool iterations (AI SDK v7)
//      - System prompt with tool descriptions + cache_control for Anthropic
//   5. Stream to client via createUIMessageStreamResponse (AI SDK v7)
//   6. On finish: persist messages + usage_records, deduct 1 credit
//
// Context window: sliding window of last 20 messages per thread.
// TODO: implement summarization of older messages as an alternative strategy.
//
// Credit deduction: 1 credit per user message that triggers a full agent run.

import { NextRequest, NextResponse } from "next/server";
import {
  streamText,
  tool,
  isStepCount,
  zodSchema,
  convertToModelMessages,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { webSearch } from "@/lib/tools/tavily";
import { calculateCost } from "@/lib/cost-calculator";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Pro: 60-second function timeout

const SYSTEM_PROMPT = `You are MicroManus, an expert deep research AI agent. Your goal is to provide thorough, well-researched answers by searching the web for current information.

When answering questions:
1. Use the web_search tool to find relevant, up-to-date information
2. Search multiple times if needed to gather comprehensive data
3. Synthesize information from multiple sources
4. Cite your sources by mentioning the URLs you found information from
5. For complex research tasks, break them into subtopics and search each one
6. Always provide a well-structured, detailed final answer

For reports and long-form analysis:
- Use clear headings (##, ###)
- Include bullet points for key findings
- Summarize sources
- Provide actionable conclusions`;

type Provider = "anthropic" | "openai" | "kimi" | "gemini" | "groq";

async function getUserApiKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  provider: string
): Promise<string | null> {
  const { data } = await supabase
    .from("api_keys")
    .select("encrypted_key, iv, auth_tag")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (!data) return null;

  try {
    return decrypt({ ciphertext: data.encrypted_key, iv: data.iv, authTag: data.auth_tag });
  } catch {
    return null;
  }
}

function buildModel(provider: Provider, modelId: string, apiKey: string) {
  if (provider === "anthropic") {
    const anthropic = createAnthropic({ apiKey });
    return anthropic(modelId);
  }
  if (provider === "openai") {
    const openai = createOpenAI({ apiKey });
    return openai(modelId);
  }
  if (provider === "kimi") {
    // Kimi uses OpenAI-compatible API at a different base URL
    const kimi = createOpenAI({
      apiKey,
      baseURL: "https://api.moonshot.ai/v1",
    });
    return kimi(modelId);
  }
  if (provider === "gemini") {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(modelId);
  }
  if (provider === "groq") {
    const groq = createGroq({ apiKey });
    return groq(modelId);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Check credits ---
  const { data: userData } = await supabase
    .from("users")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (!userData || userData.credits <= 0) {
    return NextResponse.json(
      { error: "Insufficient credits. Please purchase more to continue." },
      { status: 402 }
    );
  }

  // --- Parse request ---
  const { chatId, messages, modelId, provider } = (await req.json()) as {
    chatId: string;
    messages: any[]; // UIMessages from DefaultChatTransport (have .parts)
    modelId: string;
    provider: Provider;
  };

  if (!chatId || !messages || !modelId || !provider) {
    console.error("[chat] Missing required fields:", { chatId: !!chatId, messages: !!messages, modelId, provider });
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  console.log("[chat] Request:", { provider, modelId, msgCount: messages.length, chatId });

  // --- Validate chat belongs to user ---
  const { data: chat } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .single();

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // --- Decrypt API key ---
  const apiKey = await getUserApiKey(supabase, user.id, provider);
  if (!apiKey) {
    return NextResponse.json(
      { error: `No API key found for ${provider}. Please add your key in Settings.` },
      { status: 400 }
    );
  }

  // --- Build model instance ---
  let model: ReturnType<typeof buildModel>;
  try {
    model = buildModel(provider, modelId, apiKey);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  // Context window: last 20 messages to stay within context limits
  const windowedMessages = messages.slice(-20);

  // --- Persist user message ---
  const lastUserMsg = windowedMessages[windowedMessages.length - 1];
  if (lastUserMsg?.role === "user") {
    // UIMessages store text in parts[]; fall back to content string for legacy msgs
    const extractText = (msg: any): string => {
      if (Array.isArray(msg.parts)) {
        return msg.parts
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text ?? "")
          .join("");
      }
      return typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    };

    const userText = extractText(lastUserMsg);

    await supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: userText,
    });

    // Auto-title thread on first user message
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", chatId)
      .eq("role", "user");

    if (count === 1) {
      const title = userText.slice(0, 60).trim();
      if (title) await supabase.from("chats").update({ title }).eq("id", chatId);
    }
  }

  // --- Run the agent loop ---
  // convertToModelMessages is async in AI SDK v7 — must await!
  let coreMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    coreMessages = await convertToModelMessages(windowedMessages);
    console.log("[chat] Converted", windowedMessages.length, "UIMessages to", coreMessages.length, "core messages");
  } catch (err) {
    console.error("[chat] convertToModelMessages failed:", err);
    return NextResponse.json({ error: "Failed to process messages" }, { status: 500 });
  }

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: coreMessages,
    // AI SDK v7: stopWhen = max 8 LLM calls total (including tool-use cycles)
    stopWhen: isStepCount(8),
    tools: {
      web_search: tool({
        description:
          "Search the web for current information. Use this for facts, news, data, and any information that may have changed recently.",
        parameters: zodSchema(z.object({
          query: z.string().describe("The search query — be specific and targeted"),
        })),
        execute: async ({ query }: any) => {
          const response = await webSearch(query);
          return {
            query: response.query,
            results: response.results,
            provider: response.provider,
          };
        },
      } as any),
    },
    onFinish: async ({ text, usage, steps }) => {
      // AI SDK v7 usage fields
      const totalInputTokens =
        (usage as any)?.inputTokens ?? (usage as any)?.promptTokens ?? 0;
      const totalOutputTokens =
        (usage as any)?.outputTokens ?? (usage as any)?.completionTokens ?? 0;
      let totalCacheWriteTokens = 0;
      let totalCacheReadTokens = 0;

      for (const step of steps ?? []) {
        const meta = (step as any).providerMetadata;
        if (meta?.anthropic) {
          totalCacheWriteTokens += meta.anthropic.cacheCreationInputTokens ?? 0;
          totalCacheReadTokens += meta.anthropic.cacheReadInputTokens ?? 0;
        }
        if (meta?.openai?.cachedPromptTokens) {
          totalCacheReadTokens += meta.openai.cachedPromptTokens;
        }
      }

      // Persist assistant message
      if (text) {
        await supabase.from("messages").insert({
          chat_id: chatId,
          role: "assistant",
          content: text,
        });
      }

      // Persist tool call/result messages
      for (const step of steps ?? []) {
        if (step.toolCalls?.length) {
          await supabase.from("messages").insert({
            chat_id: chatId,
            role: "tool",
            content: "",
            tool_calls: step.toolCalls as any,
            tool_result: step.toolResults as any,
          });
        }
      }

      // Record cost
      const costBreakdown = calculateCost(modelId, {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheWriteTokens: totalCacheWriteTokens,
        cacheReadTokens: totalCacheReadTokens,
      });

      await supabase.from("usage_records").insert({
        user_id: user.id,
        chat_id: chatId,
        model: modelId,
        provider,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        cache_write_tokens: totalCacheWriteTokens,
        cache_read_tokens: totalCacheReadTokens,
        cost_usd: costBreakdown.totalCost,
      });

      // Deduct 1 credit atomically
      await supabase.rpc("decrement_credits", { user_id_input: user.id });
    },
  });

  // AI SDK v7: use the built-in method which correctly wires stream + tools
  return result.toUIMessageStreamResponse();

  } catch (err) {
    console.error("[chat] Unhandled error in POST handler:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
