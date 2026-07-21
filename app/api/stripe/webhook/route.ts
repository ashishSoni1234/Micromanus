// app/api/stripe/webhook/route.ts
// Receives Stripe webhook events. Handles checkout.session.completed to credit users.
// Uses raw body + signature verification (NEVER use req.json() before verifying).
// Implements idempotency via the stripe_events table to handle Stripe retries safely.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

// Initialize Stripe inside the handler to prevent boot crashes if env is missing
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);


// Disable Next.js body parsing — we need the raw body for signature verification
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text(); // Raw body required for HMAC verification
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe/webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Stripe configuration is missing" }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  // Only handle relevant events
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.user_id;

  if (!userId) {
    console.error("[stripe/webhook] No user_id in session metadata:", session.id);
    return NextResponse.json({ error: "Missing user_id in metadata" }, { status: 400 });
  }

  // Admin client bypasses RLS for these writes
  const supabase = await createAdminClient();

  // --- Idempotency check ---
  const { data: existingEvent } = await supabase
    .from("stripe_events")
    .select("stripe_event_id")
    .eq("stripe_event_id", event.id)
    .single();

  if (existingEvent) {
    // Already processed — return 200 to stop Stripe from retrying
    console.log("[stripe/webhook] Duplicate event ignored:", event.id);
    return NextResponse.json({ received: true });
  }

  // Mark event as processed (insert first to prevent race conditions)
  const { error: insertError } = await supabase
    .from("stripe_events")
    .insert({ stripe_event_id: event.id });

  if (insertError) {
    console.error("[stripe/webhook] Failed to insert stripe_event:", insertError);
    // Don't fail here — another instance may have just inserted it (race condition)
  }

  // Credit the user
  const { error: updateError } = await supabase
    .from("users")
    .update({ credits: 5, paywall_cleared: true })
    .eq("id", userId);

  if (updateError) {
    console.error("[stripe/webhook] Failed to update user credits:", updateError);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  console.log(`[stripe/webhook] ✅ User ${userId} credited 5 credits for session ${session.id}`);
  return NextResponse.json({ received: true });
}
