"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { AdminHeader, DataState, Pagination, SearchForm, StatusBadge } from "@/components/admin/parts";
import { adminStyles, formatDateTime } from "@/components/admin/styles";
import { useAdminData } from "@/components/admin/useAdminData";
import { listAdminDocuments, reprocessAdminDocument, type AdminDocumentRow } from "@/lib/admin-api";

const PAGE_SIZE = 25;
const STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"];
/** Matches the API: PENDING/PROCESSING for longer than this counts as stuck. */
const STUCK_AFTER_MS = 10 * 60 * 1000;

const canReprocess = (d: AdminDocumentRow) =>
  d.status === "FAILED" || ((d.status === "PENDING" || d.status === "PROCESSING") && Date.now() - new Date(d.created_at).getTime() > STUCK_AFTER_MS);

export default function AdminDocumentsPage() {
  const styles = adminStyles(useTheme().theme === "dark");
  const [filters, setFilters] = useState<{ status?: string; flagged?: boolean; search?: string; offset: number }>({ offset: 0 });
  const docs = useAdminData(() => listAdminDocuments({ ...filters, limit: PAGE_SIZE }), JSON.stringify(filters));
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reprocess = async (doc: AdminDocumentRow) => {
    setBusy(doc.id);
    setError("");
    setMessage("");
    try {
      await reprocessAdminDocument(doc.id);
      setMessage(`Reprocessing ${doc.filename}. It will update in a few seconds.`);
      docs.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reprocess the document.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <AdminHeader title="Documents" description="Uploads across all customers, for spotting processing failures. File contents stay private to their owner." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchForm label="Search documents" placeholder="File name or customer email" value={filters.search ?? ""} onSearch={(search) => setFilters((f) => ({ ...f, search, offset: 0 }))} />
        <select aria-label="Status" className={styles.input} value={filters.status ?? ""} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined, offset: 0 }))}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
        <label className={`flex items-center gap-2 text-sm ${styles.body}`}>
          <input type="checkbox" checked={!!filters.flagged} onChange={(e) => setFilters((f) => ({ ...f, flagged: e.target.checked, offset: 0 }))} />
          Flagged only
        </label>
      </div>
      {message && <p role="status" className={`mb-4 ${styles.success}`}>{message}</p>}
      {error && <p role="alert" className={`mb-4 ${styles.error}`}>{error}</p>}

      <div className={`${styles.card} overflow-x-auto`}>
        <DataState loading={docs.loading && !docs.data} error={docs.error} empty={!docs.data?.results.length} emptyText="No documents match.">
          <table className="w-full">
            <thead>
              <tr>
                <th scope="col" className={styles.th}>File</th>
                <th scope="col" className={styles.th}>Customer</th>
                <th scope="col" className={styles.th}>Status</th>
                <th scope="col" className={styles.th}>Flags</th>
                <th scope="col" className={styles.th}>Uploaded</th>
                <th scope="col" className={styles.th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {docs.data?.results.map((d) => (
                <tr key={d.id} className={`border-t ${styles.divider}`}>
                  <td className={`${styles.td} ${styles.body} max-w-[14rem] truncate`} title={d.filename}>{d.filename}</td>
                  <td className={styles.td}><Link href={`/admin/users/${d.owner_id}`} className={styles.link}>{d.owner_username}</Link></td>
                  <td className={styles.td}><StatusBadge status={d.status} /></td>
                  <td className={`${styles.td} ${styles.body}`}>{d.flags ?? "—"}</td>
                  <td className={`${styles.td} ${styles.body}`}>{formatDateTime(d.created_at)}</td>
                  <td className={`${styles.td} text-right`}>
                    {canReprocess(d) && (
                      <button className={styles.secondaryButton} disabled={busy === d.id} onClick={() => reprocess(d)}>
                        {busy === d.id ? "Starting…" : "Reprocess"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
      {docs.data && <Pagination total={docs.data.total} limit={PAGE_SIZE} offset={filters.offset} onChange={(offset) => setFilters((f) => ({ ...f, offset }))} />}
    </>
  );
}
