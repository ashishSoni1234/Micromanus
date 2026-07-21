// app/paywall/page.tsx — Paywall page: coupon OR Stripe payment
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PaywallClient from "./PaywallClient";

export const metadata = {
  title: "Access MicroManus — Unlock Your Research Agent",
  description: "Unlock full access to MicroManus with a coupon code or $5 one-time payment.",
};

export default async function PaywallPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Check if already cleared (e.g., webhook came in while user was on this page)
  const { data: profile } = await supabase
    .from("users")
    .select("paywall_cleared, credits")
    .eq("id", user.id)
    .single();

  if (profile?.paywall_cleared) {
    redirect("/chat");
  }

  const params = await searchParams;

  return (
    <PaywallClient
      paymentStatus={params.payment}
      errorParam={params.error}
      userEmail={user.email ?? ""}
    />
  );
}
