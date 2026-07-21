// app/dashboard/page.tsx
// Cost & stats dashboard — per-thread breakdown with token counts and USD costs

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { sumCosts, formatCost, calculateCost } from "@/lib/cost-calculator";
import type { CostBreakdown } from "@/lib/cost-calculator";
import Link from "next/link";

export const metadata = {
  title: "MicroManus — Usage Dashboard",
  description: "View your token usage and cost breakdown per research session.",
};

type UsageRecord = {
  id: string;
  chat_id: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
  created_at: string;
};

type ChatSummary = {
  chatId: string;
  title: string;
  models: string[];
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  lastUsed: string;
};

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CostBar({ input, output, cacheW, cacheR }: { input: number; output: number; cacheW: number; cacheR: number }) {
  const total = input + output + cacheW + cacheR;
  if (total === 0) return <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />;
  const pInput = (input / total) * 100;
  const pOutput = (output / total) * 100;
  const pCacheW = (cacheW / total) * 100;
  const pCacheR = (cacheR / total) * 100;

  return (
    <div className="h-1.5 rounded-full flex overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div style={{ width: `${pInput}%`, background: "#818cf8" }} />
      <div style={{ width: `${pOutput}%`, background: "#c084fc" }} />
      <div style={{ width: `${pCacheW}%`, background: "#34d399" }} />
      <div style={{ width: `${pCacheR}%`, background: "#38bdf8" }} />
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Load all usage records for this user
  const { data: records } = await supabase
    .from("usage_records")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Load chat titles
  const { data: chats } = await supabase
    .from("chats")
    .select("id, title")
    .eq("user_id", user.id);

  const chatTitles: Record<string, string> = {};
  (chats ?? []).forEach((c) => { chatTitles[c.id] = c.title; });

  // Group by chat
  const grouped: Record<string, { records: UsageRecord[]; title: string }> = {};
  (records ?? [] as UsageRecord[]).forEach((r) => {
    if (!grouped[r.chat_id]) {
      grouped[r.chat_id] = { records: [], title: chatTitles[r.chat_id] ?? "Untitled Chat" };
    }
    grouped[r.chat_id].records.push(r as UsageRecord);
  });

  // Build summary per chat
  const chatSummaries: ChatSummary[] = Object.entries(grouped).map(([chatId, { records: recs, title }]) => {
    const models = [...new Set(recs.map((r) => r.model))];
    const inputTokens = recs.reduce((s, r) => s + r.input_tokens, 0);
    const outputTokens = recs.reduce((s, r) => s + r.output_tokens, 0);
    const cacheWriteTokens = recs.reduce((s, r) => s + r.cache_write_tokens, 0);
    const cacheReadTokens = recs.reduce((s, r) => s + r.cache_read_tokens, 0);
    const totalCost = recs.reduce((s, r) => s + Number(r.cost_usd), 0);

    // Recalculate per-type costs from stored token counts
    const breakdowns = recs.map((r) =>
      calculateCost(r.model, {
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        cacheWriteTokens: r.cache_write_tokens,
        cacheReadTokens: r.cache_read_tokens,
      })
    );
    const sum = sumCosts(breakdowns);

    return {
      chatId, title, models,
      inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens,
      inputCost: sum.inputCost,
      outputCost: sum.outputCost,
      cacheWriteCost: sum.cacheWriteCost,
      cacheReadCost: sum.cacheReadCost,
      totalCost: sum.totalCost || totalCost,
      lastUsed: recs[0]?.created_at ?? "",
    };
  });

  // Aggregate totals
  const totals = sumCosts(chatSummaries.map((s) => ({
    inputCost: s.inputCost,
    outputCost: s.outputCost,
    cacheWriteCost: s.cacheWriteCost,
    cacheReadCost: s.cacheReadCost,
    totalCost: s.totalCost,
  })));
  const totalInputTokens = chatSummaries.reduce((s, c) => s + c.inputTokens, 0);
  const totalOutputTokens = chatSummaries.reduce((s, c) => s + c.outputTokens, 0);

  // Total cost bar values for header bar
  const totalCacheWrite = chatSummaries.reduce((s, c) => s + c.cacheWriteCost, 0);
  const totalCacheRead = chatSummaries.reduce((s, c) => s + c.cacheReadCost, 0);

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">Usage Dashboard</h1>
          <p className="text-slate-500 text-sm">Token counts and USD costs across all your research sessions.</p>
        </div>
        <Link href="/chat" className="btn-ghost text-sm">← Back to Chat</Link>
      </div>

      {/* Aggregate stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Sessions", value: chatSummaries.length.toString(), icon: "💬", sub: "conversations" },
          { label: "Total Cost", value: formatCost(totals.totalCost), icon: "💰", sub: "USD spent" },
          { label: "Input Tokens", value: totalInputTokens.toLocaleString(), icon: "📥", sub: "tokens sent" },
          { label: "Output Tokens", value: totalOutputTokens.toLocaleString(), icon: "📤", sub: "tokens received" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <div className="text-2xl mb-3">{stat.icon}</div>
            <div className="text-2xl font-bold text-slate-100 mb-0.5">{stat.value}</div>
            <div className="text-xs text-slate-500">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Cost type breakdown with visual bar */}
      <div className="glass-card p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Cost Breakdown (All Sessions)</h2>
        <CostBar
          input={totals.inputCost}
          output={totals.outputCost}
          cacheW={totals.cacheWriteCost}
          cacheR={totals.cacheReadCost}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {[
            { label: "Input Cost", value: formatCost(totals.inputCost), color: "#818cf8", pct: totals.totalCost > 0 ? ((totals.inputCost / totals.totalCost) * 100).toFixed(0) : "0" },
            { label: "Output Cost", value: formatCost(totals.outputCost), color: "#c084fc", pct: totals.totalCost > 0 ? ((totals.outputCost / totals.totalCost) * 100).toFixed(0) : "0" },
            { label: "Cache Write Cost", value: formatCost(totals.cacheWriteCost), color: "#34d399", pct: totals.totalCost > 0 ? ((totals.cacheWriteCost / totals.totalCost) * 100).toFixed(0) : "0" },
            { label: "Cache Read Cost", value: formatCost(totals.cacheReadCost), color: "#38bdf8", pct: totals.totalCost > 0 ? ((totals.cacheReadCost / totals.totalCost) * 100).toFixed(0) : "0" },
          ].map((item) => (
            <div key={item.label} className="text-center p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">{item.label}</span>
              </div>
              <div className="text-lg font-bold mb-0.5" style={{ color: item.color }}>{item.value}</div>
              <div className="text-[10px] text-slate-600">{item.pct}% of total</div>
            </div>
          ))}
        </div>
        {/* Color legend */}
        <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="text-[10px] text-slate-600">Legend:</span>
          {[
            { label: "Input", color: "#818cf8" },
            { label: "Output", color: "#c084fc" },
            { label: "Cache Write", color: "#34d399" },
            { label: "Cache Read", color: "#38bdf8" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              <span className="text-[10px] text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-thread table */}
      {chatSummaries.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-500 text-sm">
          No usage data yet. Start a research session in the{" "}
          <Link href="/chat" className="text-indigo-400 hover:text-indigo-300 underline">chat</Link>.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold text-slate-300">Per-Session Breakdown</h2>
            <span className="text-xs text-slate-500">{chatSummaries.length} session{chatSummaries.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-400">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
                  <th className="px-4 py-3 font-medium text-slate-300 min-w-[200px]">Session</th>
                  <th className="px-4 py-3 font-medium text-slate-300">Model(s)</th>
                  <th className="px-4 py-3 font-medium text-slate-300 text-right">Tokens In</th>
                  <th className="px-4 py-3 font-medium text-slate-300 text-right">Tokens Out</th>
                  <th className="px-4 py-3 font-medium text-slate-300 text-right">Cache W</th>
                  <th className="px-4 py-3 font-medium text-slate-300 text-right">Cache R</th>
                  <th className="px-4 py-3 font-medium text-slate-300 text-right">Input $</th>
                  <th className="px-4 py-3 font-medium text-slate-300 text-right">Output $</th>
                  <th className="px-4 py-3 font-medium text-slate-300 text-right">Cache $</th>
                  <th className="px-4 py-3 font-medium text-slate-100 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {chatSummaries.map((s) => (
                  <tr key={s.chatId} className="border-b hover:bg-white/[0.02] transition-colors"
                    style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    <td className="px-4 py-3">
                      <Link href={`/chat/${s.chatId}`} className="text-slate-300 hover:text-indigo-400 transition-colors line-clamp-1 max-w-[200px] block font-medium">
                        {s.title}
                      </Link>
                      <div className="mt-1.5">
                        <CostBar
                          input={s.inputCost}
                          output={s.outputCost}
                          cacheW={s.cacheWriteCost}
                          cacheR={s.cacheReadCost}
                        />
                      </div>
                      <span className="text-slate-600 text-[10px] mt-0.5 block">{formatDate(s.lastUsed)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[140px]">
                      <span className="truncate block">{s.models.join(", ")}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{s.inputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">{s.outputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">{s.cacheWriteTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">{s.cacheReadTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-indigo-300">{formatCost(s.inputCost)}</td>
                    <td className="px-4 py-3 text-right font-mono text-purple-300">{formatCost(s.outputCost)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCost(s.cacheWriteCost + s.cacheReadCost)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-100 font-semibold">{formatCost(s.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "rgba(99,102,241,0.06)" }}>
                  <td className="px-4 py-3 font-semibold text-slate-300 text-xs" colSpan={2}>TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-300">{totalInputTokens.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-300">{totalOutputTokens.toLocaleString()}</td>
                  <td className="px-4 py-3" colSpan={2} />
                  <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-300">{formatCost(totals.inputCost)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-purple-300">{formatCost(totals.outputCost)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">{formatCost(totals.cacheWriteCost + totals.cacheReadCost)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-100">{formatCost(totals.totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
