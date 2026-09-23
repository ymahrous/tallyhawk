"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-6 ${
      isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"
    }`}>
      <p className={`text-sm font-mono mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        500
      </p>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Something went wrong</h1>
      <p className={`text-sm mb-8 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/")}
          className={`text-sm font-medium transition-colors ${
            isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          ← Home
        </button>
        <button
          onClick={reset}
          className={`text-sm font-medium px-5 py-2.5 rounded-full transition-colors ${
            isDark
              ? "bg-white text-black hover:bg-gray-200"
              : "bg-black text-white hover:bg-gray-800"
          }`}
        >
          Try again
        </button>
      </div>
    </div>
  );
}