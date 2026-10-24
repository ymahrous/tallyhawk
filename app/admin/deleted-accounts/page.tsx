"use client";

import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { AdminHeader, DataState, Pagination, SearchForm, StatusBadge } from "@/components/admin/parts";
import { adminStyles, formatDateTime, formatDay } from "@/components/admin/styles";
import { useAdminData } from "@/components/admin/useAdminData";
import { listDeletedAccounts, type DeletedAccount } from "@/lib/admin-api";
import { RETENTION, period } from "@/lib/retention";

const PAGE_SIZE = 25;
const BILLABLE = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"];

interface Filters {
  deleted_by?: "self" | "admin";
  role?: "user" | "admin";
  subscription?: boolean;
  search?: string;
  offset: number;
}

/** What happened to the account's Stripe subscription, in one cell. */
function SubscriptionCell({ subscription }: { subscription: DeletedAccount["subscription"] }) {
  const styles = adminStyles(useTheme().theme === "dark");
  if (!subscription) return <span className={styles.muted}>None</span>;
  const stillBilling = subscription.status !== null && BILLABLE.includes(subscription.status);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        {subscription.status_at_deletion && <StatusBadge status={subscription.status_at_deletion} label={`${subscription.status_at_deletion.replace(/_/g, " ")} at deletion`} tone="neutral" />}
        {subscription.status && (
          <StatusBadge status={subscription.status} label={stillBilling ? `still ${subscription.status.replace(/_/g, " ")}` : `now ${subscription.status.replace(/_/g, " ")}`} tone={stillBilling ? "critical" : "neutral"} />
        )}
      </div>
      {subscription.billing_cancelled_at && <p className={`text-xs ${styles.muted}`}>Billing stopped {formatDateTime(subscription.billing_cancelled_at)}</p>}
      {(subscription.stripe_customer_id || subscription.stripe_subscription_id) && (
        <p className={`break-all font-mono text-xs ${styles.muted}`}>
          {[subscription.stripe_customer_id, subscription.stripe_subscription_id].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

export default function AdminDeletedAccountsPage() {
  const styles = adminStyles(useTheme().theme === "dark");
  const [filters, setFilters] = useState<Filters>({ offset: 0 });
  const deleted = useAdminData(() => listDeletedAccounts({ ...filters, limit: PAGE_SIZE }), JSON.stringify(filters));
  const set = (changes: Partial<Filters>) => setFilters((prev) => ({ ...prev, offset: 0, ...changes }));

  return (
    <>
      <AdminHeader
        title="Deleted accounts"
        description={`Every deleted account, who deleted it, and what happened to its Stripe subscription. Documents and data are gone; only this record remains. Emails, former ids and Stripe ids are removed ${period(RETENTION.deletionRecordIdentifiersDays, "day")} after deletion; the anonymized record stays.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchForm label="Search deleted accounts" placeholder="Email, former id or Stripe id" value={filters.search ?? ""} onSearch={(search) => set({ search })} />
        <select aria-label="Deleted by" className={styles.input} value={filters.deleted_by ?? ""} onChange={(e) => set({ deleted_by: (e.target.value || undefined) as Filters["deleted_by"] })}>
          <option value="">Deleted by anyone</option>
          <option value="self">Deleted by themselves</option>
          <option value="admin">Deleted by an admin</option>
        </select>
        <select aria-label="Account type" className={styles.input} value={filters.role ?? ""} onChange={(e) => set({ role: (e.target.value || undefined) as Filters["role"] })}>
          <option value="">All account types</option>
          <option value="user">Customers</option>
          <option value="admin">Admins</option>
        </select>
        <label className={`flex items-center gap-2 text-sm ${styles.body}`}>
          <input type="checkbox" checked={!!filters.subscription} onChange={(e) => set({ subscription: e.target.checked })} />
          Had a subscription
        </label>
      </div>

      <div className={`${styles.card} overflow-x-auto`}>
        <DataState loading={deleted.loading && !deleted.data} error={deleted.error} empty={!deleted.data?.results.length} emptyText="No deleted accounts match.">
          <table className="w-full">
            <thead>
              <tr>
                <th scope="col" className={styles.th}>Account</th>
                <th scope="col" className={styles.th}>Deleted</th>
                <th scope="col" className={styles.th}>Plan</th>
                <th scope="col" className={styles.th}>Subscription</th>
                <th scope="col" className={`${styles.th} text-right`}>Documents</th>
              </tr>
            </thead>
            <tbody>
              {deleted.data?.results.map((d) => (
                <tr key={d.id} className={`border-t align-top ${styles.divider}`}>
                  <td className={styles.td}>
                    <p className={`break-all ${styles.body}`}>
                      {d.username ?? (
                        <span className={`italic ${styles.muted}`} title={`Removed ${d.anonymized_at ? formatDay(d.anonymized_at) : ""}`}>
                          Anonymized (retention)
                        </span>
                      )}{" "}
                      {d.role === "admin" && <StatusBadge status="admin" label="admin" tone="warning" />}
                    </p>
                    <p className={`text-xs ${styles.muted}`}>Member since {formatDay(d.account_created_at)}</p>
                    {d.user_id && <p className={`font-mono text-xs ${styles.muted}`}>{d.user_id}</p>}
                  </td>
                  <td className={`${styles.td} ${styles.body}`}>
                    <p className="whitespace-nowrap">{formatDateTime(d.deleted_at)}</p>
                    <p className={`text-xs ${styles.muted}`}>{d.deleted_by === "self" ? "By themselves" : `By ${d.deleted_by_admin_username ?? "an admin"}`}</p>
                  </td>
                  <td className={styles.td}>{d.plan ? <StatusBadge status={d.plan} /> : <span className={styles.muted}>—</span>}</td>
                  <td className={`${styles.td} max-w-xs`}><SubscriptionCell subscription={d.subscription} /></td>
                  <td className={`${styles.td} text-right tabular-nums ${styles.body}`}>{d.role === "user" ? d.lifetime_documents : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
      {deleted.data && <Pagination total={deleted.data.total} limit={PAGE_SIZE} offset={filters.offset} onChange={(offset) => setFilters((f) => ({ ...f, offset }))} />}
    </>
  );
}
