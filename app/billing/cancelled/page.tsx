"use client";

import Link from "next/link";
import { useTheme } from "@/app/providers/ThemeContext";

export default function BillingCancelled() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen flex items-center justify-center font-sans antialiased px-6 ${
      isDark ? "bg-black text-white" : "bg-white text-gray-900"
    }`}>
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold tracking-tight mb-3">Checkout Cancelled</h1>
        <p className={`text-sm mb-8 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          You were not charged. You can upgrade anytime.
        </p>
        <Link
          href="/pricing"
          className={`inline-block text-sm font-medium px-6 py-3 rounded-full transition-all ${
            isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
          }`}
        >
          Back to Pricing
        </Link>
      </div>
    </div>
  );
}
