"use client";

import { useTheme } from "@/app/providers/ThemeContext";
import { useCookieConsent } from "@/app/providers/CookieConsentContext";

export default function CookieConsentBanner() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { consent, showBanner, accept, reject, dismiss } = useCookieConsent();

  if (!showBanner) return null;

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className={`fixed bottom-0 inset-x-0 z-50 border-t px-6 py-4 ${
        isDark ? "bg-black/95 border-white/10 backdrop-blur-xl" : "bg-white/95 border-gray-200 backdrop-blur-xl"
      }`}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
          We use privacy-friendly, cookieless analytics (Vercel Analytics &amp; Speed Insights) to understand how
          Tallyhawk is used. No tracking cookies, no personal identifiers. You can change your choice anytime from
          the footer.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {consent !== null && (
            <button
              onClick={dismiss}
              className={`text-sm font-medium px-3 py-2 transition-colors ${
                isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Close
            </button>
          )}
          <button
            onClick={reject}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-900 hover:bg-gray-200"
            }`}
          >
            Reject
          </button>
          <button
            onClick={accept}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
            }`}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
