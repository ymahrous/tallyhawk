"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { AdminHeader, DataState, Pagination, SearchForm, StatusBadge } from "@/components/admin/parts";
import { adminStyles, formatDay, formatDateTime } from "@/components/admin/styles";
import { useAdminData } from "@/components/admin/useAdminData";
import { listAdminUsers, type AdminUserQuery } from "@/lib/admin-api";

const PAGE_SIZE = 25;

export default function AdminUsersPage() {
  const styles = adminStyles(useTheme().theme === "dark");
  const [filters, setFilters] = useState<AdminUserQuery>({ sort: "created_at", order: "desc", offset: 0 });
  const users = useAdminData(() => listAdminUsers({ ...filters, limit: PAGE_SIZE }), JSON.stringify(filters));
  const set = (changes: Partial<AdminUserQuery>) => setFilters((prev) => ({ ...prev, offset: 0, ...changes }));

  return (
    <>
      <AdminHeader title="Customers" description="Every customer account. Open one to manage its plan, sessions or data." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchForm label="Search customers" placeholder="Search by email" value={filters.search ?? ""} onSearch={(search) => set({ search })} />
        <select aria-label="Plan" className={styles.input} value={filters.plan ?? ""} onChange={(e) => set({ plan: (e.target.value || undefined) as AdminUserQuery["plan"] })}>
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
        <select aria-label="Status" className={styles.input} value={filters.status ?? ""} onChange={(e) => set({ status: (e.target.value || undefined) as AdminUserQuery["status"] })}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          aria-label="Sort"
          className={styles.input}
          value={`${filters.sort}:${filters.order}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(":") as [AdminUserQuery["sort"], AdminUserQuery["order"]];
            set({ sort, order });
          }}
        >
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="last_login_at:desc">Recently active</option>
          <option value="documents:desc">Most documents</option>
          <option value="username:asc">Email A–Z</option>
        </select>
      </div>

      <div className={`${styles.card} overflow-x-auto`}>
        <DataState loading={users.loading} error={users.error} empty={!users.data?.results.length} emptyText="No customers match.">
          <table className="w-full">
            <thead>
              <tr>
                <th scope="col" className={styles.th}>Email</th>
                <th scope="col" className={styles.th}>Plan</th>
                <th scope="col" className={styles.th}>Status</th>
                <th scope="col" className={`${styles.th} text-right`}>Docs</th>
                <th scope="col" className={styles.th}>Joined</th>
                <th scope="col" className={styles.th}>Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.results.map((u) => (
                <tr key={u.id} className={`border-t ${styles.divider} ${styles.rowHover}`}>
                  <td className={styles.td}>
                    <Link href={`/admin/users/${u.id}`} className={styles.link}>{u.username}</Link>
                  </td>
                  <td className={styles.td}>
                    <span className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={u.plan} />
                      {u.subscription_status === "past_due" && <StatusBadge status="past_due" />}
                      {u.cancel_at_period_end && <StatusBadge status="canceling" label="canceling" tone="warning" />}
                    </span>
                  </td>
                  <td className={styles.td}><StatusBadge status={u.status} /></td>
                  <td className={`${styles.td} text-right tabular-nums ${styles.body}`}>{u.document_count}</td>
                  <td className={`${styles.td} ${styles.body}`}>{formatDay(u.created_at)}</td>
                  <td className={`${styles.td} ${styles.body}`}>{formatDateTime(u.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
      {users.data && <Pagination total={users.data.total} limit={PAGE_SIZE} offset={filters.offset ?? 0} onChange={(offset) => setFilters((prev) => ({ ...prev, offset }))} />}
    </>
  );
}
