// How long Tallyhawk keeps personal data. One schedule, read by the daily retention job
// (server/retention.ts), the admin dashboard and the legal pages, so what the policy promises is
// what the code does. Change a number here and all of them follow.
//
// Each period is the minimum its purpose needs. When it ends, the personal parts (emails, names,
// message text, account and Stripe ids) are removed and the anonymized remainder (types, statuses,
// plans and dates) is kept for statistics. Data that is never useful anonymized is deleted.

export const RETENTION = {
  /**
   * Deletion records: the email, former account id and Stripe ids are removed this long after the
   * deletion. That outlasts the usual window for disputing a card payment (about 120 days from the
   * payment, which always predates the deletion).
   */
  deletionRecordIdentifiersDays: 120,
  /** Contact messages and feedback: sender details and text are removed this long after arrival. */
  supportMessageDays: 180,
  /** Admin audit log: the target (an email) and the IP hash are removed after this long, the usual minimum for security logs. */
  auditLogIdentifiersDays: 365,
  /** Handled Stripe event ids (no personal data; only needed to ignore Stripe's retries, which stop after 3 days). */
  stripeEventDays: 30,
  /** Password-reset links work for this long and are deleted as soon as they expire or are used. */
  resetLinkMinutes: 60,
  /** Rate-limit counters are deleted once their window (never longer than this) has passed. */
  rateLimitHours: 1,
  /** Backups held by our hosting providers roll over within this many days. */
  backupDays: 30,
  /** Deleting an account removes its data from primary systems within this many hours. */
  accountPurgeHours: 48,
} as const;

/** "1 hour", "120 days", "60 minutes" for policy text and UI. */
export function period(value: number, unit: "day" | "hour" | "minute"): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}
