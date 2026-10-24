"use client";

import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { AdminHeader, DataState, StatusBadge } from "@/components/admin/parts";
import { adminStyles, formatDateTime, formatDay } from "@/components/admin/styles";
import { useAdminData } from "@/components/admin/useAdminData";
import { createAdminAccount, deleteAdminAccount, listAdmins, updateAdminAccount, type AdminAccount } from "@/lib/admin-api";
import { validateEmail, validatePassword } from "@/lib/validation";

export default function AdminAdminsPage() {
  const styles = adminStyles(useTheme().theme === "dark");
  const admins = useAdminData(listAdmins, "admins");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState("");

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setNotice("");
    const problem = validateEmail(email.trim()) || validatePassword(password);
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy("create");
    try {
      const created = await createAdminAccount(email.trim(), password);
      setNotice(`Admin ${created.username} created. Share the password with them over a secure channel.`);
      setEmail("");
      setPassword("");
      admins.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't create the admin.");
    } finally {
      setBusy("");
    }
  };

  const act = async (admin: AdminAccount, action: "suspend" | "reactivate" | "delete") => {
    const prompts = {
      suspend: `Suspend ${admin.username}? They'll be signed out immediately.`,
      reactivate: `Reactivate ${admin.username}?`,
      delete: `Delete the admin account ${admin.username}? This can't be undone.`,
    };
    if (!confirm(prompts[action])) return;
    setBusy(admin.id);
    setActionError("");
    try {
      if (action === "delete") await deleteAdminAccount(admin.id);
      else await updateAdminAccount(admin.id, action === "suspend" ? "suspended" : "active");
      admins.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <AdminHeader title="Admins" description="Staff accounts with access to this dashboard. Admins are separate from customer accounts." />

      <div className={`${styles.card} overflow-x-auto`}>
        {actionError && <p role="alert" className={`m-4 ${styles.error}`}>{actionError}</p>}
        <DataState loading={admins.loading && !admins.data} error={admins.error} empty={!admins.data?.length} emptyText="No admins.">
          <table className="w-full">
            <thead>
              <tr>
                <th scope="col" className={styles.th}>Email</th>
                <th scope="col" className={styles.th}>Status</th>
                <th scope="col" className={styles.th}>Added</th>
                <th scope="col" className={styles.th}>Last login</th>
                <th scope="col" className={styles.th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {admins.data?.map((a) => (
                <tr key={a.id} className={`border-t ${styles.divider}`}>
                  <td className={`${styles.td} ${styles.body}`}>
                    {a.username} {a.is_you && <span className={`ml-1 text-xs ${styles.muted}`}>(you)</span>}
                  </td>
                  <td className={styles.td}><StatusBadge status={a.status} /></td>
                  <td className={`${styles.td} ${styles.body}`}>{formatDay(a.created_at)}</td>
                  <td className={`${styles.td} ${styles.body}`}>{formatDateTime(a.last_login_at)}</td>
                  <td className={`${styles.td} text-right`}>
                    {!a.is_you && (
                      <span className="flex justify-end gap-2">
                        <button className={styles.secondaryButton} disabled={busy === a.id} onClick={() => act(a, a.status === "active" ? "suspend" : "reactivate")}>
                          {a.status === "active" ? "Suspend" : "Reactivate"}
                        </button>
                        <button className={styles.dangerButton} disabled={busy === a.id} onClick={() => act(a, "delete")}>Delete</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <section aria-labelledby="new-admin-heading" className={`${styles.card} mt-6 p-6`}>
        <h2 id="new-admin-heading" className={`text-base font-semibold ${styles.heading}`}>Add an admin</h2>
        <p className={`mt-1 text-sm ${styles.muted}`}>Creates a new admin account. Use an email address that isn't a customer account.</p>
        <form onSubmit={create} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]" noValidate>
          <div>
            <label htmlFor="new-admin-email" className={`mb-1 block text-xs font-medium ${styles.muted}`}>Email</label>
            <input id="new-admin-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={`${styles.input} w-full`} />
          </div>
          <div>
            <label htmlFor="new-admin-password" className={`mb-1 block text-xs font-medium ${styles.muted}`}>Initial password</label>
            <input id="new-admin-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${styles.input} w-full`} />
          </div>
          <button type="submit" disabled={busy === "create"} className={`${styles.primaryButton} self-end`}>
            {busy === "create" ? "Creating…" : "Create admin"}
          </button>
        </form>
        {formError && <p role="alert" className={`mt-3 ${styles.error}`}>{formError}</p>}
        {notice && <p role="status" className={`mt-3 ${styles.success}`}>{notice}</p>}
      </section>
    </>
  );
}
