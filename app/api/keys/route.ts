// app/api/keys/route.ts
// CRUD for encrypted user API keys.
// GET: returns masked key info (last 4 chars only, never plaintext)
// POST: encrypts and upserts a key
// DELETE: removes a key

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/encryption";

type Provider = "anthropic" | "openai" | "kimi" | "gemini" | "groq";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, provider, encrypted_key, iv, auth_tag, updated_at")
    .eq("user_id", user.id);

  // Return only masked versions — never the plaintext key
  const masked = (keys ?? []).map((k) => {
    try {
      const plaintext = decrypt({ ciphertext: k.encrypted_key, iv: k.iv, authTag: k.auth_tag });
      const maskedKey = "••••" + plaintext.slice(-4);
      return { provider: k.provider, maskedKey, updatedAt: k.updated_at };
    } catch {
      return { provider: k.provider, maskedKey: "••••••••", updatedAt: k.updated_at };
    }
  });

  return NextResponse.json({ keys: masked });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider, apiKey } = await req.json();

  if (!["anthropic", "openai", "kimi", "gemini", "groq"].includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (!apiKey || typeof apiKey !== "string" || apiKey.length < 8) {
    return NextResponse.json({ error: "API key is too short" }, { status: 400 });
  }

  const { ciphertext, iv, authTag } = encrypt(apiKey);

  const { error } = await supabase.from("api_keys").upsert(
    {
      user_id: user.id,
      provider: provider as Provider,
      encrypted_key: ciphertext,
      iv,
      auth_tag: authTag,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  if (error) {
    console.error("[api/keys] Upsert error:", error);
    return NextResponse.json({ error: "Failed to save key" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await req.json();

  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) {
    console.error("[api/keys] Delete error:", error);
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}



