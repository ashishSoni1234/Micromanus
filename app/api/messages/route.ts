// app/api/messages/route.ts
// Load message history for a thread (used when switching threads)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  // Verify the chat belongs to the user (RLS also enforces this)
  const { data: chat } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .single();

  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, role, content, tool_calls, tool_result, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: messages ?? [] });
}
