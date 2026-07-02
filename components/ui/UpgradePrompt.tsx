"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";

export default function UpgradePrompt({ 
  title = "Upgrade to Pro", 
  message = "You've reached the free tier limit. Upgrade for unlimited uploads and integrations." 
}: { 
  title?: string; 
  message?: string; 
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`rounded-2xl border p-6 text-center ${
      isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
    }`}>
      <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      </div>
      <h3 className={`text-base font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
        {title}
      </h3>
      <p className={`text-sm mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
        {message}
      </p>
      <button
        onClick={() => router.push("/pricing")}
        className={`text-sm font-medium px-6 py-2.5 rounded-full transition-all ${
          isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}