"use client";
// app/settings/page.tsx
// Account settings: API key management + credit top-up + sign out

import { useState, useEffect } from "react";
import { MODEL_PRICING } from "@/lib/model-pricing";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type ProviderKey = { provider: string; maskedKey: string; updatedAt: string };

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic", icon: "🟣", placeholder: "sk-ant-api03-..." },
  { id: "openai", name: "OpenAI", icon: "🟢", placeholder: "sk-proj-..." },
  { id: "kimi", name: "Kimi (Moonshot AI)", icon: "🌙", placeholder: "sk-..." },
  { id: "gemini", name: "Gemini (Google)", icon: "✨", placeholder: "AIza..." },
  { id: "groq", name: "Llama (Groq)", icon: "🚀", placeholder: "gsk_..." },
];

export default function SettingsPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});
  const [credits, setCredits] = useState<number | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    fetch("/api/keys").then((r) => r.json()).then((d) => setKeys(d.keys ?? []));
    fetch("/api/user/credits").then((r) => r.json()).then((d) => setCredits(d.credits ?? 0));
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  function getKeyInfo(provider: string) {
    return keys.find((k) => k.provider === provider);
  }

  function showMessage(provider: string, type: "success" | "error", text: string) {
    setMessages((prev) => ({ ...prev, [provider]: { type, text } }));
    setTimeout(() => setMessages((prev) => { const n = { ...prev }; delete n[provider]; return n; }), 4000);
  }

  async function saveKey(provider: string) {
    const key = inputs[provider]?.trim();
    if (!key) return;
    setSaving((p) => ({ ...p, [provider]: true }));
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      if (res.ok) {
        setInputs((p) => ({ ...p, [provider]: "" }));
        const keysRes = await fetch("/api/keys");
        const keysData = await keysRes.json();
        setKeys(keysData.keys ?? []);
        showMessage(provider, "success", "API key saved and encrypted successfully.");
      } else {
        const d = await res.json();
        showMessage(provider, "error", d.error ?? "Failed to save key.");
      }
    } finally {
      setSaving((p) => ({ ...p, [provider]: false }));
    }
  }

  async function deleteKey(provider: string) {
    setDeleting((p) => ({ ...p, [provider]: true }));
    try {
      const res = await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.provider !== provider));
        showMessage(provider, "success", "Key removed.");
      }
    } finally {
      setDeleting((p) => ({ ...p, [provider]: false }));
    }
  }

  async function handleBuyCredits() {
    const res = await fetch("/api/stripe/create-checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  async function handleSignOut() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/");
  }

  const hovBg = (el: HTMLElement, on: boolean) => {
    el.style.background = on ? "rgba(0,0,0,0.05)" : "transparent";
    el.style.borderColor = on ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.10)";
    el.style.color = on ? "#111827" : "#4b5563";
    (el.style as CSSStyleDeclaration & { transform: string }).transform = on ? "translateX(-2px)" : "translateX(0)";
  };

  return (
    <div style={S.page}>
      {/* Back */}
      <button
        onClick={() => router.push("/")}
        style={S.backBtn}
        onMouseEnter={(e) => hovBg(e.currentTarget, true)}
        onMouseLeave={(e) => hovBg(e.currentTarget, false)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Chat
      </button>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={S.title}>Settings</h1>
        <p style={S.subtitle}>Manage your API keys, credits, and account.</p>
      </div>

      {/* ── Account ─────────────────────────────────────────────────── */}
      <section style={S.card}>
        <div style={S.cardHead}>
          <div style={{ ...S.iconBox, background: "rgba(79,110,247,0.08)", color: "#4f6ef7" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h2 style={S.cardTitle}>Account</h2>
        </div>
        <div style={S.accountBox}>
          <div>
            <p style={S.labelTiny}>Signed in as</p>
            <p style={S.emailText}>{email || "Loading…"}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "6px 14px", borderRadius: "100px",
              fontSize: "13px", fontWeight: 600,
              background: credits && credits > 0 ? "rgba(79,110,247,0.07)" : "rgba(239,68,68,0.07)",
              border: `1.5px solid ${credits && credits > 0 ? "rgba(79,110,247,0.22)" : "rgba(239,68,68,0.22)"}`,
              color: credits && credits > 0 ? "#4f6ef7" : "#dc2626",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: credits && credits > 0 ? "#4f6ef7" : "#dc2626", display: "inline-block" }}/>
              {credits ?? "—"} credits
            </span>
            <button
              onClick={handleBuyCredits}
              style={S.primaryBtn}
              onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg,#3d5ce8,#6a4de0)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg,#4f6ef7,#7c5cfc)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Buy More Credits ($5)
            </button>
          </div>
        </div>
      </section>

      {/* ── LLM API Keys ─────────────────────────────────────────────── */}
      <section style={S.card}>
        <div style={S.cardHead}>
          <div style={{ ...S.iconBox, background: "rgba(79,110,247,0.08)", color: "#4f6ef7" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
          </div>
          <div>
            <h2 style={S.cardTitle}>LLM API Keys</h2>
            <p style={S.cardSub}>Encrypted with AES-256-GCM — only the last 4 characters are shown.</p>
          </div>
        </div>

        {PROVIDERS.map((p, idx) => {
          const existing = getKeyInfo(p.id);
          const msg = messages[p.id];
          const hasInput = !!(inputs[p.id]?.trim());
          return (
            <div key={p.id} style={{ padding: "18px 0", borderBottom: idx < PROVIDERS.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                  <span style={{ fontSize: "20px", lineHeight: "1" }}>{p.icon}</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>{p.name}</span>
                  {existing && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 600, color: "#059669", background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)" }}>
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2 6 5 9 10 3"/>
                      </svg>
                      {existing.maskedKey}
                    </span>
                  )}
                </div>
                {existing && (
                  <button
                    onClick={() => deleteKey(p.id)}
                    disabled={deleting[p.id]}
                    style={S.removeBtn}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,38,38,0.07)"; e.currentTarget.style.borderColor = "rgba(220,38,38,0.35)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(220,38,38,0.2)"; }}
                  >
                    {deleting[p.id] ? "Removing…" : "Remove"}
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id={`input-${p.id}-key`}
                  type="password"
                  placeholder={existing ? "Enter new key to replace…" : p.placeholder}
                  value={inputs[p.id] ?? ""}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  style={S.keyInput}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(79,110,247,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(79,110,247,0.1)"; e.currentTarget.style.background = "#fff"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "#fafafa"; }}
                  autoComplete="off"
                />
                <button
                  id={`btn-save-${p.id}-key`}
                  onClick={() => saveKey(p.id)}
                  disabled={!hasInput || saving[p.id]}
                  style={hasInput && !saving[p.id] ? S.saveBtn : S.saveBtnOff}
                  onMouseEnter={(e) => { if (!hasInput || saving[p.id]) return; e.currentTarget.style.background = "linear-gradient(135deg,#3d5ce8,#6a4de0)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { if (!hasInput || saving[p.id]) return; e.currentTarget.style.background = "linear-gradient(135deg,#4f6ef7,#7c5cfc)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {saving[p.id] ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span style={S.spinner}/>Saving…</span> : "Save"}
                </button>
              </div>

              {msg && (
                <p className="animate-fade-in" style={{ marginTop: "10px", fontSize: "12px", fontWeight: 500, padding: "8px 12px", borderRadius: "8px", color: msg.type === "success" ? "#059669" : "#dc2626", background: msg.type === "success" ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)", border: `1px solid ${msg.type === "success" ? "rgba(5,150,105,0.15)" : "rgba(220,38,38,0.15)"}` }}>
                  {msg.type === "success" ? "✓ " : "✕ "}{msg.text}
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* ── Model Pricing ─────────────────────────────────────────────── */}
      <section style={S.card}>
        <div style={S.cardHead}>
          <div style={{ ...S.iconBox, background: "rgba(16,185,129,0.08)", color: "#059669" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div>
            <h2 style={S.cardTitle}>Model Pricing Reference</h2>
            <p style={S.cardSub}>Pricing verified July 2026. See Usage Dashboard for your actual costs.</p>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.07)" }}>
                {(["Model", "Input / M", "Output / M", "Cache Read / M"] as const).map((h, i) => (
                  <th key={h} style={{ padding: "0 10px 11px 0", textAlign: i === 3 ? "right" : "left", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODEL_PRICING.map((m, idx) => (
                <tr key={m.modelId} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: idx % 2 !== 0 ? "rgba(0,0,0,0.012)" : "transparent" }}>
                  <td style={{ padding: "9px 10px 9px 0", color: "#111827", fontWeight: 500 }}>{m.displayName}</td>
                  <td style={{ padding: "9px 10px 9px 0", color: "#4b5563" }}>{m.inputPricePerMillion > 0 ? `$${m.inputPricePerMillion.toFixed(2)}` : "TBD"}</td>
                  <td style={{ padding: "9px 10px 9px 0", color: "#4b5563" }}>{m.outputPricePerMillion > 0 ? `$${m.outputPricePerMillion.toFixed(2)}` : "TBD"}</td>
                  <td style={{ padding: "9px 0", color: "#4b5563", textAlign: "right" }}>{m.cacheReadPricePerMillion > 0 ? `$${m.cacheReadPricePerMillion.toFixed(3)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Danger Zone ─────────────────────────────────────────────── */}
      <section style={{ ...S.card, borderColor: "rgba(220,38,38,0.15)", boxShadow: "0 2px 12px rgba(220,38,38,0.04)" }}>
        <div style={S.cardHead}>
          <div style={{ ...S.iconBox, background: "rgba(220,38,38,0.07)", color: "#dc2626" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h2 style={{ ...S.cardTitle, color: "#dc2626" }}>Danger Zone</h2>
            <p style={S.cardSub}>These actions are permanent and cannot be undone.</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          style={S.signOutBtn}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,38,38,0.07)"; e.currentTarget.style.borderColor = "rgba(220,38,38,0.4)"; e.currentTarget.style.color = "#b91c1c"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(220,38,38,0.22)"; e.currentTarget.style.color = "#dc2626"; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </section>

      <style>{`@keyframes s-spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}

/* ─── Style tokens ───────────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#ffffff", padding: "32px 28px 72px", maxWidth: "740px", margin: "0 auto", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", WebkitFontSmoothing: "antialiased" },
  backBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "1.5px solid rgba(0,0,0,0.1)", background: "transparent", color: "#4b5563", fontSize: "13px", fontWeight: 500, cursor: "pointer", marginBottom: "28px", transition: "all 0.18s ease", letterSpacing: "0.01em" },
  title: { fontSize: "30px", fontWeight: 800, color: "#111827", letterSpacing: "-0.6px", marginBottom: "6px", lineHeight: "1.1" },
  subtitle: { fontSize: "14px", color: "#6b7280" },
  card: { background: "#ffffff", border: "1.5px solid rgba(0,0,0,0.08)", borderRadius: "16px", padding: "22px 24px", marginBottom: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.045)" },
  cardHead: { display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "18px" },
  iconBox: { width: "36px", height: "36px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" },
  cardTitle: { fontSize: "15px", fontWeight: 700, color: "#111827", lineHeight: "1.25", marginBottom: "2px" },
  cardSub: { fontSize: "12px", color: "#9ca3af" },
  accountBox: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px", padding: "16px", background: "rgba(0,0,0,0.018)", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.055)" },
  labelTiny: { fontSize: "11px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "4px" },
  emailText: { fontSize: "14px", fontWeight: 600, color: "#111827" },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#4f6ef7,#7c5cfc)", color: "#ffffff", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.18s ease", boxShadow: "0 4px 16px rgba(79,110,247,0.28)", letterSpacing: "0.01em" },
  removeBtn: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "5px 12px", borderRadius: "8px", border: "1.5px solid rgba(220,38,38,0.2)", background: "transparent", color: "#dc2626", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease" },
  keyInput: { flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1.5px solid rgba(0,0,0,0.1)", background: "#fafafa", color: "#111827", fontSize: "13px", fontFamily: "'SF Mono','Fira Code',monospace", outline: "none", transition: "all 0.18s ease", width: "100%" },
  saveBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px 22px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#4f6ef7,#7c5cfc)", color: "#ffffff", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.18s ease", boxShadow: "0 2px 10px rgba(79,110,247,0.28)", whiteSpace: "nowrap", flexShrink: 0 },
  saveBtnOff: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px 22px", borderRadius: "10px", border: "1.5px solid rgba(0,0,0,0.08)", background: "#f3f4f6", color: "#9ca3af", fontSize: "13px", fontWeight: 600, cursor: "not-allowed", whiteSpace: "nowrap", flexShrink: 0 },
  spinner: { width: "12px", height: "12px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", display: "inline-block", animation: "s-spin 0.7s linear infinite" },
  signOutBtn: { display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "10px", border: "1.5px solid rgba(220,38,38,0.22)", background: "transparent", color: "#dc2626", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease" },
};
