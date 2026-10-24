"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import { AdminHeader, DataState, StatCard, StatusBadge } from "@/components/admin/parts";
import { adminStyles, formatDateTime, formatDay } from "@/components/admin/styles";
import { useAdminData } from "@/components/admin/useAdminData";
import UserActions from "@/components/admin/UserActions";
import { getAdminUser } from "@/lib/admin-api";

export default function AdminUserPage() {
  const styles = adminStyles(useTheme().theme === "dark");
  const router = useRouter();
  const { userId } = useParams<{ userId: string }>();
  const user = useAdminData(() => getAdminUser(userId), userId);
  const [notice, setNotice] = useState("");
  const u = user.data;

  return (
    <>
      <Link href="/admin/users" className={`mb-4 inline-block text-sm ${styles.link}`}>← All customers</Link>
      <DataState loading={user.loading && !u} error={user.error} empty={false} emptyText="">
        {u && (
          <>
            <AdminHeader
              title={u.username}
              description={`Customer since ${formatDay(u.created_at)} · last login ${formatDateTime(u.last_login_at)}`}
              actions={
                <span className="flex items-center gap-2">
                  <StatusBadge status={u.plan ?? "free"} />
                  <StatusBadge status={u.status} />
                </span>
              }
            />
            {notice && <p role="status" className={`mb-6 ${styles.success}`}>{notice}</p>}

            <section aria-label="Usage" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Documents" value={u.documents.total} hint={Object.entries(u.documents.by_status).map(([s, n]) => `${n} ${s.toLowerCase()}`).join(" · ") || "None yet"} />
              <StatCard
                label="This month"
                value={u.usage.limit === -1 ? u.usage.documents_processed_this_month : `${u.usage.documents_processed_this_month} / ${u.usage.limit}`}
                hint={u.usage.limit === -1 ? "Unlimited (Pro)" : "Free tier quota"}
              />
              <StatCard label="Vendors" value={u.vendors} hint={u.quickbooks_connected ? "QuickBooks connected" : "QuickBooks not connected"} />
              <StatCard label="Support" value={u.feedback_count + u.contact_count} hint={`${u.feedback_count} feedback · ${u.contact_count} contact`} />
            </section>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section aria-labelledby="billing-heading" className={`${styles.card} p-6`}>
                <h2 id="billing-heading" className={`mb-4 text-base font-semibold ${styles.heading}`}>Billing</h2>
                {u.subscription ? (
                  <dl className={`grid grid-cols-2 gap-3 text-sm ${styles.body}`}>
                    <dt className={styles.muted}>Stripe status</dt>
                    <dd><StatusBadge status={u.subscription.status} /></dd>
                    <dt className={styles.muted}>{u.subscription.cancel_at_period_end ? "Ends" : "Renews"}</dt>
                    <dd>{formatDay(u.subscription.current_period_end)}</dd>
                    <dt className={styles.muted}>Customer</dt>
                    <dd className="font-mono text-xs break-all">{u.subscription.stripe_customer_id ?? "—"}</dd>
                    <dt className={styles.muted}>Subscription</dt>
                    <dd className="font-mono text-xs break-all">{u.subscription.stripe_subscription_id ?? "—"}</dd>
                  </dl>
                ) : (
                  <p className={`text-sm ${styles.muted}`}>No Stripe subscription.{u.plan === "pro" ? " Pro was granted by an admin." : ""}</p>
                )}
              </section>

              <UserActions
                user={u}
                onChanged={(message) => {
                  setNotice(message);
                  user.reload();
                }}
                onDeleted={() => router.push("/admin/users")}
              />
            </div>

            <section aria-labelledby="docs-heading" className={`${styles.card} mt-6 overflow-x-auto`}>
              <h2 id="docs-heading" className={`px-5 pt-5 text-base font-semibold ${styles.heading}`}>Recent documents</h2>
              {u.documents.recent.length === 0 ? (
                <p className={`p-5 text-sm ${styles.muted}`}>No documents yet.</p>
              ) : (
                <table className="mt-2 w-full">
                  <thead>
                    <tr>
                      <th scope="col" className={styles.th}>File</th>
                      <th scope="col" className={styles.th}>Status</th>
                      <th scope="col" className={styles.th}>Flags</th>
                      <th scope="col" className={styles.th}>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.documents.recent.map((d) => (
                      <tr key={d.id} className={`border-t ${styles.divider}`}>
                        <td className={`${styles.td} ${styles.body} max-w-xs truncate`}>{d.filename}</td>
                        <td className={styles.td}><StatusBadge status={d.status} /></td>
                        <td className={`${styles.td} ${styles.body}`}>{d.flags ?? "—"}</td>
                        <td className={`${styles.td} ${styles.body}`}>{formatDateTime(d.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </DataState>
    </>
  );
}
