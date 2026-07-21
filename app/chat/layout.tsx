// app/chat/layout.tsx
// Authenticated chat layout: sidebar + main content + top bar
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatLayoutClient from "./ChatLayoutClient";

export const metadata = {
  title: "MicroManus — Research Chat",
  description: "Deep research AI agent — search, synthesize, and report.",
};

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: userData } = await supabase
    .from("users")
    .select("credits, email")
    .eq("id", user.id)
    .single();

  const { data: chats } = await supabase
    .from("chats")
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: apiKeyRows } = await supabase
    .from("api_keys")
    .select("provider")
    .eq("user_id", user.id);

  const configuredProviders = (apiKeyRows ?? []).map((k) => k.provider);

  return (
    <ChatLayoutClient
      initialChats={chats ?? []}
      credits={userData?.credits ?? 0}
      email={userData?.email ?? user.email ?? ""}
      configuredProviders={configuredProviders}
    >
      {children}
    </ChatLayoutClient>
  );
}
