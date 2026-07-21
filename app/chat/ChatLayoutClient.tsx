"use client";
// app/chat/ChatLayoutClient.tsx
// Client-side chat shell: sidebar (with search + 3-dot menus) + model selector + children

import { useState, useCallback, createContext, useContext, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { MODEL_PRICING } from "@/lib/model-pricing";

// Provider badge colors
const PROVIDER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  anthropic: { bg: "rgba(205,87,29,0.12)", text: "#cd571d", label: "Anthropic" },
  openai:    { bg: "rgba(16,163,127,0.12)", text: "#10a37f", label: "OpenAI" },
  groq:      { bg: "rgba(249,115,22,0.12)", text: "#f97316", label: "Groq" },
  gemini:    { bg: "rgba(66,133,244,0.12)", text: "#4285f4", label: "Gemini" },
  kimi:      { bg: "rgba(124,92,252,0.12)", text: "#7c5cfc", label: "Kimi" },
};

// ─── Context ─────────────────────────────────────────────────────────────────
type ChatLayoutCtx = {
  selectedModel: string;
  selectedProvider: string;
  setSelectedModel: (m: string) => void;
  setSelectedProvider: (p: string) => void;
  credits: number;
  setCredits: (c: number) => void;
  refreshChats: () => void;
};

export const ChatLayoutContext = createContext<ChatLayoutCtx>({} as ChatLayoutCtx);
export const useChatLayout = () => useContext(ChatLayoutContext);

interface Chat { id: string; title: string; created_at: string; }

interface Props {
  initialChats: Chat[];
  credits: number;
  email: string;
  configuredProviders: string[];
  children: React.ReactNode;
}

