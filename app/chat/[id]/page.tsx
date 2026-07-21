// app/chat/[id]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatThreadClient from "./ChatThreadClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChatThreadPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Verify chat belongs to user
  const { data: chat } = await supabase
    .from("chats")
    .select("id, title")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!chat) redirect("/chat");

  // Load message history
  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, tool_calls, tool_result, created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: true });

  return (
    <ChatThreadClient
      chatId={id}
      initialMessages={messages ?? []}
    />
  );
}
