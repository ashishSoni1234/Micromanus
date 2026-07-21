"use client";
// app/chat/[id]/ChatThreadClient.tsx
// Manus-style chat UI — dark user bubble, part-based streaming, tool steps, action bar

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useChatLayout } from "@/app/chat/ChatLayoutClient";
import ReactMarkdown from "react-markdown";

interface DBMessage {
  id: string;
  role: string;
  content: string;
  tool_calls: any;
  tool_result: any;
  created_at: string;
}

interface Props {
  chatId: string;
  initialMessages: DBMessage[];
}

function toAIMessages(dbMessages: DBMessage[]): any[] {
  return dbMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const text = m.content || " ";
      return {
        id: m.id,
        role: m.role,
        content: text,
        parts: [{ type: "text", text }],
      };
    });
}

// ─── Suggested prompts ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: "🌐", label: "Summarize web news" },
  { icon: "📄", label: "Research a topic" },
  { icon: "📊", label: "Analyze data" },
  { icon: "✍️", label: "Write a report" },
];

// ─── Icons ────────────────────────────────────────────────────────────────────
const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
  </svg>
);
const ThumbUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
  </svg>
);
const ThumbDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
  </svg>
);
const PdfIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
    <path d="M9 18l6-6-6-6"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const SpinnerIcon = () => (
  <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0" style={{ borderColor: "rgba(180,83,9,0.3)", borderTopColor: "#b45309" }} />
);

