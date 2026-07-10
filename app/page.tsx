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
    const syncAuth = () => setIsLoggedIn(!!localStorage.getItem("token"));
    syncAuth();
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  const primaryBtnClass = `text-lg font-medium px-8 py-4 rounded-full transition-all ${
    isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
  }`;

  const secondaryBtnClass = `text-lg font-medium px-8 py-4 rounded-full border transition-all ${
    isDark ? "border-white/20 text-white hover:bg-white/10" : "border-gray-300 text-gray-900 hover:bg-gray-50"
  }`;

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
              <button onClick={() => router.push("/app")} className={primaryBtnClass}>
                Open Dashboard
              </button>
            ) : (
              <>
                <button onClick={() => router.push("/signup")} className={primaryBtnClass}>
                  Start for free
                </button>
                <button onClick={() => router.push("/pricing")} className={secondaryBtnClass}>
                  View Pricing
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 sm:pb-32">
        <div className={`rounded-2xl sm:rounded-3xl p-1 shadow-2xl border backdrop-blur-xl ${
          isDark ? "bg-white/5 border-white/10 shadow-black/50" : "bg-gray-100 border-gray-200 shadow-gray-300/50"
        }`}>
          <div className={`rounded-2xl sm:rounded-[20px] p-4 sm:p-6 md:p-8 ${isDark ? "bg-black/40" : "bg-white"}`}>
            
            {/* Window Chrome */}
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className={`ml-4 text-xs font-mono ${isDark ? "text-gray-500" : "text-gray-400"}`}>edocAI Dashboard</span>
            </div>

            {/* Fake Dashboard UI */}
            <div className={`rounded-xl border p-4 sm:p-6 ${isDark ? "bg-black/60 border-white/5" : "bg-gray-50 border-gray-200"}`}>
              
              {/* Fake Stats - Stacks to 1 col on mobile, 3 on md+ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                <div className={`flex sm:flex-col justify-between sm:justify-start items-center sm:items-start p-4 rounded-xl border ${isDark ? "border-white/5 bg-white/5" : "border-gray-200 bg-white"}`}>
                  <p className={`text-xs mb-0 sm:mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Processed</p>
                  <p className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>24</p>
                </div>
                <div className={`flex sm:flex-col justify-between sm:justify-start items-center sm:items-start p-4 rounded-xl border ${isDark ? "border-white/5 bg-white/5" : "border-gray-200 bg-white"}`}>
                  <p className={`text-xs mb-0 sm:mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Synced</p>
                  <p className="text-xl font-semibold text-emerald-400">18</p>
                </div>
                <div className={`flex sm:flex-col justify-between sm:justify-start items-center sm:items-start p-4 rounded-xl border ${isDark ? "border-white/5 bg-white/5" : "border-gray-200 bg-white"}`}>
                  <p className={`text-xs mb-0 sm:mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>This Month</p>
                  <p className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>$5,459</p>
                </div>
              </div>

              {/* Fake Table Header - Hidden on small screens */}
              <div className={`hidden md:grid grid-cols-12 gap-4 pb-3 border-b text-xs font-medium ${isDark ? "border-white/10 text-gray-500" : "border-gray-200 text-gray-400"}`}>
                <div className="col-span-4">Document</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-2 text-right">QuickBooks</div>
              </div>

              {/* Fake Row 1 - AWS (Card on mobile, Row on desktop) */}
              <div className={`py-4 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 md:items-center">
                  
                  {/* Document Info - Full width on mobile */}
                  <div className="col-span-4 flex items-center justify-between md:justify-start gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>aws_billing.pdf</p>
                        <p className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>Amazon Web Services</p>
                      </div>
                    </div>
                    {/* Anchor QuickBooks action to top right on mobile */}
                    <div className="md:hidden">
                      <button className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${isDark ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"}`}>
                        Sync to QB
                      </button>
                    </div>
                  </div>

                  {/* Status, Category, Amount - Horizontal flex on mobile, Grid on desktop */}
                  <div className="col-span-8 flex items-center justify-between md:contents">
                    <div className="md:col-span-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-600"}`}>Processing</span>
                    </div>
                    <div className={`md:col-span-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      <span className={`md:hidden text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>Category: </span>Hosting
                    </div>
                    <div className={`md:col-span-2 text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      <span className={`md:hidden text-xs font-normal ${isDark ? "text-gray-600" : "text-gray-400"}`}>Amount: </span>$159.90
                    </div>
                    <div className="col-span-2 text-right hidden md:block">
                      <button className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${isDark ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"}`}>
                        Sync to QB
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fake Row 2 - Apple */}
              <div className={`py-4 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 md:items-center">
                  
                  <div className="col-span-4 flex items-center justify-between md:justify-start gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>receipt_hw.jpg</p>
                        <p className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>Apple Store</p>
                      </div>
                    </div>
                    <div className="md:hidden">
                      <div className="inline-flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        <span className="text-xs text-emerald-400">Synced</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-8 flex items-center justify-between md:contents">
                    <div className="md:col-span-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>Completed</span>
                    </div>
                    <div className={`md:col-span-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      <span className={`md:hidden text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>Category: </span>Equipment
                    </div>
                    <div className={`md:col-span-2 text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      <span className={`md:hidden text-xs font-normal ${isDark ? "text-gray-600" : "text-gray-400"}`}>Amount: </span>$224.08
                    </div>
                    <div className="col-span-2 text-right hidden md:block">
                      <div className="inline-flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        <span className="text-xs text-emerald-400">Synced</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fake Row 3 - Stripe */}
              <div className="py-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 md:items-center">
                  
                  <div className="col-span-4 flex items-center justify-between md:justify-start gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>invoice_q3.pdf</p>
                        <p className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>Stripe, Inc.</p>
                      </div>
                    </div>
                    <div className="md:hidden">
                      <div className="inline-flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        <span className="text-xs text-emerald-400">Synced</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-8 flex items-center justify-between md:contents">
                    <div className="md:col-span-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>Completed</span>
                    </div>
                    <div className={`md:col-span-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      <span className={`md:hidden text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>Category: </span>Software
                    </div>
                    <div className={`md:col-span-2 text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      <span className={`md:hidden text-xs font-normal ${isDark ? "text-gray-600" : "text-gray-400"}`}>Amount: </span>$48.50
                    </div>
                    <div className="col-span-2 text-right hidden md:block">
                      <div className="inline-flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        <span className="text-xs text-emerald-400">Synced</span>
                      </div>
                    </div>
                  </div>
                </div>
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
          <div className={`md:col-span-2 rounded-3xl p-8 border transition-colors ${
            isDark ? "bg-white/5 border-white/10 hover:border-white/20" : "bg-gray-50 border-gray-200 hover:border-gray-300"
          }`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-6 ${isDark ? "bg-white/10" : "bg-black/5"}`}>
              <svg className={`w-5 h-5 ${isDark ? "text-white" : "text-black"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 tracking-tight">QuickBooks Sync.</h3>
            <p className={`leading-relaxed text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              One click is all it takes. Extracted data is pushed directly to QuickBooks Online as a categorized Expense. No copy-pasting, no manual entry.
            </p>
          </div>

          {/* Card 2 */}
          <div className={`rounded-3xl p-8 border transition-colors ${
            isDark ? "bg-white/5 border-white/10 hover:border-white/20" : "bg-gray-50 border-gray-200 hover:border-gray-300"
          }`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-6 ${isDark ? "bg-white/10" : "bg-black/5"}`}>
              <svg className={`w-5 h-5 ${isDark ? "text-white" : "text-black"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 tracking-tight">Tax Ready.</h3>
            <p className={`leading-relaxed text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              AI automatically categorizes spend. Export a clean CSV for your accountant in seconds.
            </p>
          </div>

          {/* Card 3 */}
          <div className={`rounded-3xl p-8 border transition-colors ${
            isDark ? "bg-white/5 border-white/10 hover:border-white/20" : "bg-gray-50 border-gray-200 hover:border-gray-300"
          }`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-6 ${isDark ? "bg-white/10" : "bg-black/5"}`}>
              <svg className={`w-5 h-5 ${isDark ? "text-white" : "text-black"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 tracking-tight">Mobile Capture.</h3>
            <p className={`leading-relaxed text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Snap a photo of a receipt on your desk. It goes straight through the pipeline.
            </p>
          </div>

          {/* Card 4 — large */}
          <div className={`md:col-span-2 rounded-3xl p-8 border transition-colors ${
            isDark ? "bg-white/5 border-white/10 hover:border-white/20" : "bg-gray-50 border-gray-200 hover:border-gray-300"
          }`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-6 ${isDark ? "bg-white/10" : "bg-black/5"}`}>
              <svg className={`w-5 h-5 ${isDark ? "text-white" : "text-black"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <button onClick={() => router.push("/app")} className={primaryBtnClass}>
              Open Dashboard
            </button>
          ) : (
            <button onClick={() => router.push("/signup")} className={primaryBtnClass}>
              Get started for free
            </button>
          )}
        </div>
      </section>

    </div>
  );
}