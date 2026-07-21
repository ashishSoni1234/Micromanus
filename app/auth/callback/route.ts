// app/auth/callback/route.ts
// Handles the OAuth callback from Google/GitHub via Supabase Auth.
// Exchanges the code for a session, then routes the user:
//   - New users (no users row yet) → /paywall
//   - Returning users with paywall_cleared=true → /chat
//   - Returning users without paywall cleared → /paywall

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/chat";

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] Session exchange error:", error);
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const user = data.user;

  // Check if user profile exists (the trigger handles creation, but check to be safe)
  const { data: profile } = await supabase
    .from("users")
    .select("paywall_cleared")
    .eq("id", user.id)
    .single();

  // If trigger hasn't fired yet (race condition), insert manually
  if (!profile) {
    await supabase.from("users").insert({
      id: user.id,
      email: user.email ?? "",
      credits: 0,
      paywall_cleared: false,
    });
    return NextResponse.redirect(`${origin}/paywall`);
  }

  if (!profile.paywall_cleared) {
    return NextResponse.redirect(`${origin}/paywall`);
  }

  // Use the forwarded host header if behind a proxy (Vercel, etc.)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`);
  } else if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  } else {
    return NextResponse.redirect(`${origin}${next}`);
  }
}
