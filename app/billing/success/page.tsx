"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import { usePlan } from "@/app/providers/PlanContext";
import { confirmCheckout, getUsage } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";

/** How often, and how many times, to check before telling the user it's still processing. */
const POLL_MS = 2000;
const MAX_ATTEMPTS = 8;

type Status = "loading" | "success" | "pending" | "error";

/**
 * Stripe returns here with ?session_id=… after checkout. The page confirms that session with the
 * API (which reads it straight from Stripe, so it doesn't wait for the webhook) and swaps in the
 * fresh session token it returns. No sign-out needed to see Pro.
 */
export default function BillingSuccess() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const allowed = useAuthGuard("user");
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { refreshPlan } = usePlan();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async (attempt: number) => {
      try {
        // Without a session id (an old bookmark), fall back to waiting for the webhook.
        const plan = sessionId ? (await confirmCheckout(sessionId)).plan : (await getUsage()).plan;
        if (cancelled) return;
        if (plan === "pro") {
          await refreshPlan();
          if (!cancelled) setStatus("success");
          return;
        }
        if (attempt + 1 >= MAX_ATTEMPTS) setStatus("pending");
        else timer = setTimeout(() => check(attempt + 1), POLL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
      }
    };
    check(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [allowed, sessionId]);

  const muted = isDark ? "text-gray-400" : "text-gray-600";
  const primaryBtn = `inline-block text-sm font-medium px-6 py-3 rounded-full transition-all ${
    isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
  }`;

  if (!allowed) return null;

  return (
    <div className={`min-h-screen flex items-center justify-center font-sans antialiased px-6 ${
      isDark ? "bg-black text-white" : "bg-white text-gray-900"
    }`}>
      <div className="text-center max-w-md" aria-live="polite">
        {status === "loading" && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-3">Confirming Subscription...</h1>
            <p className={`text-sm ${muted}`}>Please wait while we verify your payment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-3">Welcome to Pro!</h1>
            <p className={`text-sm mb-8 ${muted}`}>
              Unlimited uploads, QuickBooks sync, analytics and tax exports are unlocked.
            </p>
            <Link href="/app" className={primaryBtn}>Go to Dashboard</Link>
          </>
        )}

        {(status === "pending" || status === "error") && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-3">Payment Processing</h1>
            <p className={`text-sm mb-8 ${muted}`}>
              {status === "error"
                ? `We couldn't confirm your payment yet (${error}). If you were charged, Pro will switch on within a few minutes.`
                : "Your payment is still being processed. Pro will switch on automatically within a few minutes; there's no need to sign out."}
            </p>
            <Link href="/app" className={primaryBtn}>Go to Dashboard</Link>
          </>
        )}
      </div>
    </div>
  );
}
