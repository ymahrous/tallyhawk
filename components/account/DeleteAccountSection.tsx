"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount, logout } from "@/lib/api";
import { RETENTION, period } from "@/lib/retention";

const DELETE_PHRASE = "delete my account";

/**
 * The account page's danger zone. Deleting is only possible after reading what it means (no refund,
 * nothing recoverable), ticking the acknowledgement and typing the phrase. The wording matches
 * Terms §12 and the Privacy Policy's Data Retention section.
 */
export default function DeleteAccountSection({ isDark }: { isDark: boolean }) {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const body = isDark ? "text-gray-200" : "text-gray-700";
  const canDelete = phrase === DELETE_PHRASE && acknowledged && !isDeleting;

  const handleDelete = async () => {
    if (phrase !== DELETE_PHRASE || !acknowledged) return;
    setIsDeleting(true);
    setError("");
    try {
      await deleteAccount();
      logout();
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section aria-labelledby="danger-zone-heading" className="rounded-2xl border border-red-500/30 p-8">
      <div className="mb-6">
        <h2 id="danger-zone-heading" className="text-base font-semibold text-red-500">Danger Zone</h2>
        <p className={`text-sm mt-1 ${muted}`}>Permanently delete your account. This cannot be undone.</p>
      </div>

      <div className={`mb-6 rounded-xl border p-4 text-sm ${isDark ? "border-red-500/30 bg-red-500/10" : "border-red-200 bg-red-50"}`}>
        <p className={`mb-2 font-semibold ${isDark ? "text-red-300" : "text-red-800"}`}>Before you delete</p>
        <ul className={`list-disc space-y-1.5 pl-5 ${body}`}>
          <li>
            <strong>No refunds.</strong> Any Pro subscription ends immediately, and you can't claim a refund, credit or any other
            compensation for payments you've already made, including the rest of your current billing period (except where the law
            requires one).
          </li>
          <li>
            <strong>Nothing can be recovered.</strong> Your documents, extracted data, vendors, settings and QuickBooks connection are
            deleted for good.
          </li>
          <li>
            <strong>Your account can't be restored.</strong> Signing up again with the same email starts a new, empty Free account.
          </li>
          <li>
            We keep a minimal record (your email, plan and billing identifiers) for {period(RETENTION.deletionRecordIdentifiersDays, "day")}{" "}
            to handle payment disputes; after that only an anonymized version remains.
          </li>
        </ul>
      </div>

      <div className="space-y-4">
        <label className={`flex items-start gap-3 text-sm ${body}`}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
          />
          I understand that I won't get a refund and can't recover my account or data.
        </label>

        <div className="space-y-1.5">
          <label htmlFor="delete-confirm" className={`text-xs font-medium uppercase tracking-wider ${muted}`}>
            Type <span className="text-red-400 font-mono normal-case tracking-normal">{DELETE_PHRASE}</span> to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            autoComplete="off"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={DELETE_PHRASE}
            className={`w-full text-sm px-4 py-3 rounded-xl border outline-none transition-colors ${
              isDark
                ? "bg-white/5 border-red-500/20 text-white focus:border-red-500 placeholder-gray-600"
                : "bg-white border-red-200 text-gray-900 focus:border-red-500 placeholder-gray-400"
            }`}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          onClick={handleDelete}
          disabled={!canDelete}
          className="w-full bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-700 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-all"
        >
          {isDeleting ? "Deleting..." : "Permanently Delete Account"}
        </button>
      </div>
    </section>
  );
}
