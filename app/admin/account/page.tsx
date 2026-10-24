"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import { AdminHeader, DataState } from "@/components/admin/parts";
import { adminStyles, formatDateTime, formatDay } from "@/components/admin/styles";
import { useAdminData } from "@/components/admin/useAdminData";
import PasswordStrengthMeter from "@/components/ui/PasswordStrengthMeter";
import { getAdminMe } from "@/lib/admin-api";
import { changePassword, decodeToken, logout, logoutEverywhere } from "@/lib/api";
import { validatePassword } from "@/lib/validation";

/** The signed-in admin's own account: details, password and sessions. */
export default function AdminAccountPage() {
  const isDark = useTheme().theme === "dark";
  const styles = adminStyles(isDark);
  const router = useRouter();
  const me = useAdminData(getAdminMe, "me");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const expires = decodeToken()?.exp;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    const problem = validatePassword(next) || (next !== confirmNext ? "Passwords do not match." : "");
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setNotice("Password updated. Your other sessions were signed out.");
      setCurrent("");
      setNext("");
      setConfirmNext("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the password.");
    } finally {
      setBusy(false);
    }
  };

  const field = (id: string, label: string, value: string, onChange: (v: string) => void, autoComplete: string) => (
    <div>
      <label htmlFor={id} className={`mb-1 block text-xs font-medium ${styles.muted}`}>{label}</label>
      <input id={id} type="password" autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className={`${styles.input} w-full`} />
    </div>
  );

  return (
    <>
      <AdminHeader title="Admin account" description="Your own admin login. Admin sessions last 12 hours." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section aria-labelledby="profile-heading" className={`${styles.card} p-6`}>
          <h2 id="profile-heading" className={`mb-4 text-base font-semibold ${styles.heading}`}>Profile</h2>
          <DataState loading={me.loading && !me.data} error={me.error} empty={false} emptyText="">
            {me.data && (
              <dl className={`grid grid-cols-2 gap-3 text-sm ${styles.body}`}>
                <dt className={styles.muted}>Email</dt>
                <dd className="break-all">{me.data.username}</dd>
                <dt className={styles.muted}>Admin since</dt>
                <dd>{formatDay(me.data.created_at)}</dd>
                <dt className={styles.muted}>Last login</dt>
                <dd>{formatDateTime(me.data.last_login_at)}</dd>
                <dt className={styles.muted}>This session ends</dt>
                <dd>{expires ? formatDateTime(new Date(expires * 1000).toISOString()) : "—"}</dd>
              </dl>
            )}
          </DataState>
          <div className={`mt-6 flex flex-wrap gap-2 border-t pt-6 ${styles.divider}`}>
            <button className={styles.secondaryButton} onClick={() => { logout(); router.push("/login"); }}>Sign out</button>
            <button
              className={styles.dangerButton}
              onClick={async () => {
                if (!confirm("Sign out of every device, including this one?")) return;
                try {
                  await logoutEverywhere();
                  router.push("/login");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Something went wrong.");
                }
              }}
            >
              Sign out everywhere
            </button>
          </div>
        </section>

        <section aria-labelledby="password-heading" className={`${styles.card} p-6`}>
          <h2 id="password-heading" className={`mb-4 text-base font-semibold ${styles.heading}`}>Change password</h2>
          <form onSubmit={submit} className="space-y-3" noValidate>
            {field("admin-current-password", "Current password", current, setCurrent, "current-password")}
            {field("admin-new-password", "New password", next, setNext, "new-password")}
            <PasswordStrengthMeter password={next} isDark={isDark} />
            {field("admin-confirm-password", "Confirm new password", confirmNext, setConfirmNext, "new-password")}
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {notice && <p role="status" className={styles.success}>{notice}</p>}
            <button type="submit" disabled={busy || !current || !next || !confirmNext} className={styles.primaryButton}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
