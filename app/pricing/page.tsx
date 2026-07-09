"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import { createCheckoutSession, decodeToken, getUsage } from "@/lib/api";

const tiers = [
  {
    name: "Free",
    priceMonthly: 0,
    description: "For solo freelancers just getting started.",
    features: [
      "10 documents / month",
      "AI data extraction",
      "Basic dashboard",
      "No integrations",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    priceMonthly: 5,
    description: "For power users who need automation and integrations.",
    features: [
      "Unlimited documents",
      "QuickBooks Sync",
      "Tax Categorization & Export",
      "Email Ingestion",
      "Priority Processing",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
];

export default function PricingPage() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
      const syncAuth = () => {
        setIsLoggedIn(!!localStorage.getItem("token"));
      };
      syncAuth();
      window.addEventListener("storage", syncAuth);
      return () => window.removeEventListener("storage", syncAuth);
    }, [pathname]);
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        // Hit the backend directly to get the real-time plan status from the DB
        const usage = await getUsage();
        setCurrentPlan(usage.plan);
      } catch {
        // Fallback to the JWT if the API fails (e.g. user is not logged in)
        const tokenData = decodeToken();
        if (tokenData?.plan) {
          setCurrentPlan(tokenData.plan);
        }
      }
    };
    fetchPlan();
  }, []);

  const handleUpgrade = async () => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setIsLoading(true);
    try {
      const { url } = await createCheckoutSession();
      window.location.href = url; // Redirect to Stripe Checkout
    } catch (err) {
      console.error(err);
      alert("Failed to start checkout. Are you logged in?");
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 ${
      isDark ? "bg-black text-white" : "bg-white text-gray-900"
    }`}>

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
            Simple pricing,<br />
            <span className={isDark ? "text-gray-500" : "text-gray-400"}>serious power.</span>
          </h1>

          <p className={`text-lg max-w-xl mx-auto mb-16 leading-relaxed font-light ${
            isDark ? "text-gray-400" : "text-gray-600"
          }`}>
            Start free. Upgrade when you need integrations, tax exports, and unlimited processing.
          </p>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto text-left">
            {tiers.map((tier) => {
              const isCurrentPlan = currentPlan === tier.name.toLowerCase();
              const isProUser = currentPlan === "pro";

              return (
                <div
                  key={tier.name}
                  className={`rounded-3xl p-8 border flex flex-col ${
                    tier.highlight
                      ? isDark ? "bg-white/5 border-white/20" : "bg-gray-50 border-gray-900"
                      : isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <h3 className="text-xl font-semibold tracking-tight mb-2 font-mono">{tier.name}</h3>
                  <p className={`text-sm mb-6 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                    {tier.description}
                  </p>
                  
                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-5xl font-bold tracking-tighter">
                      ${tier.priceMonthly}
                    </span>
                    <span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      /mo
                    </span>
                  </div>

                  <ul className="space-y-3 mb-8 grow">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <svg className={`w-4 h-4 mt-0.5 shrink-0 ${tier.highlight ? "text-emerald-400" : isDark ? "text-gray-500" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className={isDark ? "text-gray-300" : "text-gray-600"}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={tier.highlight ? handleUpgrade : () => router.push("/signup")}
                    disabled={isLoading || isCurrentPlan || (tier.name === "Free" && isProUser)}
                    className={`w-full py-3 rounded-full text-sm font-medium transition-all ${
                      isCurrentPlan || (tier.name === "Free" && isProUser)
                        ? isDark 
                          ? "bg-white/10 text-gray-500 cursor-not-allowed" 
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : tier.highlight
                          ? isDark 
                            ? "bg-white text-black hover:bg-gray-200 disabled:opacity-50" 
                            : "bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                          : isDark 
                            ? "bg-white/10 text-white hover:bg-white/20" 
                            : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                    }`}
                  >
                    {isLoading && tier.highlight ? "Redirecting..." : isCurrentPlan && isLoggedIn ? "Current Plan" : tier.cta}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
