"use client";

import { useTheme } from "@/app/providers/ThemeContext";
import { adminStyles } from "./styles";

/** Page title and one-line description, with optional actions on the right. */
export function AdminHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  const styles = adminStyles(useTheme().theme === "dark");
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className={`text-2xl font-bold tracking-tight sm:text-3xl ${styles.heading}`}>{title}</h1>
        <p className={`mt-1 text-sm ${styles.muted}`}>{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A headline number. `hint` is a short secondary line (a comparison, a breakdown). */
export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  const styles = adminStyles(useTheme().theme === "dark");
  return (
    <div className={`${styles.card} p-5`}>
      <p className={`text-xs font-medium uppercase tracking-wider ${styles.muted}`}>{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${styles.heading}`}>{value}</p>
      {hint && <p className={`mt-1 text-xs ${styles.muted}`}>{hint}</p>}
    </div>
  );
}

const TONES = {
  neutral: ["bg-gray-100 text-gray-700 border-gray-200", "bg-white/10 text-gray-300 border-white/10"],
  info: ["bg-indigo-50 text-indigo-800 border-indigo-200", "bg-indigo-500/15 text-indigo-200 border-indigo-400/30"],
  good: ["bg-emerald-50 text-emerald-800 border-emerald-200", "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"],
  warning: ["bg-amber-50 text-amber-800 border-amber-200", "bg-amber-500/15 text-amber-300 border-amber-400/30"],
  critical: ["bg-red-50 text-red-800 border-red-200", "bg-red-500/15 text-red-300 border-red-400/30"],
} as const;

export type Tone = keyof typeof TONES;

const STATUS_TONES: Record<string, Tone> = {
  active: "good",
  suspended: "critical",
  new: "info",
  in_progress: "warning",
  resolved: "good",
  archived: "neutral",
  COMPLETED: "good",
  PROCESSING: "warning",
  PENDING: "neutral",
  FAILED: "critical",
  pro: "info",
  free: "neutral",
  past_due: "warning",
  canceled: "neutral",
  trialing: "info",
};

/** A labelled status pill. The text always names the state, so color is never the only signal. */
export function StatusBadge({ status, label, tone }: { status: string; label?: string; tone?: Tone }) {
  const isDark = useTheme().theme === "dark";
  const classes = TONES[tone ?? STATUS_TONES[status] ?? "neutral"][isDark ? 1 : 0];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label ?? status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

/** "Showing 1–25 of 80" with previous/next buttons. */
export function Pagination({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  const styles = adminStyles(useTheme().theme === "dark");
  if (!total) return null;
  const end = Math.min(offset + limit, total);
  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <p className={`text-sm ${styles.muted}`}>
        Showing {offset + 1}–{end} of {total}
      </p>
      <div className="flex gap-2">
        <button className={styles.secondaryButton} disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          Previous
        </button>
        <button className={styles.secondaryButton} disabled={end >= total} onClick={() => onChange(offset + limit)}>
          Next
        </button>
      </div>
    </div>
  );
}

/** Loading, error and empty states for a data region. Renders children once there's data. */
export function DataState({ loading, error, empty, emptyText, children }: { loading: boolean; error: string; empty: boolean; emptyText: string; children: React.ReactNode }) {
  const styles = adminStyles(useTheme().theme === "dark");
  if (error) return <p role="alert" className={styles.error}>{error}</p>;
  if (loading) return <p role="status" className={`py-10 text-center text-sm ${styles.muted}`}>Loading…</p>;
  if (empty) return <p className={`py-10 text-center text-sm ${styles.muted}`}>{emptyText}</p>;
  return <>{children}</>;
}

/** A search box that applies on Enter or the button, not on every keystroke. */
export function SearchForm({ value, onSearch, placeholder, label }: { value: string; onSearch: (value: string) => void; placeholder: string; label: string }) {
  const styles = adminStyles(useTheme().theme === "dark");
  return (
    <form
      role="search"
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(String(new FormData(e.currentTarget).get("q") ?? "").trim());
      }}
    >
      <label className="sr-only" htmlFor={`search-${label}`}>{label}</label>
      <input id={`search-${label}`} name="q" type="search" defaultValue={value} placeholder={placeholder} maxLength={200} className={`${styles.input} w-56`} />
      <button type="submit" className={styles.secondaryButton}>Search</button>
    </form>
  );
}
