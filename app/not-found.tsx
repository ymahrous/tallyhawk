"use client";

import Link from "next/link";
import { useTheme } from "@/app/providers/ThemeContext";

// Next.js serves this with a 404 status and adds <meta name="robots" content="noindex"> itself.
export default function NotFound() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-6 ${
      isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"
    }`}>
      <p className={`text-sm font-mono mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        404
      </p>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Page not found</h1>
      <p className={`text-sm mb-8 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="flex items-center gap-4">
        <Link
          href="/pricing"
          className={`text-sm font-medium transition-colors ${
            isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          View pricing
        </Link>
        <Link
          href="/"
          className={`text-sm font-medium px-5 py-2.5 rounded-full transition-colors ${
            isDark
              ? "bg-white text-black hover:bg-gray-200"
              : "bg-black text-white hover:bg-gray-800"
          }`}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
