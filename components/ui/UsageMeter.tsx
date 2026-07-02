"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import { usePlan } from "@/app/providers/PlanContext";

export default function UsageMeter() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { plan, documentsProcessed, limit } = usePlan();

  if (plan === "pro") {
    return (
      <div className={`flex items-center justify-between rounded-2xl border px-6 py-4 ${
        isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>Unlimited Plan</p>
            <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>Process as many documents as you need</p>
          </div>
        </div>
        <button 
          onClick={() => router.push("/profile")}
          className={`text-xs font-medium transition-colors ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
        >
          Manage →
        </button>
      </div>
    );
  }

  // If they are Free, show the usage bar
  const percentage = limit > 0 ? (documentsProcessed / limit) * 100 : 0;
  const isOverLimit = documentsProcessed >= limit;

  return (
    <div className={`rounded-2xl border p-6 ${
      isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
          Free Tier Usage
        </p>
        <p className={`text-xs font-mono ${isOverLimit ? "text-red-400" : isDark ? "text-gray-400" : "text-gray-500"}`}>
          {documentsProcessed} / {limit} documents
        </p>
      </div>
      
      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            isOverLimit 
              ? "bg-red-500" 
              : percentage > 75 
                ? "bg-yellow-500" 
                : "bg-indigo-500"
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {isOverLimit && (
        <div className="mt-4">
          <button
            onClick={() => router.push("/pricing")}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Upgrade for Unlimited Uploads
          </button>
        </div>
      )}
    </div>
  );
}