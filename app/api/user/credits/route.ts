// app/api/user/credits/route.ts
// Returns the current user's credit balance for real-time UI updates

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("users")
    .select("credits")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ credits: data?.credits ?? 0 });
}
