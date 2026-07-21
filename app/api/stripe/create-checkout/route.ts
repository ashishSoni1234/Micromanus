// app/api/stripe/create-checkout/route.ts
// Creates a Stripe Checkout session for the $5 one-time paywall payment.
// Passes user_id in metadata so the webhook can credit the correct user.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

// Initialize Stripe only when the route is hit to avoid crashing at build/boot if env is missing
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fix: Dynamically get the host so Stripe redirects back to the correct domain
  // even if NEXT_PUBLIC_SITE_URL is misconfigured. This prevents cookie loss on redirect.
  const host = req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") ?? (req.url.startsWith("https") ? "https" : "http");
  const siteUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[stripe/create-checkout] STRIPE_SECRET_KEY is missing in environment variables.");
    return NextResponse.json({ error: "Stripe configuration is missing. Please add STRIPE_SECRET_KEY to your .env.local file." }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 500, // $5.00 in cents
            product_data: {
              name: "MicroManus Access — 5 Research Credits",
              description:
                "One-time purchase. Includes 5 deep research credits with web search, multi-provider LLM support, and PDF export.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id, // Used by the webhook to credit the right user
      },
      success_url: `${siteUrl}/paywall?payment=success`,
      cancel_url: `${siteUrl}/paywall?payment=cancelled`,
      customer_email: user.email,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/create-checkout] Error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
