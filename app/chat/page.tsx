// app/chat/page.tsx
// Default /chat route — creates a new chat or redirects to most recent one
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ChatIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Find most recent chat
  const { data: latestChat } = await supabase
    .from("chats")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (latestChat) {
    redirect(`/chat/${latestChat.id}`);
  }

  // No chats exist — create the first one
  const { data: newChat } = await supabase
    .from("chats")
    .insert({ user_id: user.id, title: "New Chat" })
    .select("id")
    .single();

  if (newChat) {
    redirect(`/chat/${newChat.id}`);
  }

  // Fallback: show empty state
  return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      Click <strong className="mx-1 text-slate-300">+ New Chat</strong> in the sidebar to begin.
    </div>
  );
}
