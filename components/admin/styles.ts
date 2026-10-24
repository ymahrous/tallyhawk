/**
 * Class names shared by the admin dashboard, which is a Client Component area styled with the
 * app's `isDark` convention. Centralised so every admin page reads the same in both themes.
 */
export function adminStyles(isDark: boolean) {
  return {
    page: isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900",
    card: `rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`,
    heading: isDark ? "text-white" : "text-gray-900",
    muted: isDark ? "text-gray-400" : "text-gray-500",
    body: isDark ? "text-gray-200" : "text-gray-700",
    divider: isDark ? "border-white/10" : "border-gray-200",
    rowHover: isDark ? "hover:bg-white/5" : "hover:bg-gray-50",
    input: `text-sm px-3 py-2 rounded-lg border outline-none transition-colors ${
      isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-indigo-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500"
    }`,
    primaryButton: `text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
    }`,
    secondaryButton: `text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      isDark ? "border-white/15 text-gray-200 hover:bg-white/10" : "border-gray-300 text-gray-700 hover:bg-gray-100"
    }`,
    dangerButton: `text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      isDark ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-red-200 text-red-700 hover:bg-red-50"
    }`,
    link: `font-medium underline-offset-4 hover:underline ${isDark ? "text-indigo-300" : "text-indigo-700"}`,
    th: `px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`,
    td: "px-4 py-3 text-sm",
    error: "text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg",
    success: `text-sm px-4 py-2 rounded-lg ${isDark ? "text-emerald-300 bg-emerald-500/10" : "text-emerald-800 bg-emerald-50"}`,
  };
}

/** Readable timestamp for tables, e.g. "Oct 24, 2026, 1:05 PM". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
