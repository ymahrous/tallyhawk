"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { useIsLoggedIn } from "@/lib/useIsLoggedIn";
import { useTheme } from "@/app/providers/ThemeContext";
import { PRICING_PLANS, formatPlanPrice, type PricingPlan } from "@/lib/pricing";
import { createCheckoutSession, decodeToken, getUsage } from "@/lib/api";

export default function PricingPlans() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isLoggedIn = useIsLoggedIn();
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setCurrentPlan(null);
      return;
    }
    const fetchPlan = async () => {
      try {
        // Hit the backend directly to get the real-time plan status from the DB
        const usage = await getUsage();
        setCurrentPlan(usage.plan);
      } catch {
        // Fall back to the JWT claim if the API is unreachable
        setCurrentPlan(decodeToken()?.plan ?? null);
      }
    };
    fetchPlan();
  }, [isLoggedIn]);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setCheckoutError("");
    try {
      const { url } = await createCheckoutSession();
      window.location.href = url; // Redirect to Stripe Checkout
    } catch {
      setCheckoutError(
        "We couldn't start checkout. Please try again, or log in again if your session expired."
      );
      setIsLoading(false);
    }
  };

  const buttonClass = (plan: PricingPlan, isDisabled: boolean) =>
    `block w-full py-3 rounded-full text-center text-sm font-medium transition-all ${
      isDisabled
        ? isDark
          ? "bg-white/10 text-gray-400 cursor-not-allowed"
          : "bg-gray-100 text-gray-500 cursor-not-allowed"
        : plan.highlight
          ? isDark
            ? "bg-white text-black hover:bg-gray-200 disabled:opacity-50"
            : "bg-black text-white hover:bg-gray-800 disabled:opacity-50"
          : isDark
            ? "bg-white/10 text-white hover:bg-white/20"
            : "bg-gray-200 text-gray-900 hover:bg-gray-300"
    }`;

  const renderCta = (plan: PricingPlan) => {
    const isCurrentPlan = currentPlan === plan.id;
    const isIncludedInPro = plan.id === "free" && currentPlan === "pro";

    if (isCurrentPlan || isIncludedInPro) {
      return (
        <button disabled className={buttonClass(plan, true)}>
          {isCurrentPlan ? "Current plan" : "Included in Pro"}
        </button>
      );
    }
    if (plan.id === "pro" && isLoggedIn) {
      return (
        <button onClick={handleUpgrade} disabled={isLoading} className={buttonClass(plan, false)}>
          {isLoading ? "Redirecting..." : plan.cta}
        </button>
      );
    }
    // Logged-out visitors get real links so crawlers (and middle-click) can follow them.
    return (
      <Link href={plan.id === "pro" ? "/login" : "/signup"} className={buttonClass(plan, false)}>
        {plan.cta}
      </Link>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-3xl p-8 border flex flex-col ${
              plan.highlight
                ? isDark
                  ? "bg-white/5 border-indigo-400/40 shadow-2xl shadow-indigo-500/10"
                  : "bg-gray-50 border-gray-900 shadow-xl shadow-gray-300/40"
                : isDark
                  ? "bg-white/5 border-white/10"
                  : "bg-gray-50 border-gray-200"
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 right-8 rounded-full bg-linear-to-r from-indigo-500 to-emerald-500 px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            )}
            <h2 className="text-xl font-semibold tracking-tight mb-2 font-mono">{plan.name}</h2>
            <p className={`text-sm mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {plan.description}
            </p>

            <p className="flex items-baseline gap-1 mb-8">
              <span className="text-5xl font-bold tracking-tighter">{formatPlanPrice(plan)}</span>
              <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                /month
              </span>
            </p>

            <ul className="space-y-3 mb-8 grow">
              {plan.features.map((feature) => (
                <li key={feature.label} className="flex items-start gap-2 text-sm">
                  {feature.included ? (
                    <Check
                      className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlight ? "text-emerald-500" : isDark ? "text-gray-400" : "text-gray-500"}`}
                      aria-hidden="true"
                    />
                  ) : (
                    <X
                      className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? "text-gray-400" : "text-gray-500"}`}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={
                      feature.included
                        ? isDark
                          ? "text-gray-200"
                          : "text-gray-700"
                        : isDark
                          ? "text-gray-400 line-through"
                          : "text-gray-500 line-through"
                    }
                  >
                    <span className="sr-only">
                      {feature.included ? "Included: " : "Not included: "}
                    </span>
                    {feature.label}
                  </span>
                </li>
              ))}
            </ul>

            {renderCta(plan)}
          </div>
        ))}
      </div>

      {checkoutError && (
        <p
          role="alert"
          className="mt-6 text-sm text-red-500 bg-red-500/10 px-4 py-3 rounded-xl text-center"
        >
          {checkoutError}
        </p>
      )}
    </div>
  );
}
