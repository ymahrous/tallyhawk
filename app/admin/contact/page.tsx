"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { AdminHeader, DataState, Pagination, SearchForm } from "@/components/admin/parts";
import { adminStyles } from "@/components/admin/styles";
import { StatusTabs, TriageItem } from "@/components/admin/Triage";
import { useAdminData } from "@/components/admin/useAdminData";
import { deleteAdminContact, listAdminContact, updateAdminContact, type AdminContactMessage } from "@/lib/admin-api";
import type { TriageStatus } from "@/lib/support";

const PAGE_SIZE = 25;

export default function AdminContactPage() {
  const styles = adminStyles(useTheme().theme === "dark");
  const [filters, setFilters] = useState<{ status?: TriageStatus; search?: string; offset: number }>({ status: "new", offset: 0 });
  const inbox = useAdminData(() => listAdminContact({ ...filters, limit: PAGE_SIZE }), JSON.stringify(filters));

  const replace = (updated: AdminContactMessage) =>
    inbox.setData((prev) => (prev ? { ...prev, results: prev.results.map((m) => (m.id === updated.id ? updated : m)) } : prev));

  return (
    <>
      <AdminHeader title="Contact inbox" description="Messages sent through the public contact form. Reply by email, then mark them resolved." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusTabs value={filters.status} counts={inbox.data?.status_counts ?? {}} onChange={(status) => setFilters((f) => ({ ...f, status, offset: 0 }))} />
        <SearchForm label="Search messages" placeholder="Name, email, subject or text" value={filters.search ?? ""} onSearch={(search) => setFilters((f) => ({ ...f, search, offset: 0 }))} />
      </div>

      <div className={styles.card}>
        <DataState loading={inbox.loading && !inbox.data} error={inbox.error} empty={!inbox.data?.results.length} emptyText="No messages here.">
          <ul>
            {inbox.data?.results.map((m) => (
              <TriageItem
                key={m.id}
                id={m.id}
                title={`${m.subject} — ${m.name}`}
                status={m.status}
                note={m.admin_note}
                createdAt={m.created_at}
                meta={
                  <>
                    From {m.name} &lt;{m.email}&gt;
                    {m.user_id && (
                      <>
                        {" · "}
                        <Link href={`/admin/users/${m.user_id}`} className={styles.link}>customer account</Link>
                      </>
                    )}
                    {" · "}
                    <a href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className={styles.link}>
                      Reply by email
                    </a>
                  </>
                }
                onUpdate={async (changes) => replace(await updateAdminContact(m.id, changes))}
                onDelete={async () => {
                  await deleteAdminContact(m.id);
                  inbox.reload();
                }}
              >
                {m.message}
              </TriageItem>
            ))}
          </ul>
        </DataState>
      </div>
      {inbox.data && <Pagination total={inbox.data.total} limit={PAGE_SIZE} offset={filters.offset} onChange={(offset) => setFilters((f) => ({ ...f, offset }))} />}
    </>
  );
}
