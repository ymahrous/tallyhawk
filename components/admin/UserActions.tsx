"use client";

import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import {
  deleteAdminUser,
  sendAdminUserPasswordReset,
  signOutAdminUser,
  updateAdminUser,
  type AdminUserDetail,
} from "@/lib/admin-api";
import { RETENTION, period } from "@/lib/retention";
import { adminStyles } from "./styles";

interface Props {
  user: AdminUserDetail;
  /** Called with a confirmation message after a change, so the page can show it and reload. */
  onChanged: (message: string) => void;
  onDeleted: () => void;
}

/** Everything an admin can do to one customer. Every action is recorded in the audit log. */
export default function UserActions({ user, onChanged, onDeleted }: Props) {
  const styles = adminStyles(useTheme().theme === "dark");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const hasLiveSubscription = Boolean(user.subscription && ["active", "trialing", "past_due"].includes(user.subscription.status));

  const run = async (name: string, action: () => Promise<string | void>) => {
    setBusy(name);
    setError("");
    try {
      const message = await action();
      if (message) onChanged(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  };

  const togglePlan = () => {
    const plan = user.plan === "pro" ? "free" : "pro";
    const warning =
      plan === "free" && hasLiveSubscription
        ? `${user.username} has a live Stripe subscription, which keeps billing them. Revoke Pro anyway?`
        : plan === "pro"
          ? `Give ${user.username} Pro without a subscription?`
          : `Move ${user.username} to the Free plan?`;
    if (!confirm(warning)) return;
    run("plan", async () => {
      await updateAdminUser(user.id, { plan });
      return plan === "pro" ? "Pro granted." : "Moved to the Free plan.";
    });
  };

  const toggleStatus = () => {
    const status = user.status === "active" ? "suspended" : "active";
    if (status === "suspended" && !confirm(`Suspend ${user.username}? They'll be signed out and unable to log in.`)) return;
    run("status", async () => {
      await updateAdminUser(user.id, { status });
      return status === "suspended" ? "Account suspended and signed out everywhere." : "Account reactivated.";
    });
  };

  return (
    <section aria-labelledby="actions-heading" className={`${styles.card} p-6`}>
      <h2 id="actions-heading" className={`mb-4 text-base font-semibold ${styles.heading}`}>Actions</h2>
      {error && <p role="alert" className={`mb-4 ${styles.error}`}>{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button className={styles.secondaryButton} disabled={!!busy} onClick={togglePlan}>
          {busy === "plan" ? "Saving…" : user.plan === "pro" ? "Revoke Pro" : "Grant Pro"}
        </button>
        <button className={user.status === "active" ? styles.dangerButton : styles.secondaryButton} disabled={!!busy} onClick={toggleStatus}>
          {busy === "status" ? "Saving…" : user.status === "active" ? "Suspend" : "Reactivate"}
        </button>
        <button
          className={styles.secondaryButton}
          disabled={!!busy}
          onClick={() =>
            confirm(`Sign ${user.username} out of every device?`) &&
            run("signout", async () => {
              await signOutAdminUser(user.id);
              return "Signed out of every session.";
            })
          }
        >
          {busy === "signout" ? "Signing out…" : "Sign out everywhere"}
        </button>
        <button className={styles.secondaryButton} disabled={!!busy} onClick={() => run("reset", async () => (await sendAdminUserPasswordReset(user.id)).message)}>
          {busy === "reset" ? "Sending…" : "Email password reset"}
        </button>
      </div>

      <div className={`mt-6 border-t pt-6 ${styles.divider}`}>
        <h3 className="text-sm font-semibold text-red-500">Delete account</h3>
        <p className={`mt-1 text-xs ${styles.muted}`}>
          Cancels any Stripe subscription (no refund is issued) and permanently deletes the account, its documents and files. This
          can't be undone. A deletion record stays under Deleted accounts and is anonymized after{" "}
          {period(RETENTION.deletionRecordIdentifiersDays, "day")}.
        </p>
        <label htmlFor="confirm-delete" className={`mt-3 block text-xs ${styles.muted}`}>
          Type <span className="font-mono">{user.username}</span> to confirm
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input id="confirm-delete" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className={`${styles.input} flex-1`} autoComplete="off" />
          <button
            className={styles.dangerButton}
            disabled={!!busy || confirmEmail !== user.username}
            onClick={() =>
              run("delete", async () => {
                await deleteAdminUser(user.id);
                onDeleted();
              })
            }
          >
            {busy === "delete" ? "Deleting…" : "Delete customer"}
          </button>
        </div>
      </div>
    </section>
  );
}
