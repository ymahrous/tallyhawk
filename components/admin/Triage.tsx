"use client";

import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import type { TriageChanges } from "@/lib/admin-api";
import { TRIAGE_STATUSES, type TriageStatus } from "@/lib/support";
import { StatusBadge } from "./parts";
import { adminStyles, formatDateTime } from "./styles";

const STATUS_LABELS: Record<TriageStatus, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  archived: "Archived",
};

/** Status filter tabs with counts ("All" first). */
export function StatusTabs({ value, counts, onChange }: { value?: TriageStatus; counts: Partial<Record<TriageStatus, number>>; onChange: (status?: TriageStatus) => void }) {
  const isDark = useTheme().theme === "dark";
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const tab = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? (isDark ? "bg-white text-black" : "bg-gray-900 text-white") : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-200"
    }`;
  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
      <button className={tab(!value)} aria-pressed={!value} onClick={() => onChange(undefined)}>All ({total})</button>
      {TRIAGE_STATUSES.map((s) => (
        <button key={s} className={tab(value === s)} aria-pressed={value === s} onClick={() => onChange(s)}>
          {STATUS_LABELS[s]} ({counts[s] ?? 0})
        </button>
      ))}
    </div>
  );
}

interface TriageItemProps {
  id: string;
  title: string;
  meta: React.ReactNode;
  createdAt: string;
  status: TriageStatus;
  note: string | null;
  badges?: React.ReactNode;
  children: React.ReactNode;
  onUpdate: (changes: TriageChanges) => Promise<void>;
  onDelete: () => Promise<void>;
}

/** One message in an inbox: a summary row that expands to the full text, triage controls and a private note. */
export function TriageItem({ id, title, meta, createdAt, status, note, badges, children, onUpdate, onDelete }: TriageItemProps) {
  const styles = adminStyles(useTheme().theme === "dark");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`border-t first:border-t-0 ${styles.divider}`}>
      <button
        className={`flex w-full flex-col gap-1 px-5 py-4 text-left sm:flex-row sm:items-center sm:gap-4 ${styles.rowHover}`}
        aria-expanded={open}
        aria-controls={`triage-${id}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex shrink-0 items-center gap-1.5">
          <StatusBadge status={status} label={STATUS_LABELS[status]} />
          {badges}
        </span>
        <span className={`min-w-0 flex-1 truncate text-sm font-medium ${styles.heading}`}>{title}</span>
        <span className={`shrink-0 text-xs ${styles.muted}`}>{formatDateTime(createdAt)}</span>
      </button>

      {open && (
        <div id={`triage-${id}`} className="space-y-4 px-5 pb-5">
          <div className={`text-xs ${styles.muted}`}>{meta}</div>
          <div className={`whitespace-pre-wrap break-words rounded-xl border p-4 text-sm ${styles.divider} ${styles.body}`}>{children}</div>

          <div className="flex flex-wrap items-end gap-3">
            <label className={`text-xs font-medium ${styles.muted}`}>
              Status
              <select
                className={`${styles.input} mt-1 block`}
                value={status}
                disabled={busy}
                onChange={(e) => run(() => onUpdate({ status: e.target.value as TriageStatus }))}
              >
                {TRIAGE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </label>
            <button
              className={`${styles.dangerButton} ml-auto`}
              disabled={busy}
              onClick={() => confirm("Delete this message permanently?") && run(onDelete)}
            >
              Delete
            </button>
          </div>

          <div>
            <label htmlFor={`note-${id}`} className={`text-xs font-medium ${styles.muted}`}>Internal note (admins only)</label>
            <textarea
              id={`note-${id}`}
              rows={2}
              maxLength={2000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className={`${styles.input} mt-1 block w-full resize-y`}
            />
            <button className={`${styles.secondaryButton} mt-2`} disabled={busy || draft === (note ?? "")} onClick={() => run(() => onUpdate({ admin_note: draft }))}>
              Save note
            </button>
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </div>
      )}
    </li>
  );
}