// ─── Helper: extract text from all text parts ─────────────────────────────────
function getFullText(msg: any): string {
  if (Array.isArray(msg.parts)) {
    return msg.parts.filter((p: any) => p.type === "text").map((p: any) => p.text ?? "").join("");
  }
  if (typeof msg.content === "string") return msg.content;
  return "";
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChatThreadClient({ chatId, initialMessages }: Props) {
  const { selectedModel, selectedProvider, credits, setCredits, refreshChats } = useChatLayout();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [creditsError, setCreditsError] = useState(false);
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Per-message copy & thumb states
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [copiedUser, setCopiedUser] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, "up" | "down" | null>>({});
  // Expandable tool results
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const { messages, status, error, sendMessage, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { chatId, modelId: selectedModel, provider: selectedProvider },
    }),
    messages: toAIMessages(initialMessages),
    onFinish: () => {
      fetch("/api/user/credits")
        .then((r) => r.json())
        .then((d) => { if (typeof d.credits === "number") setCredits(d.credits); });
      refreshChats();
    },
    onError: (err) => {
      const msg = err.message ?? "";
      if (msg.includes("402") || msg.includes("Insufficient credits")) {
        setCreditsError(true);
      } else {
        setErrorMessage(msg || "An error occurred. Check your API key in Settings.");
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";
  const isSubmitted = status === "submitted"; // before stream starts
  const hasMessages = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  // ── PDF download ────────────────────────────────────────────────────────────
  async function downloadPdf(content: string, msgId: string) {
    setPdfLoading(msgId);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: content, title: "Research Report" }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `micromanus-report-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setPdfLoading(null);
    }
  }

  // ── Copy helpers ────────────────────────────────────────────────────────────
  const copyText = useCallback((text: string, key: string, setter: (k: string | null) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(key);
      setTimeout(() => setter(null), 1800);
    });
  }, []);

  // ── Form handlers ───────────────────────────────────────────────────────────
  const handleFormSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    setCreditsError(false);
    setErrorMessage(null);
    sendMessage({ text: input });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit();
    }
  };

  const handleSuggestion = (label: string) => {
    setInput(label);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // ── Tool key helper ─────────────────────────────────────────────────────────
  const toolKey = (msgId: string, partIdx: number) => `${msgId}-${partIdx}`;

  // ─── Input box JSX (inlined to avoid remount on each keystroke) ───────────
  const inputBoxJSX = (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex flex-col w-full">
        <div className="relative rounded-t-[22px]">
          <div className="flex flex-col rounded-[22px] relative bg-white py-3 w-full z-[2] shadow-[0px_12px_32px_0px_rgba(0,0,0,0.02)] border border-gray-200 focus-within:border-gray-300 transition-colors duration-300">
            <div className="contents">
              <div className="chat-input-editor overflow-auto pl-4 pr-14 bg-transparent pt-1 pb-1 border-0 w-full min-h-[50px] max-h-[216px]">
                <textarea
                  ref={textareaRef}
                  className="w-full outline-none resize-none bg-transparent leading-[24px] text-[15px] placeholder:text-gray-400 text-gray-900"
                  placeholder={credits <= 0 ? "Out of credits" : "Assign a task or type / for more"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading || credits <= 0}
                  rows={1}
                />
              </div>
              <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2">
                {isLoading && (
                  <button
                    type="button"
                    onClick={() => stop()}
                    className="stop-btn mr-1"
                  >
                    <StopIcon /> Stop
                  </button>
                )}
                
                <button 
                  type="button"
                  onClick={() => handleFormSubmit()}
                  disabled={isLoading || credits <= 0 || !input.trim()}
                  className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors gap-[6px] text-sm rounded-full p-0 w-8 h-8 min-w-0"
                  style={{
                    background: input.trim() && credits > 0 && !isLoading ? "#111827" : "#e5e7eb",
                    color: input.trim() && credits > 0 && !isLoading ? "#ffffff" : "#9ca3af",
                    opacity: credits <= 0 ? 0.5 : 1,
                    cursor: (isLoading || credits <= 0 || !input.trim()) ? "not-allowed" : "pointer"
                  }}
                >
                   {isLoading ? (
                     <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin border-gray-400" />
                   ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M7.91699 15.0642C7.53125 15.0642 7.22119 14.9397 6.98682 14.6907C6.75244 14.4465 6.63525 14.1218 6.63525 13.7166V6.39966L6.77441 3.34546L7.48486 3.89478L5.62451 6.12134L3.99121 7.76196C3.87402 7.87915 3.73975 7.97681 3.58838 8.05493C3.44189 8.13306 3.271 8.17212 3.07568 8.17212C2.73389 8.17212 2.4458 8.05981 2.21143 7.83521C1.98193 7.60571 1.86719 7.3103 1.86719 6.94897C1.86719 6.60229 1.99902 6.29712 2.2627 6.03345L6.97949 1.30933C7.0918 1.19214 7.2334 1.10181 7.4043 1.03833C7.5752 0.969971 7.74609 0.935791 7.91699 0.935791C8.08789 0.935791 8.25879 0.969971 8.42969 1.03833C8.60547 1.10181 8.74463 1.19214 8.86182 1.30933L13.5786 6.03345C13.8423 6.29712 13.9741 6.60229 13.9741 6.94897C13.9741 7.3103 13.8569 7.60571 13.6226 7.83521C13.3931 8.05981 13.1074 8.17212 12.7656 8.17212C12.5703 8.17212 12.397 8.13306 12.2456 8.05493C12.0991 7.97681 11.9673 7.87915 11.8501 7.76196L10.2095 6.12134L8.34912 3.89478L9.05957 3.34546L9.19141 6.39966V13.7166C9.19141 14.1218 9.07422 14.4465 8.83984 14.6907C8.60547 14.9397 8.29785 15.0642 7.91699 15.0642Z" fill="currentColor"></path></svg>
                   )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Error / Credits banners (inlined JSX) ────────────────────────────────
  const bannersJSX = (
    <>
      {(credits <= 0 || creditsError) && (
        <div
          className="mb-3 p-3 rounded-xl text-sm text-center"
          style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)", color: "#dc2626" }}
        >
          <span className="font-semibold block mb-1">Insufficient Credits</span>
          You have used all your research credits.
          <br />
          <a href="/paywall" className="inline-block mt-2 font-medium underline underline-offset-4 hover:opacity-70 transition-opacity">
            Get more credits →
          </a>
        </div>
      )}
      {(error || errorMessage) && !creditsError && (
        <div
          className="mb-3 p-3 rounded-xl text-sm"
          style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)", color: "#dc2626" }}
        >
          <span className="font-semibold block mb-0.5">⚠ Error</span>
          {errorMessage || error?.message || "An error occurred"}
        </div>
      )}
    </>
  );

  // ─── Render a single message ──────────────────────────────────────────────
  function renderMessage(message: any, index: number) {
    // ── User message ──────────────────────────────────────────────────────
    if (message.role === "user") {
      const content = typeof message.content === "string"
        ? message.content
        : (Array.isArray(message.parts)
            ? message.parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("")
            : "");
      const isCopied = copiedUser === message.id;
      return (
        <div key={message.id} className="flex justify-end animate-slide-in-right">
          <div className="flex flex-col items-end gap-1.5 max-w-[75%] mr-2">
            <div className="user-msg-bubble">{content}</div>
            {/* Copy button — always visible but subtle */}
            <button
              className={`copy-btn ${isCopied ? "copied" : ""}`}
              onClick={() => copyText(content, message.id, setCopiedUser)}
              title="Copy message"
            >
              {isCopied ? <><CheckIcon /> Copied!</> : <><CopyIcon /> Copy</>}
            </button>
          </div>
        </div>
      );
    }

    // ── Assistant message ─────────────────────────────────────────────────
    const parts: any[] = Array.isArray(message.parts) ? message.parts : [];
    const fullText = getFullText(message);
    const isCopied = copiedMsgId === message.id;
    const thumbState = thumbs[message.id];
    const isStreaming = isLoading && index === messages.length - 1;

    return (
      <div key={message.id} className="flex justify-start animate-fade-in">
        <div className="max-w-[90%] w-full">

          {/* Agent header */}
          <div className="agent-header">
            <div className="agent-avatar">🔬</div>
            <span style={{ color: "#111827", fontWeight: 600 }}>MicroManus</span>
            <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "12px" }}>
              · {selectedModel.split("-").slice(0, 3).join("-")}
            </span>
          </div>

          {/* Parts — iterate in order */}
          <div className="flex flex-col gap-2">
            {parts.map((part: any, pi: number) => {
              const key = `${message.id}-${pi}`;

              // ── Text part ────────────────────────────────────────────
              if (part.type === "text" && part.text?.trim()) {
                return (
                  <div key={key} className="prose-dark">
                    <ReactMarkdown>{part.text}</ReactMarkdown>
                  </div>
                );
              }

              // ── Tool invocation part ──────────────────────────────────
              if (part.type === "tool-invocation") {
                const inv = part.toolInvocation ?? part;
                const tKey = toolKey(message.id, pi);
                const isExpanded = expandedTools.has(tKey);
                const toolName = inv.toolName ?? inv.tool ?? "tool";
                const query = inv.args?.query ?? inv.input?.query ?? inv.args?.keyword ?? "";
                const state = inv.state; // "call" | "partial-call" | "result"
                const results = inv.result?.results ?? inv.output?.results ?? null;
                const resultCount = Array.isArray(results) ? results.length : null;

                return (
                  <div key={key} className="tool-step-row animate-slide-in">
                    {/* Running / partial-call pill */}
                    {(state === "call" || state === "partial-call") && (
                      <div className="tool-step-pill running">
                        <SpinnerIcon />
                        <SearchIcon />
                        <span className="truncate">Searching{query ? `: "${query}"` : "…"}</span>
                      </div>
                    )}

                    {/* Result pill */}
                    {state === "result" && (
                      <>
                        <div className="tool-step-pill done">
                          <CheckIcon />
                          <SearchIcon />
                          <span className="truncate">
                            {query ? `"${query}"` : toolName}
                          </span>
                          {resultCount !== null && (
                            <span style={{ opacity: 0.7 }}>— {resultCount} results</span>
                          )}
                        </div>
                        {/* Expandable sources */}
                        {Array.isArray(results) && results.length > 0 && (
                          <button
                            className="tool-result-pill"
                            onClick={() => {
                              setExpandedTools(prev => {
                                const next = new Set(prev);
                                next.has(tKey) ? next.delete(tKey) : next.add(tKey);
                                return next;
                              });
                            }}
                          >
                            <ChevronIcon open={isExpanded} />
                            {isExpanded ? "Hide" : "Show"} sources ({results.length})
                          </button>
                        )}
                        {isExpanded && Array.isArray(results) && (
                          <div className="ml-5 mt-1 flex flex-col gap-1">
                            {results.slice(0, 5).map((r: any, ri: number) => (
                              <div key={ri} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                                <span className="flex-shrink-0 mt-0.5">·</span>
                                {r.url ? (
                                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate" style={{ color: "#4f6ef7" }}>
                                    {r.title || r.url}
                                  </a>
                                ) : (
                                  <span className="truncate">{r.title || "Source"}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              }

              // ── Reasoning part ────────────────────────────────────────
              if (part.type === "reasoning" && part.reasoning?.trim()) {
                const rKey = `reasoning-${message.id}-${pi}`;
                const isExpanded = expandedTools.has(rKey);
                return (
                  <div key={key} className="reasoning-block">
                    <div
                      className="reasoning-header"
                      onClick={() => {
                        setExpandedTools(prev => {
                          const next = new Set(prev);
                          next.has(rKey) ? next.delete(rKey) : next.add(rKey);
                          return next;
                        });
                      }}
                    >
                      <ChevronIcon open={isExpanded} />
                      Thinking…
                    </div>
                    {isExpanded && (
                      <div style={{ fontStyle: "normal", fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                        {part.reasoning}
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })}

            {/* If parts array is empty but content exists (fallback for initial messages) */}
            {parts.length === 0 && fullText && (
              <div className="prose-dark">
                <ReactMarkdown>{fullText}</ReactMarkdown>
              </div>
            )}

            {/* Streaming "thinking" indicator — shown when submitted but nothing streamed yet */}
            {isStreaming && parts.length === 0 && (
              <div className="flex items-center gap-2 py-1" style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                <div className="flex items-center gap-1">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
                <span>{isSubmitted ? "Thinking…" : "Generating…"}</span>
              </div>
            )}
          </div>

          {/* Action bar — only for completed messages with text */}
          {!isStreaming && fullText && (
            <div className="msg-action-bar">
              {/* Copy response */}
              <button
                id={`btn-copy-msg-${index}`}
                className={`action-btn ${isCopied ? "copied-state" : ""}`}
                onClick={() => copyText(fullText, message.id, setCopiedMsgId)}
                title="Copy response"
              >
                {isCopied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
              </button>

              {/* Download PDF */}
              <button
                id={`btn-download-pdf-${index}`}
                className="action-btn"
                onClick={() => downloadPdf(fullText, message.id)}
                disabled={pdfLoading === message.id}
                title="Download as PDF"
              >
                {pdfLoading === message.id ? (
                  <><span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(79,110,247,0.3)", borderTopColor: "#4f6ef7" }} /> Generating…</>
                ) : (
                  <><PdfIcon /> PDF</>
                )}
              </button>

              <div style={{ flex: 1 }} />

              {/* Thumbs */}
              <button
                id={`btn-thumb-up-${index}`}
                className={`action-btn ${thumbState === "up" ? "active" : ""}`}
                onClick={() => setThumbs(prev => ({ ...prev, [message.id]: prev[message.id] === "up" ? null : "up" }))}
                title="Good response"
              >
                <ThumbUpIcon />
              </button>
              <button
                id={`btn-thumb-down-${index}`}
                className={`action-btn ${thumbState === "down" ? "active" : ""}`}
                onClick={() => setThumbs(prev => ({ ...prev, [message.id]: prev[message.id] === "down" ? null : "down" }))}
                title="Bad response"
              >
                <ThumbDownIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (!hasMessages && !isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full px-4"
        style={{ background: "var(--bg-primary)" }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #e5e7eb 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Hero */}
        <div className="relative z-10 flex flex-col items-center animate-fade-in-up" style={{ marginBottom: "32px" }}>
          <h1 className="text-[38px] font-normal tracking-tight" style={{ color: "#2d2d2d", fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" }}>
            What can I do for you?
          </h1>
        </div>

        {/* Input */}
        <div className="relative z-10 w-full max-w-[680px] animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {bannersJSX}
          {inputBoxJSX}
        </div>

        {/* Suggestion chips */}
        <div
          className="relative z-10 w-full max-w-2xl mt-5 animate-fade-in-up flex flex-col gap-3"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-[13px] font-medium text-gray-700">Suggested for you</span>
          </div>
          <div className="flex gap-3">
            {SUGGESTIONS.slice(0, 3).map((s) => (
              <button
                key={s.label}
                onClick={() => handleSuggestion(s.label)}
                className="flex-1 flex flex-col items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] text-sm text-gray-700 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xl">{s.icon}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
                <span className="text-left font-medium leading-snug">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Active chat ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-primary)" }}>
      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-6 space-y-7" style={{ paddingLeft: "clamp(16px, 5%, 80px)", paddingRight: "clamp(16px, 5%, 80px)" }}>
        {messages.map((message, index) => renderMessage(message, index))}

        {/* Global "submitted" state — before first token arrives */}
        {isSubmitted && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[90%] w-full">
              <div className="agent-header">
                <div className="agent-avatar">🔬</div>
                <span style={{ color: "#111827", fontWeight: 600 }}>MicroManus</span>
              </div>
              <div className="flex items-center gap-2 py-1" style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                <div className="flex items-center gap-1">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
                <span>Thinking…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Bottom input */}
      <div
        className="flex-shrink-0 px-4 pb-4 pt-2"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          {bannersJSX}
          {inputBoxJSX}
        </div>
      </div>
    </div>
  );
}
