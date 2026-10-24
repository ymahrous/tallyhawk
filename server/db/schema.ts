import { randomUUID } from "node:crypto";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import type { TriageStatus } from "@/lib/support";

// These tables mirror, column for column, the ones the former FastAPI/SQLModel backend created
// (SQLModel names tables after the lowercased class name, hence "usagerecord" etc.). Existing
// production databases therefore keep working without a data migration; `server/db/migrations`
// only creates what's missing.
//
// Column defaults are applied in JS ($defaultFn) rather than as DB defaults because SQLModel
// created most of these columns NOT NULL *without* a server default.

export type AccountRole = "user" | "admin";
export type AccountStatus = "active" | "suspended";

const id = () =>
  varchar("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

/** `timestamp without time zone`, always written and read as UTC. */
const naiveTimestamp = (name: string) => timestamp(name, { mode: "date" });

export const users = pgTable(
  "user",
  {
    id: id(),
    username: varchar("username").notNull(),
    hashedPassword: varchar("hashed_password").notNull(),
    plan: varchar("plan").notNull().default("free"),
    baseCurrency: varchar("base_currency", { length: 3 }).notNull().default("USD"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    // "user" (a customer) or "admin" (staff). The two never overlap: admins have no documents,
    // billing or settings, and customer routes refuse admin sessions (server/http.ts).
    role: varchar("role").$type<AccountRole>().notNull().default("user"),
    status: varchar("status").$type<AccountStatus>().notNull().default("active"),
    // Embedded in session tokens as `ver`; bumping it revokes every session of the account.
    tokenVersion: integer("token_version").notNull().default(0),
    lastLoginAt: timestamp("last_login_at", { mode: "date", withTimezone: true }),
  },
  (t) => [unique("ix_user_username").on(t.username), index("ix_user_role").on(t.role)]
);

export const documents = pgTable(
  "document",
  {
    id: id(),
    filename: varchar("filename").notNull(),
    s3Url: varchar("s3_url").notNull(),
    status: varchar("status")
      .notNull()
      .$defaultFn(() => "PENDING"),
    quickbooksSynced: boolean("quickbooks_synced")
      .notNull()
      .$defaultFn(() => false),
    createdAt: naiveTimestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    ownerId: varchar("owner_id")
      .notNull()
      .references(() => users.id),
    flags: varchar("flags"),
    // Object key in storage: `<ownerId>/<uuid>.<ext>`. Null on legacy rows, whose key is `filename`.
    storagePath: varchar("storage_path"),
  },
  (t) => [index("ix_document_owner_id").on(t.ownerId)]
);

export const vendors = pgTable(
  "vendor",
  {
    id: id(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    canonicalName: varchar("canonical_name").notNull(),
    aliases: json("aliases")
      .$type<string[]>()
      .$defaultFn(() => []),
    createdAt: naiveTimestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("ix_vendor_user_id").on(t.userId),
    index("ix_vendor_canonical_name").on(t.canonicalName),
    unique("vendor_user_id_canonical_name_key").on(t.userId, t.canonicalName),
  ]
);

export interface ExtractedData {
  vendor?: string | null;
  total_amount?: string | number | null;
  currency?: string | null;
  date?: string | null;
  category?: string | null;
  [key: string]: unknown;
}

export const extractions = pgTable(
  "extraction",
  {
    id: id(),
    documentId: varchar("document_id")
      .notNull()
      .references(() => documents.id),
    extractedData: json("extracted_data")
      .$type<ExtractedData>()
      .$defaultFn(() => ({})),
    confidenceScore: doublePrecision("confidence_score")
      .notNull()
      .$defaultFn(() => 0),
    category: varchar("category"),
    vendorId: varchar("vendor_id").references(() => vendors.id),
    originalCurrency: varchar("original_currency", { length: 3 }),
    originalAmount: doublePrecision("original_amount"),
    convertedAmount: doublePrecision("converted_amount"),
    // Currency `convertedAmount` is actually denominated in — a snapshot of the user's base_currency
    // AT PROCESSING TIME. Do not assume it equals the user's *current* base_currency.
    convertedCurrency: varchar("converted_currency", { length: 3 }),
    exchangeRate: doublePrecision("exchange_rate"),
  },
  (t) => [index("ix_extraction_vendor_id").on(t.vendorId)]
);

export const subscriptions = pgTable(
  "subscription",
  {
    id: id(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    plan: varchar("plan")
      .notNull()
      .$defaultFn(() => "free"),
    stripeCustomerId: varchar("stripe_customer_id"),
    stripeSubscriptionId: varchar("stripe_subscription_id"),
    status: varchar("status")
      .notNull()
      .$defaultFn(() => "inactive"),
    currentPeriodEnd: naiveTimestamp("current_period_end"),
    currentPeriodStart: naiveTimestamp("current_period_start"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: naiveTimestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: naiveTimestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    unique("ix_subscription_user_id").on(t.userId),
    unique("subscription_stripe_customer_id_key").on(t.stripeCustomerId),
    unique("subscription_stripe_subscription_id_key").on(t.stripeSubscriptionId),
  ]
);

export const usageRecords = pgTable(
  "usagerecord",
  {
    id: id(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    month: naiveTimestamp("month").notNull(),
    documentsProcessed: integer("documents_processed")
      .notNull()
      .$defaultFn(() => 0),
  },
  (t) => [
    index("ix_usagerecord_user_id").on(t.userId),
    unique("usagerecord_user_id_month_key").on(t.userId, t.month),
  ]
);

export const quickbooksConnections = pgTable(
  "quickbooksconnection",
  {
    id: id(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    realmId: varchar("realm_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    createdAt: naiveTimestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: naiveTimestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    unique("ix_quickbooksconnection_user_id").on(t.userId),
    index("ix_quickbooksconnection_realm_id").on(t.realmId),
  ]
);

export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    userId: varchar("user_id").references(() => users.id),
    type: varchar("type")
      .notNull()
      .$defaultFn(() => "Suggestion"),
    message: varchar("message").notNull(),
    createdAt: naiveTimestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    status: varchar("status").$type<TriageStatus>().notNull().default("new"),
    adminNote: varchar("admin_note"),
    /** App path the feedback was sent from, e.g. "/app". */
    page: varchar("page"),
    updatedAt: naiveTimestamp("updated_at"),
  },
  (t) => [index("ix_feedback_user_id").on(t.userId)]
);

export const contactMessages = pgTable(
  "contactmessage",
  {
    id: id(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    name: varchar("name").notNull(),
    email: varchar("email").notNull(),
    subject: varchar("subject").notNull(),
    message: varchar("message").notNull(),
    status: varchar("status").$type<TriageStatus>().notNull().default("new"),
    adminNote: varchar("admin_note"),
    createdAt: naiveTimestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: naiveTimestamp("updated_at"),
  },
  (t) => [index("ix_contactmessage_status").on(t.status), index("ix_contactmessage_created_at").on(t.createdAt)]
);

export const auditLog = pgTable(
  "auditlog",
  {
    id: id(),
    actorId: varchar("actor_id"),
    actorUsername: varchar("actor_username").notNull(),
    action: varchar("action").notNull(),
    targetType: varchar("target_type"),
    targetId: varchar("target_id"),
    targetLabel: varchar("target_label"),
    details: json("details").$type<Record<string, unknown>>(),
    ipHash: varchar("ip_hash"),
    createdAt: naiveTimestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("ix_auditlog_created_at").on(t.createdAt), index("ix_auditlog_action").on(t.action)]
);

export const stripeEvents = pgTable("stripeevent", {
  id: varchar("id").primaryKey(),
  type: varchar("type").notNull(),
  createdAt: naiveTimestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const rateLimits = pgTable(
  "ratelimit",
  {
    key: varchar("key").primaryKey(),
    count: integer("count").notNull(),
    windowStart: timestamp("window_start", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [index("ix_ratelimit_window_start").on(t.windowStart)]
);

export const passwordResetTokens = pgTable(
  "passwordresettoken",
  {
    id: id(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    /** SHA-256 (hex) of the token in the emailed link; the token itself is never stored. */
    token: varchar("token").notNull(),
    expiresAt: naiveTimestamp("expires_at")
      .notNull()
      .$defaultFn(() => new Date(Date.now() + 60 * 60 * 1000)),
    used: boolean("used").notNull().default(false),
  },
  (t) => [
    index("ix_passwordresettoken_user_id").on(t.userId),
    unique("ix_passwordresettoken_token").on(t.token),
  ]
);

export type User = typeof users.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type ExtractionRow = typeof extractions.$inferSelect;
export type VendorRow = typeof vendors.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type FeedbackRow = typeof feedback.$inferSelect;
export type ContactMessageRow = typeof contactMessages.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;
