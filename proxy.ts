// middleware.ts
// Guards all routes:
// - Unauthenticated users → /  (landing)
// - Authenticated but paywall_cleared=false → /paywall
// - Authenticated + cleared → allowed through

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that are always public (no auth required)
const PUBLIC_ROUTES = ["/", "/auth/callback"];

// Routes that are accessible to authenticated users regardless of paywall
const PAYWALL_ROUTES = ["/paywall"];

// API routes that must be exempt (webhooks, paywall-related APIs, etc.)
const EXEMPT_API_ROUTES = [
  "/api/stripe/webhook",
  "/api/stripe/create-checkout",
  "/api/stripe/verify-payment", // ← FIX: must be reachable before paywall is cleared
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Always allow exempt API routes (Stripe webhook must not require auth)
  if (EXEMPT_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Create a response to pass through (needed by Supabase SSR to set cookies)
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — IMPORTANT: do not add code between createServerClient and getUser()
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("[proxy] Failed to get user session:", error);
  }

  // --- Routing logic ---

  // 1. No user → allow public routes, redirect everything else to landing
  if (!user) {
    if (PUBLIC_ROUTES.includes(pathname)) {
      return supabaseResponse;
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Authenticated user — check paywall status
  // Allow public routes (they'll redirect to /chat themselves if already authed)
  if (PUBLIC_ROUTES.includes(pathname) || PAYWALL_ROUTES.some((r) => pathname.startsWith(r))) {
    return supabaseResponse;
  }

  // Fetch paywall status from users table
  const { data: userData } = await supabase
    .from("users")
    .select("paywall_cleared, credits")
    .eq("id", user.id)
    .single();

  // If no user row yet (race condition on first login), let the auth callback handle it
  if (!userData) {
    return supabaseResponse;
  }

  // 3. Paywall not cleared → redirect to /paywall
  if (!userData.paywall_cleared) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/paywall";
    return NextResponse.redirect(redirectUrl);
  }

  // 4. Everything is fine — allow the request
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
