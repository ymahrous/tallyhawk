"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import { AdminHeader, DataState, Pagination, SearchForm, StatusBadge } from "@/components/admin/parts";
import { adminStyles } from "@/components/admin/styles";
import { StatusTabs, TriageItem } from "@/components/admin/Triage";
import { useAdminData } from "@/components/admin/useAdminData";
import { deleteAdminFeedback, listAdminFeedback, updateAdminFeedback, type AdminFeedback } from "@/lib/admin-api";
import { FEEDBACK_TYPES, type FeedbackType, type TriageStatus } from "@/lib/support";

const PAGE_SIZE = 25;

export default function AdminFeedbackPage() {
  const styles = adminStyles(useTheme().theme === "dark");
  const initialType = useSearchParams().get("type");
  const [filters, setFilters] = useState<{ type?: FeedbackType; status?: TriageStatus; search?: string; offset: number }>({
    type: FEEDBACK_TYPES.find((t) => t === initialType),
    offset: 0,
  });
  const inbox = useAdminData(() => listAdminFeedback({ ...filters, limit: PAGE_SIZE }), JSON.stringify(filters));

  const replace = (updated: AdminFeedback) =>
    inbox.setData((prev) => (prev ? { ...prev, results: prev.results.map((f) => (f.id === updated.id ? updated : f)) } : prev));

  return (
    <>
      <AdminHeader title="Feedback & bug reports" description="Everything sent with the feedback button. Bug reports are feedback of type Bug." />
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Type"
            className={styles.input}
            value={filters.type ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, type: (e.target.value || undefined) as FeedbackType | undefined, offset: 0 }))}
          >
            <option value="">All types</option>
            {FEEDBACK_TYPES.map((t) => <option key={t} value={t}>{t === "Bug" ? "Bug reports" : t}</option>)}
          </select>
          <SearchForm label="Search feedback" placeholder="Search the text" value={filters.search ?? ""} onSearch={(search) => setFilters((f) => ({ ...f, search, offset: 0 }))} />
        </div>
        <StatusTabs value={filters.status} counts={inbox.data?.status_counts ?? {}} onChange={(status) => setFilters((f) => ({ ...f, status, offset: 0 }))} />
      </div>

      <div className={styles.card}>
        <DataState loading={inbox.loading && !inbox.data} error={inbox.error} empty={!inbox.data?.results.length} emptyText="Nothing here.">
          <ul>
            {inbox.data?.results.map((f) => (
              <TriageItem
                key={f.id}
                id={f.id}
                title={f.message}
                status={f.status}
                note={f.admin_note}
                createdAt={f.created_at}
                badges={<StatusBadge status={f.type} label={f.type} tone={f.type === "Bug" ? "critical" : "neutral"} />}
                meta={
                  <>
                    {f.username && f.user_id ? (
                      <>From <Link href={`/admin/users/${f.user_id}`} className={styles.link}>{f.username}</Link></>
                    ) : (
                      "From a signed-out visitor"
                    )}
                    {f.page && <> · sent from <span className="font-mono">{f.page}</span></>}
                  </>
                }
                onUpdate={async (changes) => replace(await updateAdminFeedback(f.id, changes))}
                onDelete={async () => {
                  await deleteAdminFeedback(f.id);
                  inbox.reload();
                }}
              >
                {f.message}
              </TriageItem>
            ))}
          </ul>
        </DataState>
      </div>
      {inbox.data && <Pagination total={inbox.data.total} limit={PAGE_SIZE} offset={filters.offset} onChange={(offset) => setFilters((f) => ({ ...f, offset }))} />}
    </>
  );
}