// ─── ChatItem: single sidebar row with 3-dot menu ────────────────────────────
function ChatItem({
  chat,
  isActive,
  onRename,
  onDelete,
}: {
  chat: Chat;
  isActive: boolean;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(chat.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Focus input when rename starts
  useEffect(() => {
    if (renaming) {
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [renaming]);

  function startRename() {
    setRenameValue(chat.title);
    setMenuOpen(false);
    setRenaming(true);
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== chat.title) {
      onRename(chat.id, trimmed);
    }
    setRenaming(false);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
    if (e.key === "Escape") { setRenaming(false); }
  }

  function handleDelete() {
    setMenuOpen(false);
    if (confirm(`Delete "${chat.title}"? This cannot be undone.`)) {
      onDelete(chat.id);
    }
  }

  if (renaming) {
    return (
      <div
        className="sidebar-item active"
        style={{ padding: "6px 10px" }}
      >
        <input
          ref={inputRef}
          className="flex-1 bg-transparent outline-none text-sm border-b"
          style={{ borderColor: "rgba(79,110,247,0.5)", color: "var(--text-primary)", minWidth: 0 }}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleRenameKeyDown}
        />
        <button
          onClick={commitRename}
          className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded"
          style={{ background: "rgba(79,110,247,0.15)", color: "#4f6ef7" }}
        >✓</button>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center">
      <Link
        href={`/chat/${chat.id}`}
        className={`sidebar-item flex-1 min-w-0 ${isActive ? "active" : ""}`}
        style={{ paddingRight: "28px" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-50">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="truncate">{chat.title}</span>
      </Link>

      {/* 3-dot button — visible on hover OR when menu is open */}
      <div ref={menuRef} className="absolute right-1 top-1/2 -translate-y-1/2">
        <button
          id={`btn-chat-menu-${chat.id}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((v) => !v); }}
          className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${
            menuOpen
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          }`}
          style={{
            background: menuOpen ? "rgba(79,110,247,0.12)" : "transparent",
            color: "var(--text-muted)",
          }}
          title="Chat options"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
          </svg>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden py-1"
            style={{
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.1)",
              minWidth: "140px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            <button
              id={`btn-rename-chat-${chat.id}`}
              onClick={startRename}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50"
              style={{ color: "#374151" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Rename
            </button>
            <button
              id={`btn-delete-chat-${chat.id}`}
              onClick={handleDelete}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-red-50"
              style={{ color: "#dc2626" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────
export default function ChatLayoutClient({ initialChats, credits: initCredits, email, configuredProviders, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [credits, setCredits] = useState(initCredits);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>(MODEL_PRICING[0].modelId);
  const [selectedProvider, setSelectedProvider] = useState<string>(MODEL_PRICING[0].provider);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Close model dropdown on outside click
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelDropdownOpen]);

  const refreshChats = useCallback(async () => {
    const res = await fetch("/api/chats");
    if (res.ok) {
      const data = await res.json();
      setChats(data.chats ?? []);
    }
  }, []);

  async function createNewChat() {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat" }),
    });
    if (res.ok) {
      const { chat } = await res.json();
      await refreshChats();
      router.push(`/chat/${chat.id}`);
    }
  }

  async function handleRename(chatId: string, newTitle: string) {
    // Optimistic update
    setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, title: newTitle } : c));
    await fetch("/api/chats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, title: newTitle }),
    });
  }

  async function handleDelete(chatId: string) {
    // Optimistic removal
    setChats((prev) => prev.filter((c) => c.id !== chatId));

    await fetch("/api/chats", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    });

    // If deleting the active chat, navigate to the next available one or create a new one
    if (currentChatId === chatId) {
      const remaining = chats.filter((c) => c.id !== chatId);
      if (remaining.length > 0) {
        router.push(`/chat/${remaining[0].id}`);
      } else {
        // No chats left — create a fresh one
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Chat" }),
        });
        if (res.ok) {
          const { chat } = await res.json();
          setChats([chat]);
          router.push(`/chat/${chat.id}`);
        }
      }
    }
  }

  function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const modelId = e.target.value;
    const pricing = MODEL_PRICING.find((m) => m.modelId === modelId);
    if (pricing) {
      setSelectedModel(modelId);
      setSelectedProvider(pricing.provider);
    }
  }

  const currentChatId = pathname?.split("/chat/")[1];

  // Filter chats by search query (case-insensitive)
  const filteredChats = searchQuery.trim()
    ? chats.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : chats;

  return (
    <ChatLayoutContext.Provider value={{ selectedModel, selectedProvider, setSelectedModel, setSelectedProvider, credits, setCredits, refreshChats }}>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>

        {/* ─── Sidebar ──────────────────────────────────────────────── */}
        <aside
          className="flex flex-col flex-shrink-0 transition-all duration-300"
          style={{
            width: sidebarOpen ? "var(--sidebar-width)" : "0px",
            minWidth: sidebarOpen ? "var(--sidebar-width)" : "0px",
            borderRight: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            overflow: "hidden",
          }}
        >
          {/* Top Header: Logo, Search, Toggle */}
          <div className="flex items-center justify-between px-4 pt-5 pb-3" style={{ paddingRight: "14px" }}>
            <div className="flex items-center gap-2">
              <span className="font-serif text-[16px] font-medium tracking-tight" style={{ color: "var(--text-primary)" }}>Micromanus</span>
            </div>
            <div className="flex items-center gap-2" style={{ marginRight: "2px" }}>
              <button 
                className="p-1.5 rounded-lg transition-all duration-150 hover:bg-black/[0.06]" 
                style={{ color: "var(--text-secondary)" }}
                onClick={() => setIsSearchVisible(!isSearchVisible)}
                title="Search chats"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
              </button>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg transition-all duration-150 hover:bg-black/[0.06]"
                style={{ color: "var(--text-secondary)", marginRight: "2px" }}
                title="Close sidebar"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
              </button>
            </div>
          </div>

          {/* New Chat Button */}
          <div className="px-3" style={{ marginTop: "10px", marginBottom: "6px" }}>
            <button
              id="btn-new-chat"
              onClick={createNewChat}
              className="w-full flex items-center justify-center gap-2 px-3 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                color: "var(--text-secondary)",
                background: "transparent",
                border: "1.5px dashed rgba(0,0,0,0.13)",
                padding: "9px 12px",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={e => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.background = "rgba(79,110,247,0.06)";
                btn.style.borderColor = "rgba(79,110,247,0.35)";
                btn.style.color = "#4f6ef7";
              }}
              onMouseLeave={e => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.background = "transparent";
                btn.style.borderColor = "rgba(0,0,0,0.13)";
                btn.style.color = "var(--text-secondary)";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              New Chat
            </button>
          </div>

          {/* Search box (hidden by default, toggled via icon) */}
          {isSearchVisible && (
            <div className="px-4 pb-4">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-150"
                style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  id="sidebar-search"
                  type="text"
                  placeholder="Search chats…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[12px] min-w-0"
                  style={{ color: "var(--text-primary)" }}
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} style={{ color: "var(--text-muted)" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section label */}
          <div className="px-4 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Chats</span>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-4">
            {filteredChats.length === 0 && (
              <p className="text-xs text-center py-8 px-3" style={{ color: "var(--text-muted)" }}>
                {searchQuery ? "No chats found." : "No chats yet."}
              </p>
            )}
            {filteredChats.map((c) => (
              <ChatItem
                key={c.id}
                chat={c}
                isActive={currentChatId === c.id}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Bottom nav */}
          <div
            className="px-3 py-4 flex flex-col gap-1"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tertiary)";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
              }}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150"
                style={{ background: "rgba(79,110,247,0.08)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f6ef7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                </svg>
              </span>
              Usage Dashboard
            </Link>

            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tertiary)";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
              }}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(124,92,252,0.08)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c5cfc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </span>
              Settings
            </Link>
          </div>
        </aside>

        {/* ─── Main area ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Top bar */}
          <header
            className="flex items-center justify-between px-6 flex-shrink-0 z-10"
            style={{ background: "transparent", paddingTop: "18px", paddingBottom: "12px", paddingLeft: "28px" }}
          >
            <div className="flex items-center gap-3">
              {/* Sidebar toggle (Only show when closed) */}
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 rounded-md transition-colors hover:bg-gray-100"
                  style={{ color: "var(--text-secondary)" }}
                  title="Open sidebar"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/>
                  </svg>
                </button>
              )}

              {/* Model selector — custom dropdown */}
              <div className="relative" ref={modelDropdownRef}>
                {/* Trigger button */}
                <button
                  id="model-selector"
                  className="model-dropdown-btn"
                  onClick={() => setModelDropdownOpen(v => !v)}
                >
                  <span className="text-[13px] font-medium" style={{ color: "#111827", maxWidth: "220px" }} title={selectedModel}>
                    {MODEL_PRICING.find(m => m.modelId === selectedModel)?.displayName ?? selectedModel}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    className={`flex-shrink-0 transition-transform duration-200 ${modelDropdownOpen ? "rotate-180" : ""}`}
                    style={{ color: "#6b7280" }}
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {/* Dropdown panel */}
                {modelDropdownOpen && (
                  <div className="model-dropdown-panel">
                    {Object.keys(PROVIDER_COLORS).map(provider => {
                      const providerModels = MODEL_PRICING.filter(m => m.provider === provider);
                      if (providerModels.length === 0) return null;
                      const pColor = PROVIDER_COLORS[provider];
                      const hasKey = configuredProviders.includes(provider);
                      return (
                        <div key={provider}>
                          <div className="model-group-label">
                            {pColor.label}
                            {!hasKey && <span className="ml-1 normal-case font-normal" style={{ color: "#d97706", fontSize: "10px" }}>· no key</span>}
                          </div>
                          {providerModels.map(m => (
                            <button
                              key={m.modelId}
                              className={`model-option w-full text-left ${m.modelId === selectedModel ? "selected" : ""}`}
                              onClick={() => {
                                setSelectedModel(m.modelId);
                                setSelectedProvider(m.provider);
                                setModelDropdownOpen(false);
                              }}
                            >
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: "#d1d5db" }}
                              />
                              <span className="flex-1 truncate">{m.displayName}</span>
                              {m.modelId === selectedModel && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: "#4f6ef7", flexShrink: 0 }}>
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Credits + email */}
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                style={{
                  color: credits > 0 ? "#4f6ef7" : "#dc2626",
                  background: credits > 0 ? "rgba(79,110,247,0.08)" : "rgba(220,38,38,0.08)",
                }}
              >
                {credits} credit{credits !== 1 ? "s" : ""} left
              </span>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </ChatLayoutContext.Provider>
  );
}
