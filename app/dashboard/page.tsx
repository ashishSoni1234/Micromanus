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

  const statCards = [
    { label: "Sessions", value: chatSummaries.length.toString(), icon: "💬", sub: "conversations", color: "#4f6ef7", bg: "rgba(79,110,247,0.07)" },
    { label: "Total Cost", value: formatCost(totals.totalCost), icon: "💰", sub: "USD spent", color: "#059669", bg: "rgba(5,150,105,0.07)" },
    { label: "Tokens In", value: totalInputTokens.toLocaleString(), icon: "📥", sub: "tokens sent", color: "#7c5cfc", bg: "rgba(124,92,252,0.07)" },
    { label: "Tokens Out", value: totalOutputTokens.toLocaleString(), icon: "📤", sub: "tokens received", color: "#0ea5e9", bg: "rgba(14,165,233,0.07)" },
  ];

  const costItems = [
    { label: "Input Cost", value: formatCost(totals.inputCost), color: "#4f6ef7", pct: totals.totalCost > 0 ? ((totals.inputCost / totals.totalCost) * 100).toFixed(0) : "0" },
    { label: "Output Cost", value: formatCost(totals.outputCost), color: "#7c5cfc", pct: totals.totalCost > 0 ? ((totals.outputCost / totals.totalCost) * 100).toFixed(0) : "0" },
    { label: "Cache Write", value: formatCost(totals.cacheWriteCost), color: "#059669", pct: totals.totalCost > 0 ? ((totals.cacheWriteCost / totals.totalCost) * 100).toFixed(0) : "0" },
    { label: "Cache Read", value: formatCost(totals.cacheReadCost), color: "#0ea5e9", pct: totals.totalCost > 0 ? ((totals.cacheReadCost / totals.totalCost) * 100).toFixed(0) : "0" },
  ];

  return (
    <div style={S.page}>
      {/* Back button */}
      <Link href="/chat" style={S.backBtn}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Chat
      </Link>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={S.headerBadge}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Analytics
        </div>
        <h1 style={S.title}>Usage Dashboard</h1>
        <p style={S.subtitle}>Token counts and USD costs across all your research sessions.</p>
      </div>

      {/* Stat cards */}
      <div style={S.statsGrid}>
        {statCards.map((stat) => (
          <div key={stat.label} style={S.statCard}>
            <div style={{ ...S.statIcon, background: stat.bg, color: stat.color }}>
              <span style={{ fontSize: "17px", lineHeight: "1" }}>{stat.icon}</span>
            </div>
            <div style={{ ...S.statValue, color: stat.color }}>{stat.value}</div>
            <div style={S.statLabel}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Cost breakdown */}
      <section style={S.card}>
        <div style={S.cardHead}>
          <div style={{ ...S.iconBox, background: "rgba(79,110,247,0.08)", color: "#4f6ef7" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div>
            <h2 style={S.cardTitle}>Cost Breakdown</h2>
            <p style={S.cardSub}>Aggregated across all sessions</p>
          </div>
        </div>

        {/* Cost bar */}
        <div style={S.costBarWrap}>
          {totals.totalCost > 0 ? (
            <>
              {costItems.map((item) => {
                const pct = Number(item.pct);
                return pct > 0 ? (
                  <div key={item.label} style={{ width: `${pct}%`, background: item.color, height: "100%", borderRadius: "4px" }} title={`${item.label}: ${pct}%`} />
                ) : null;
              })}
            </>
          ) : (
            <div style={{ width: "100%", background: "rgba(0,0,0,0.05)", height: "100%", borderRadius: "4px" }} />
          )}
        </div>

        {/* Cost items grid */}
        <div style={S.costGrid}>
          {costItems.map((item) => (
            <div key={item.label} style={S.costItem}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                <span style={S.costItemLabel}>{item.label}</span>
              </div>
              <div style={{ ...S.costItemValue, color: item.color }}>{item.value}</div>
              <div style={S.costItemPct}>{item.pct}% of total</div>
            </div>
          ))}
        </div>
      </section>

      {/* Per-thread table */}
      <section style={S.card}>
        <div style={{ ...S.cardHead, marginBottom: "0" }}>
          <div style={{ ...S.iconBox, background: "rgba(124,92,252,0.08)", color: "#7c5cfc" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="21" y2="15"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
            <div>
              <h2 style={S.cardTitle}>Per-Session Breakdown</h2>
              <p style={S.cardSub}>{chatSummaries.length} session{chatSummaries.length !== 1 ? "s" : ""} recorded</p>
            </div>
          </div>
        </div>

        {chatSummaries.length === 0 ? (
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>📊</div>
            <p style={S.emptyTitle}>No usage data yet</p>
            <p style={S.emptySub}>Start a research session in the chat to track your usage.</p>
            <Link href="/chat" style={S.emptyBtn}>Go to Chat →</Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: "18px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.07)" }}>
                  {["Session", "Model(s)", "Tokens In", "Tokens Out", "Input $", "Output $", "Cache $", "Total"].map((h, i) => (
                    <th key={h} style={{ padding: "0 10px 11px", textAlign: i >= 2 ? "right" : "left", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chatSummaries.map((s, idx) => (
                  <tr key={s.chatId} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: idx % 2 !== 0 ? "rgba(0,0,0,0.012)" : "transparent" }}>
                    <td style={{ padding: "11px 10px" }}>
                      <Link href={`/chat/${s.chatId}`} style={{ color: "#111827", fontWeight: 600, textDecoration: "none", display: "block", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.title}
                      </Link>
                      <span style={{ color: "#9ca3af", fontSize: "11px" }}>{formatDate(s.lastUsed)}</span>
                    </td>
                    <td style={{ padding: "11px 10px", color: "#6b7280", maxWidth: "140px" }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.models.join(", ")}</span>
                    </td>
                    <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", color: "#374151" }}>{s.inputTokens.toLocaleString()}</td>
                    <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", color: "#374151" }}>{s.outputTokens.toLocaleString()}</td>
                    <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", color: "#4f6ef7", fontWeight: 600 }}>{formatCost(s.inputCost)}</td>
                    <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", color: "#7c5cfc", fontWeight: 600 }}>{formatCost(s.outputCost)}</td>
                    <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", color: "#059669", fontWeight: 600 }}>{formatCost(s.cacheWriteCost + s.cacheReadCost)}</td>
                    <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", color: "#111827", fontWeight: 700 }}>{formatCost(s.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "rgba(79,110,247,0.04)", borderTop: "2px solid rgba(79,110,247,0.12)" }}>
                  <td style={{ padding: "11px 10px", fontWeight: 700, color: "#111827", fontSize: "12px" }} colSpan={2}>TOTAL</td>
                  <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", fontWeight: 700, color: "#374151" }}>{totalInputTokens.toLocaleString()}</td>
                  <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", fontWeight: 700, color: "#374151" }}>{totalOutputTokens.toLocaleString()}</td>
                  <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", fontWeight: 700, color: "#4f6ef7" }}>{formatCost(totals.inputCost)}</td>
                  <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", fontWeight: 700, color: "#7c5cfc" }}>{formatCost(totals.outputCost)}</td>
                  <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", fontWeight: 700, color: "#059669" }}>{formatCost(totals.cacheWriteCost + totals.cacheReadCost)}</td>
                  <td style={{ padding: "11px 10px", textAlign: "right", fontFamily: "'SF Mono','Fira Code',monospace", fontWeight: 800, color: "#111827", fontSize: "14px" }}>{formatCost(totals.totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Style tokens ───────────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    padding: "32px 28px 72px",
    maxWidth: "860px",
    margin: "0 auto",
    fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
    WebkitFontSmoothing: "antialiased",
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "10px",
    border: "1.5px solid rgba(0,0,0,0.1)",
    background: "transparent",
    color: "#4b5563",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    marginBottom: "28px",
    textDecoration: "none",
    transition: "all 0.18s ease",
    letterSpacing: "0.01em",
  },
  headerBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 12px",
    borderRadius: "100px",
    background: "rgba(79,110,247,0.08)",
    border: "1px solid rgba(79,110,247,0.18)",
    color: "#4f6ef7",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
    marginBottom: "10px",
  },
  title: {
    fontSize: "30px",
    fontWeight: 800,
    color: "#111827",
    letterSpacing: "-0.6px",
    marginBottom: "6px",
    lineHeight: "1.1",
  },
  subtitle: {
    fontSize: "14px",
    color: "#6b7280",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "14px",
    marginBottom: "18px",
  },
  statCard: {
    background: "#ffffff",
    border: "1.5px solid rgba(0,0,0,0.08)",
    borderRadius: "16px",
    padding: "20px 18px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.045)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  statIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "4px",
  },
  statValue: {
    fontSize: "22px",
    fontWeight: 800,
    letterSpacing: "-0.3px",
    lineHeight: "1.1",
  },
  statLabel: {
    fontSize: "12px",
    color: "#9ca3af",
    fontWeight: 500,
  },
  card: {
    background: "#ffffff",
    border: "1.5px solid rgba(0,0,0,0.08)",
    borderRadius: "16px",
    padding: "22px 24px",
    marginBottom: "14px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.045)",
  },
  cardHead: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "18px",
  },
  iconBox: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: "1px",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#111827",
    lineHeight: "1.25",
    marginBottom: "2px",
  },
  cardSub: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  costBarWrap: {
    height: "8px",
    borderRadius: "6px",
    background: "rgba(0,0,0,0.05)",
    display: "flex",
    overflow: "hidden",
    gap: "2px",
    marginBottom: "18px",
  },
  costGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: "12px",
  },
  costItem: {
    padding: "14px",
    borderRadius: "12px",
    background: "rgba(0,0,0,0.018)",
    border: "1px solid rgba(0,0,0,0.055)",
  },
  costItemLabel: {
    fontSize: "11px",
    color: "#6b7280",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  costItemValue: {
    fontSize: "18px",
    fontWeight: 800,
    letterSpacing: "-0.2px",
    marginBottom: "2px",
  },
  costItemPct: {
    fontSize: "11px",
    color: "#9ca3af",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "48px 24px",
    textAlign: "center" as const,
    marginTop: "18px",
    background: "rgba(0,0,0,0.018)",
    borderRadius: "12px",
    border: "1px solid rgba(0,0,0,0.055)",
  },
  emptyIcon: {
    fontSize: "40px",
    marginBottom: "14px",
    lineHeight: "1",
  },
  emptyTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#111827",
    marginBottom: "6px",
  },
  emptySub: {
    fontSize: "13px",
    color: "#9ca3af",
    marginBottom: "18px",
    maxWidth: "280px",
  },
  emptyBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "9px 20px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg,#4f6ef7,#7c5cfc)",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    boxShadow: "0 4px 16px rgba(79,110,247,0.28)",
  },
};
