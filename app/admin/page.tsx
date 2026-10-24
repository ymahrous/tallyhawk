"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { BarBreakdown, DailyChart } from "@/components/admin/charts";
import { AdminHeader, DataState, StatCard } from "@/components/admin/parts";
import { adminStyles } from "@/components/admin/styles";
import { useAdminData } from "@/components/admin/useAdminData";
import { getAdminAnalytics, getAdminOverview } from "@/lib/admin-api";

const RANGES = [7, 30, 90, 365];
const number = (n: number) => n.toLocaleString("en-US");
const percent = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** "+12% vs previous 30 days", or nothing when there's no previous figure to compare with. */
function change(current: number, previous: number, days: number): string | undefined {
  if (!previous) return undefined;
  const delta = Math.round(((current - previous) / previous) * 100);
  return `${delta >= 0 ? "+" : ""}${delta}% vs previous ${days} days`;
}

export default function AdminOverviewPage() {
  const styles = adminStyles(useTheme().theme === "dark");
  const [days, setDays] = useState(30);
  const overview = useAdminData(getAdminOverview, "overview");
  const analytics = useAdminData(() => getAdminAnalytics(days), String(days));
  const o = overview.data;
  const a = analytics.data;

  return (
    <>
      <AdminHeader
        title="Overview"
        description="How Tallyhawk is doing: customers, revenue, processing and support."
        actions={
          <label className={`flex items-center gap-2 text-sm ${styles.muted}`}>
            Range
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={styles.input} aria-label="Analytics range">
              {RANGES.map((d) => <option key={d} value={d}>Last {d} days</option>)}
            </select>
          </label>
        }
      />

      <DataState loading={overview.loading && !o} error={overview.error} empty={false} emptyText="">
        {o && (
          <section aria-label="Headline numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Customers" value={number(o.users.total)} hint={`${number(o.users.signups_last_7d)} new this week · ${number(o.users.active_last_7d)} active`} />
            <StatCard label="Pro customers" value={number(o.users.pro)} hint={`${number(o.billing.comped_pro)} comped · ${number(o.billing.canceling_at_period_end)} canceling`} />
            <StatCard label="Est. MRR" value={`$${number(o.billing.estimated_mrr_usd)}`} hint={`${number(o.billing.active_subscriptions)} active subs · ${number(o.billing.past_due)} past due`} />
            <StatCard label="Documents" value={number(o.documents.total)} hint={`${number(o.documents.created_today)} today · ${number(o.documents.by_status.FAILED ?? 0)} failed`} />
            <StatCard label="New contact messages" value={<Link href="/admin/contact" className={styles.link}>{number(o.contact.new)}</Link>} hint={`${number(o.contact.total)} total`} />
            <StatCard label="Open bug reports" value={<Link href="/admin/feedback?type=Bug" className={styles.link}>{number(o.feedback.open_bugs)}</Link>} hint={`${number(o.feedback.new)} new feedback`} />
            <StatCard
              label="Deleted, 30 days"
              value={<Link href="/admin/deleted-accounts" className={styles.link}>{number(o.deleted_accounts.last_30d)}</Link>}
              hint={`${number(o.deleted_accounts.with_subscription_last_30d)} had a subscription · ${number(o.deleted_accounts.total)} all time · ${number(o.users.suspended)} suspended`}
            />
            <StatCard
              label="Avg. AI confidence"
              value={o.documents.avg_confidence !== null ? percent(o.documents.avg_confidence) : "—"}
              hint={`${number(o.documents.flagged)} flagged · ${number(o.integrations.quickbooks_connections)} QuickBooks links`}
            />
          </section>
        )}
      </DataState>

      <section aria-label="Activity" className="mt-8 space-y-4">
        <DataState loading={analytics.loading && !a} error={analytics.error} empty={false} emptyText="">
          {a && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label={`Signups, ${days} days`}
                  value={number(a.totals.signups)}
                  hint={[change(a.totals.signups, a.totals.previous_signups, days), `${number(a.totals.deletions)} deleted`].filter(Boolean).join(" · ")}
                />
                <StatCard label={`Uploads, ${days} days`} value={number(a.totals.documents)} hint={change(a.totals.documents, a.totals.previous_documents, days)} />
                <StatCard label="Processing failure rate" value={percent(a.totals.failure_rate)} hint={`${number(a.totals.failed)} failed uploads`} />
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <DailyChart
                  title="Signups and deletions per day"
                  data={a.series}
                  series={[
                    { key: "signups", label: "Signups" },
                    { key: "deletions", label: "Deleted accounts" },
                  ]}
                />
                <DailyChart
                  title="Documents per day"
                  data={a.series}
                  series={[
                    { key: "documents", label: "Uploaded" },
                    { key: "failed", label: "Failed" },
                  ]}
                />
                <DailyChart
                  title="Support messages per day"
                  data={a.series}
                  series={[
                    { key: "contact", label: "Contact form" },
                    { key: "feedback", label: "Feedback" },
                  ]}
                />
                <BarBreakdown title="Document status (range)" data={a.document_statuses} />
                <BarBreakdown title="Top expense categories (range)" data={a.categories} />
                <BarBreakdown title="Document currencies (range)" data={a.currencies} />
                <BarBreakdown title="Customers by plan" data={a.plans} />
                <BarBreakdown title="Feedback by type (range)" data={a.feedback_types} />
              </div>

              <div className={`${styles.card} overflow-x-auto`}>
                <table className="w-full">
                  <caption className={`px-5 pt-5 text-left text-sm font-semibold ${styles.heading}`}>Top uploaders (range)</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.th}>Customer</th>
                      <th scope="col" className={styles.th}>Plan</th>
                      <th scope="col" className={`${styles.th} text-right`}>Documents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.top_uploaders.length === 0 && (
                      <tr><td colSpan={3} className={`${styles.td} ${styles.muted}`}>No uploads in this range.</td></tr>
                    )}
                    {a.top_uploaders.map((u) => (
                      <tr key={u.id} className={`border-t ${styles.divider}`}>
                        <td className={styles.td}><Link href={`/admin/users/${u.id}`} className={styles.link}>{u.username}</Link></td>
                        <td className={`${styles.td} ${styles.body}`}>{u.plan}</td>
                        <td className={`${styles.td} text-right tabular-nums ${styles.body}`}>{number(u.documents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DataState>
      </section>
    </>
  );
}
