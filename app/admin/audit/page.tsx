"use client";

import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { AdminHeader, DataState, Pagination, SearchForm } from "@/components/admin/parts";
import { adminStyles, formatDateTime } from "@/components/admin/styles";
import { useAdminData } from "@/components/admin/useAdminData";
import { getAuditLog } from "@/lib/admin-api";

const PAGE_SIZE = 50;
const AREAS = [
  { value: "user", label: "Customers" },
  { value: "admin", label: "Admins" },
  { value: "contact", label: "Contact inbox" },
  { value: "feedback", label: "Feedback" },
  { value: "document", label: "Documents" },
];

/** "user.update" → "User update". */
const actionLabel = (action: string) => {
  const text = action.replace(/[._]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default function AdminAuditPage() {
  const styles = adminStyles(useTheme().theme === "dark");
  const [filters, setFilters] = useState<{ area?: string; search?: string; offset: number }>({ offset: 0 });
  const log = useAdminData(() => getAuditLog({ ...filters, limit: PAGE_SIZE }), JSON.stringify(filters));

  return (
    <>
      <AdminHeader title="Audit log" description="Every change made from the admin dashboard: who, what and when." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select aria-label="Area" className={styles.input} value={filters.area ?? ""} onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value || undefined, offset: 0 }))}>
          <option value="">All areas</option>
          {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <SearchForm label="Search the audit log" placeholder="Admin, target or action" value={filters.search ?? ""} onSearch={(search) => setFilters((f) => ({ ...f, search, offset: 0 }))} />
      </div>

      <div className={`${styles.card} overflow-x-auto`}>
        <DataState loading={log.loading && !log.data} error={log.error} empty={!log.data?.results.length} emptyText="No admin actions recorded yet.">
          <table className="w-full">
            <thead>
              <tr>
                <th scope="col" className={styles.th}>When</th>
                <th scope="col" className={styles.th}>Admin</th>
                <th scope="col" className={styles.th}>Action</th>
                <th scope="col" className={styles.th}>Target</th>
                <th scope="col" className={styles.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {log.data?.results.map((entry) => (
                <tr key={entry.id} className={`border-t align-top ${styles.divider}`}>
                  <td className={`${styles.td} whitespace-nowrap ${styles.body}`}>{formatDateTime(entry.created_at)}</td>
                  <td className={`${styles.td} ${styles.body}`}>{entry.actor_username}</td>
                  <td className={`${styles.td} ${styles.body}`}>{actionLabel(entry.action)}</td>
                  <td className={`${styles.td} ${styles.body} max-w-xs break-words`}>{entry.target_label ?? "—"}</td>
                  <td className={`${styles.td} ${styles.muted} max-w-xs break-words font-mono text-xs`}>
                    {entry.details ? JSON.stringify(entry.details) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
      {log.data && <Pagination total={log.data.total} limit={PAGE_SIZE} offset={filters.offset} onChange={(offset) => setFilters((f) => ({ ...f, offset }))} />}
    </>
  );
}
