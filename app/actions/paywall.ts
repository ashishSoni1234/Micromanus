// app/actions/paywall.ts
// Server Actions for paywall — coupon validation and credit management
"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const VALID_COUPON = "SID_DRDROID"; // Case-sensitive per spec

export async function applyCoupon(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const coupon = formData.get("coupon") as string;

  if (coupon !== VALID_COUPON) {
    return { error: "Invalid coupon code. Please try again." };
  }

  // Valid coupon — update user to grant 5 credits and clear paywall
  const { error } = await supabase
    .from("users")
    .update({ credits: 5, paywall_cleared: true })
    .eq("id", user.id);

  if (error) {
    console.error("[paywall] Failed to apply coupon:", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/chat");
}
