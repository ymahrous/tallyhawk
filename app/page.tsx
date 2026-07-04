"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";

export default function LandingPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const syncAuth = () => {
      const token = localStorage.getItem("token");
      setIsLoggedIn(!!token);
    };
    syncAuth();
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  return (
    <div className={`min-h-screen font-sans antialiased overflow-x-hidden transition-colors duration-300 ${
      isDark ? "bg-black text-white" : "bg-white text-gray-900"
    }`}>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="pt-48 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm mb-8 ${
            isDark ? "border-white/10 bg-white/5 text-gray-400" : "border-gray-200 bg-gray-50 text-gray-600"
          }`}>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Now with QuickBooks Sync
          </div>

          <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
            Document processing,<br />
            <span className={isDark ? "text-gray-500" : "text-gray-400"}>automated.</span>
          </h1>

          <p className={`text-xl max-w-2xl mx-auto mb-12 leading-relaxed font-light ${
            isDark ? "text-gray-400" : "text-gray-600"
          }`}>
            Stop manually entering data. Upload receipts and invoices, let AI extract and categorize them, and sync directly to QuickBooks. Ready for tax season in seconds.
          </p>

          <div className="flex items-center justify-center gap-4">
            {isLoggedIn ? (
              <button
                onClick={() => router.push("/app")}
                className={`text-lg font-medium px-8 py-4 rounded-full transition-all ${
                  isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                Open Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push("/signup")}
                  className={`text-lg font-medium px-8 py-4 rounded-full transition-all ${
                    isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
                  }`}
                >
                  Start for free
                </button>
                <button
                  onClick={() => router.push("/pricing")}
                  className={`text-lg font-medium px-8 py-4 rounded-full border transition-all ${
                    isDark ? "border-white/20 text-white hover:bg-white/10" : "border-gray-300 text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  View Pricing
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── UI Mock ─────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <div className={`rounded-3xl p-1 shadow-2xl border backdrop-blur-xl ${
          isDark ? "bg-white/5 border-white/10 shadow-black/50" : "bg-gray-100 border-gray-200 shadow-gray-300/50"
        }`}>
          <div className={`rounded-[20px] p-6 md:p-8 ${isDark ? "bg-black/40" : "bg-white"}`}>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className={`ml-4 text-xs font-mono ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                edocAI
              </span>
            </div>

            <div className={`rounded-xl p-6 font-mono text-sm border ${
              isDark ? "bg-black/60 border-white/5" : "bg-gray-50 border-gray-200"
            }`}>
              <div className={`flex items-center justify-between mb-4 pb-4 border-b ${
                isDark ? "border-white/10" : "border-gray-200"
              }`}>
                <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  POST /api/v1/upload/
                </span>
                <span className="text-emerald-400 text-xs font-sans font-medium">202 ACCEPTED</span>
              </div>

              <div className={`text-xs mb-6 leading-loose ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                <span className="text-purple-400">{"{"}</span><br />
                <span className="ml-4 text-slate-400">{`"filename"`}</span>: <span className="text-emerald-300">{`"invoice_q3.pdf"`}</span>,<br />
                <span className="ml-4 text-slate-400">{`"status"`}</span>: <span className="text-yellow-300">{`"PROCESSING"`}</span><br />
                <span className="text-purple-400">{"}"}</span>
              </div>

              <div className={`flex items-center justify-between mt-6 pt-4 border-t ${
                isDark ? "border-white/10" : "border-gray-200"
              }`}>
                <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  GET /extraction/...
                </span>
                <span className="text-emerald-400 text-xs font-sans font-medium">200 OK</span>
              </div>

              <div className={`rounded-lg p-4 mt-4 text-xs border ${
                isDark ? "bg-black border-white/5" : "bg-gray-100 border-gray-200"
              }`}>
                <pre className="text-emerald-400">{`{
  "vendor": "Acme Corp",
  "total_amount": "$1,250.00",
  "date": "2023-10-27",
  "category": "Software", 
  "quickbooks_synced": true
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section id="features" className="max-w-5xl mx-auto px-6 pb-32 scroll-mt-24">
        <div className="mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-3">Built for solo founders.</h2>
          <p className={`text-base ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Every feature is designed to get receipts out of your inbox and into your accounting software, instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Card 1 — large */}
          <div className={`md:col-span-2 rounded-3xl p-8 border ${
            isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
          }`}>
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-6">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 tracking-tight">QuickBooks Sync.</h3>
            <p className={`leading-relaxed text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              One click is all it takes. Extracted data is pushed directly to QuickBooks Online as a categorized Expense. No copy-pasting, no manual entry.
            </p>
          </div>

          {/* Card 2 */}
          <div className={`rounded-3xl p-8 border ${
            isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
          }`}>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-6">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 tracking-tight">Tax Ready.</h3>
            <p className={`leading-relaxed text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              AI automatically categorizes spend. Export a clean CSV for your accountant in seconds.
            </p>
          </div>

          {/* Card 3 */}
          <div className={`rounded-3xl p-8 border ${
            isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
          }`}>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 tracking-tight">Mobile Capture.</h3>
            <p className={`leading-relaxed text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Snap a photo of a receipt on your desk. It goes straight through the pipeline.
            </p>
          </div>

          {/* Card 4 — large */}
          <div className={`md:col-span-2 rounded-3xl p-8 border ${
            isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
          }`}>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 tracking-tight">Asynchronous by design.</h3>
            <p className={`leading-relaxed text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Powered by Celery and Redis. Your API responds in milliseconds while heavy AI inference runs safely in the background. No gateway timeouts.
            </p>
          </div>

        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <div className={`rounded-3xl p-12 text-center border ${
          isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
        }`}>
          <h2 className="text-3xl font-bold tracking-tight mb-4">Ready to automate?</h2>
          <p className={`text-base mb-8 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            10 documents free. No credit card required.
          </p>
          {isLoggedIn ? (
            <button
              onClick={() => router.push("/app")}
              className={`text-base font-medium px-8 py-4 rounded-full transition-all ${
                isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
              }`}
            >
              Open Dashboard
            </button>
          ) : (
            <button
              onClick={() => router.push("/signup")}
              className={`text-base font-medium px-8 py-4 rounded-full transition-all ${
                isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
              }`}
            >
              Get started for free
            </button>
          )}
        </div>
      </section>

    </div>
  );
}