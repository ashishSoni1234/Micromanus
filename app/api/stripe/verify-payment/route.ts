// app/api/stripe/verify-payment/route.ts
// Polls Stripe directly to verify if a payment was completed for the current user.
// Used as a fallback when the webhook hasn't fired yet (e.g., localhost dev).
// On success, credits the user in Supabase (idempotent — safe to call multiple times).

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if already cleared — fast path
  const { data: profile } = await supabase
    .from("users")
    .select("paywall_cleared, credits")
    .eq("id", user.id)
    .single();

  if (profile?.paywall_cleared) {
    return NextResponse.json({ cleared: true });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Look up recent completed checkout sessions for this user
  // We search by customer_email and metadata user_id
  try {
    const sessions = await stripe.checkout.sessions.list({
      limit: 10,
      expand: ["data.payment_intent"],
    });

    // Find a paid session that matches this user
    const matchingSession = sessions.data.find(
      (s) =>
        s.metadata?.user_id === user.id &&
        s.payment_status === "paid"
    );

    if (!matchingSession) {
      return NextResponse.json({ cleared: false });
    }

    // Payment confirmed — credit the user via admin client (bypasses RLS)
    const adminSupabase = await createAdminClient();

    const { error: updateError } = await adminSupabase
      .from("users")
      .update({ credits: 5, paywall_cleared: true })
      .eq("id", user.id);

    if (updateError) {
      console.error("[verify-payment] Failed to update user:", updateError);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    // Also record in stripe_events to keep idempotency table consistent
    const sessionEventId = `verify_${matchingSession.id}`;
    await adminSupabase
      .from("stripe_events")
      .upsert({ stripe_event_id: sessionEventId }, { onConflict: "stripe_event_id" });

    console.log(`[verify-payment] ✅ User ${user.id} manually verified & credited.`);
    return NextResponse.json({ cleared: true });
  } catch (err) {
    console.error("[verify-payment] Stripe API error:", err);
    return NextResponse.json({ error: "Stripe lookup failed" }, { status: 500 });
  }
}
