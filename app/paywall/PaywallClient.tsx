"use client";
// app/paywall/PaywallClient.tsx — interactive paywall UI (coupon + Stripe)
import { useState, useTransition, useEffect, useCallback } from "react";
import { applyCoupon } from "@/app/actions/paywall";
import { useRouter } from "next/navigation";

interface Props {
  paymentStatus?: string;
  errorParam?: string;
  userEmail: string;
}

export default function PaywallClient({ paymentStatus, errorParam, userEmail }: Props) {
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const router = useRouter();

  async function handleCouponSubmit(formData: FormData) {
    setCouponError(null);
    startTransition(async () => {
      const result = await applyCoupon(formData);
      if (result?.error) setCouponError(result.error);
    });
  }

  async function handlePayment() {
    setIsCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setIsCheckoutLoading(false);
    }
  }

  const isWaitingForWebhook = paymentStatus === "success";

  const checkPaymentStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/verify-payment");
      const data = await res.json();
      if (data.cleared) {
        window.location.href = "/chat";
      }
    } catch {
      // silently ignore
    }
  }, [router]);

  useEffect(() => {
    if (isWaitingForWebhook) {
      checkPaymentStatus();
      const interval = setInterval(checkPaymentStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isWaitingForWebhook, checkPaymentStatus]);

  const CheckIcon = ({ color = "#6ee7b7" }: { color?: string }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .paywall-root {
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 20px;
          position: relative;
          overflow: hidden;
        }

        .paywall-root::before {
          content: '';
          position: absolute;
          top: -30%;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 600px;
          background: radial-gradient(ellipse, rgba(59, 130, 246, 0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .paywall-root::after {
          content: '';
          position: absolute;
          bottom: -20%;
          left: 20%;
          width: 600px;
          height: 400px;
          background: radial-gradient(ellipse, rgba(139, 92, 246, 0.04) 0%, transparent 70%);
          pointer-events: none;
        }

        .paywall-inner {
          width: 100%;
          max-width: 960px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          position: relative;
          z-index: 1;
        }

        /* ── Header ── */
        .paywall-header {
          text-align: center;
          margin-bottom: 48px;
          animation: fadeUp 0.6s ease both;
        }

        .paywall-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          color: #3b82f6;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 6px 14px;
          border-radius: 100px;
          margin-bottom: 20px;
        }

        .paywall-title {
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin: 0 0 16px;
          background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .paywall-subtitle {
          font-size: 16px;
          color: #64748b;
          margin: 0 0 24px;
          font-weight: 400;
        }


        .paywall-user-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          border: 1px solid #e2e8f0;
          padding: 8px 16px;
          border-radius: 100px;
          font-size: 13px;
          color: #64748b;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }

        .paywall-user-pill strong {
          color: #0f172a;
          font-weight: 500;
        }

        .user-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 6px #22c55e;
        }

        /* ── Success Banner ── */
        .success-banner {
          width: 100%;
          margin-bottom: 32px;
          padding: 16px 24px;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 16px;
          text-align: center;
          color: #059669;
          font-size: 14px;
          animation: fadeUp 0.4s ease both;
        }

        /* ── Cards Grid ── */
        .paywall-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          width: 100%;
          margin-bottom: 24px;
          animation: fadeUp 0.7s ease 0.1s both;
        }

        @media (max-width: 640px) {
          .paywall-cards { grid-template-columns: 1fr; }
        }

        /* ── Card base ── */
        .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 28px;
          padding: 40px 36px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
        }

        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 48px -12px rgba(0,0,0,0.12);
        }

        /* ── Free Card ── */
        .card-free {
          border-color: rgba(59, 130, 246, 0.25);
          box-shadow: 0 0 0 1px rgba(59,130,246,0.08), 0 4px 16px rgba(59,130,246,0.06);
        }

        .card-free::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          border-radius: 28px 28px 0 0;
        }

        .card-free:hover {
          border-color: rgba(59, 130, 246, 0.4);
          box-shadow: 0 0 0 1px rgba(59,130,246,0.15), 0 20px 48px -12px rgba(59,130,246,0.12);
        }

        /* ── Premium Card ── */
        .card-premium {
          border-color: rgba(139, 92, 246, 0.2);
          box-shadow: 0 0 0 1px rgba(139,92,246,0.06), 0 4px 16px rgba(139,92,246,0.06);
        }

        .card-premium::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #8b5cf6, #ec4899);
          border-radius: 28px 28px 0 0;
        }

        .card-premium:hover {
          border-color: rgba(139, 92, 246, 0.35);
          box-shadow: 0 0 0 1px rgba(139,92,246,0.15), 0 20px 48px -12px rgba(139,92,246,0.12);
        }

        /* ── Card Badge ── */
        .card-tag {
          position: absolute;
          top: 24px;
          right: 24px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 100px;
        }

        .card-tag-free {
          background: rgba(59, 130, 246, 0.08);
          color: #3b82f6;
          border: 1px solid rgba(59,130,246,0.18);
        }

        .card-tag-popular {
          background: rgba(139, 92, 246, 0.08);
          color: #7c3aed;
          border: 1px solid rgba(139,92,246,0.18);
        }

        /* ── Pricing ── */
        .card-price {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-bottom: 6px;
        }

        .price-amount {
          font-size: 64px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .price-period {
          font-size: 14px;
          color: #94a3b8;
          font-weight: 400;
        }

        .card-desc {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 32px;
          padding-bottom: 28px;
          border-bottom: 1px solid #f1f5f9;
          line-height: 1.5;
        }

        /* ── Coupon Input ── */
        .coupon-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 32px;
        }

        .coupon-input {
          width: 100%;
          padding: 14px 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          color: #0f172a;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          box-sizing: border-box;
        }

        .coupon-input::placeholder {
          color: #cbd5e1;
          text-transform: none;
          letter-spacing: 0;
        }

        .coupon-input:focus {
          border-color: #3b82f6;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }

        .coupon-error {
          font-size: 12px;
          color: #f87171;
          text-align: center;
          animation: fadeUp 0.2s ease;
        }

        /* ── Buttons ── */
        .btn-primary {
          width: 100%;
          padding: 15px 20px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s;
          letter-spacing: -0.01em;
        }

        .btn-primary:active { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-blue {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: #fff;
          box-shadow: 0 4px 14px -3px rgba(59,130,246,0.4);
        }

        .btn-blue:hover:not(:disabled) {
          box-shadow: 0 8px 24px -4px rgba(59,130,246,0.5);
          transform: translateY(-1px);
        }

        .btn-stripe {
          background: linear-gradient(135deg, #7c3aed, #5b21b6);
          color: #fff;
          box-shadow: 0 4px 14px -3px rgba(124,58,237,0.4);
        }

        .btn-stripe:hover:not(:disabled) {
          box-shadow: 0 8px 24px -4px rgba(124,58,237,0.5);
          transform: translateY(-1px);
        }

        /* ── Features List ── */
        .features {
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
        }

        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 14px;
          color: #475569;
          line-height: 1.4;
        }

        /* ── Spinner ── */
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        /* ── Security Footer ── */
        .security-box {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 20px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
          animation: fadeUp 0.8s ease 0.2s both;
          flex-wrap: wrap;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }

        .security-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .security-icons {
          display: flex;
          gap: 8px;
        }

        .security-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }

        .security-text-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 2px;
        }

        .security-text-sub {
          font-size: 12px;
          color: #94a3b8;
        }

        .security-link {
          font-size: 13px;
          font-weight: 500;
          color: #64748b;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: color 0.2s;
          white-space: nowrap;
        }

        .security-link:hover { color: #0f172a; }

        /* ── Sign-out Box ── */
        .signout-box {
          width: 100%;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          animation: fadeUp 0.9s ease 0.3s both;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }

        .signout-text {
          font-size: 13px;
          color: #94a3b8;
        }

        .signout-btn {
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-color: rgba(100,116,139,0.3);
          transition: color 0.2s;
          padding: 0;
        }

        .signout-btn:hover { color: #0f172a; }

        /* ── Animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="paywall-root">
        <div className="paywall-inner">

          {/* Header */}
          <div className="paywall-header">
            <div className="paywall-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#3b82f6" stroke="none"><circle cx="12" cy="12" r="12"/></svg>
              Research Agent Access
            </div>
            <h1 className="paywall-title">Unlock MicroManus</h1>
            <p className="paywall-subtitle">Choose how you want to get started today</p>
            <div className="paywall-user-pill">
              <span className="user-dot" />
              Signed in as <strong>{userEmail}</strong>
            </div>
          </div>

          {/* Success Banner */}
          {isWaitingForWebhook && (
            <div className="success-banner" style={{ width: "100%", marginBottom: 32 }}>
              <strong>✅ Payment received!</strong> Your access is being activated — this page will refresh shortly.
              <br />
              <button
                onClick={checkPaymentStatus}
                style={{ marginTop: 8, background: "none", border: "none", color: "#059669", textDecoration: "underline", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}
              >
                Click here if it doesn&apos;t refresh automatically
              </button>
            </div>
          )}

          {/* Cards */}
          <div className="paywall-cards">

            {/* Card 1 — Free / Coupon */}
            <div className="card card-free">
              <span className="card-tag card-tag-free">Free Access</span>

              <div className="card-price">
                <span className="price-amount">$0</span>
                <span className="price-period">/ free</span>
              </div>
              <p className="card-desc">Have a coupon code? Enter it below to unlock access instantly.</p>

              <form action={handleCouponSubmit} className="coupon-form">
                <input
                  type="text"
                  name="coupon"
                  id="coupon-input"
                  placeholder="Enter coupon code"
                  className="coupon-input"
                  required
                  autoComplete="off"
                />
                {couponError && <p className="coupon-error">{couponError}</p>}
                <button
                  type="submit"
                  id="btn-apply-coupon"
                  disabled={isPending}
                  className="btn-primary btn-blue"
                >
                  {isPending ? (
                    <>
                      <span className="spinner" />
                      Verifying…
                    </>
                  ) : (
                    "Apply Code"
                  )}
                </button>
              </form>

              <div className="features">
                <div className="feature-item">
                  <CheckIcon />
                  <span>Full free access with coupon</span>
                </div>
                <div className="feature-item">
                  <CheckIcon />
                  <span>5 research credits included</span>
                </div>
                <div className="feature-item">
                  <CheckIcon />
                  <span>No credit card required</span>
                </div>
              </div>
            </div>

            {/* Card 2 — Stripe Payment */}
            <div className="card card-premium">
              <span className="card-tag card-tag-popular">One-time</span>

              <div className="card-price">
                <span className="price-amount">$5</span>
                <span className="price-period">/ one-time</span>
              </div>
              <p className="card-desc">Pay once, access forever. No subscription, no hidden fees.</p>

              <button
                id="btn-pay-stripe"
                onClick={handlePayment}
                disabled={isCheckoutLoading}
                className="btn-primary btn-stripe"
                style={{ marginBottom: 32 }}
              >
                {isCheckoutLoading ? (
                  <>
                    <span className="spinner" />
                    Opening Stripe…
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    Pay $5 with Stripe
                  </>
                )}
              </button>

              <div className="features">
                <div className="feature-item">
                  <CheckIcon color="#7c3aed" />
                  <span>5 deep research credits</span>
                </div>
                <div className="feature-item">
                  <CheckIcon color="#7c3aed" />
                  <span>Real-time web search</span>
                </div>
                <div className="feature-item">
                  <CheckIcon color="#7c3aed" />
                  <span>PDF report export</span>
                </div>
                <div className="feature-item">
                  <CheckIcon color="#7c3aed" />
                  <span>Use your own LLM keys</span>
                </div>
              </div>
            </div>

          </div>{/* /cards */}

          {/* Security Footer */}
          <div className="security-box">
            <div className="security-left">
              <div className="security-icons">
                <div className="security-icon-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <div className="security-icon-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
              </div>
              <div>
                <p className="security-text-title">Security &amp; Compliance</p>
                <p className="security-text-sub">Secured by Stripe · Enterprise-grade security · SSL encrypted</p>
              </div>
            </div>
            <a href="#" className="security-link">
              Learn more
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          </div>

          {/* Sign-out Box */}
          <div className="signout-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            <span className="signout-text">Not you?</span>
            <button
              type="button"
              className="signout-btn"
              onClick={async () => {
                const { createClient } = await import("@/lib/supabase/client");
                const sb = createClient();
                await sb.auth.signOut();
                window.location.href = "/";
              }}
            >
              Sign out and use a different account
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
