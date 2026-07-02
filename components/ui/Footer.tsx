"use client";

import Link from "next/link";
import { useTheme } from "@/app/providers/ThemeContext";

export default function Footer() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <footer className={`border-t mt-auto ${
      isDark ? "border-white/10 bg-black" : "border-gray-200 bg-white"
    }`}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-lg font-semibold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                edocAI
              </span>
            </div>
            <p className={`text-sm leading-relaxed ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              AI-powered Document Processing Intelligence.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Product</h4>
            <ul className="space-y-3">
              <li><Link href="/app" className={`text-sm transition-colors ${isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}>Dashboard</Link></li>
              <li><Link href="/#features" className={`text-sm transition-colors ${isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}>Features</Link></li>
              <li><Link href="/pricing" className={`text-sm transition-colors ${isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}>Pricing</Link></li>
              <li><Link href="/docs" className={`text-sm transition-colors ${isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}>Docs</Link></li>
            </ul>
          </div>

          {/* Stack Links */}
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Stack</h4>
            <ul className="space-y-3">
              <li><span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>Next.js</span></li>
              <li><span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>FastAPI</span></li>
              <li><span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>Celery & Redis</span></li>
              <li><span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>Google Gemini</span></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/terms" className={`text-sm transition-colors ${isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}>
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={`text-sm transition-colors ${isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}>
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className={`mt-16 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 ${
          isDark ? "border-white/10" : "border-gray-200"
        }`}>
          <p className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>
            © {new Date().getFullYear()} Yousef Mahrous. All rights reserved.
          </p>
          <p className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>
            Designed & built as an ML System portfolio project.
          </p>
        </div>
      </div>
    </footer>
  );
}
