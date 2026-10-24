import "server-only";
import type { AuditLogRow, ContactMessageRow, DocumentRow, ExtractionRow, FeedbackRow, User, VendorRow } from "./db/schema";

// snake_case response shapes, identical to what the FastAPI backend returned.

export function serializeDocument(d: DocumentRow) {
  return {
    id: d.id,
    filename: d.filename,
    s3_url: d.s3Url,
    status: d.status,
    quickbooks_synced: d.quickbooksSynced,
    created_at: d.createdAt.toISOString(),
    owner_id: d.ownerId,
    flags: d.flags,
  };
}

export function serializeExtraction(e: ExtractionRow, vendor: VendorRow | null) {
  return {
    id: e.id,
    document_id: e.documentId,
    extracted_data: e.extractedData ?? {},
    confidence_score: e.confidenceScore,
    category: e.category,
    vendor_id: e.vendorId,
    vendor: vendor ? { id: vendor.id, canonical_name: vendor.canonicalName, aliases: vendor.aliases ?? [] } : null,
    original_currency: e.originalCurrency,
    original_amount: e.originalAmount,
    converted_amount: e.convertedAmount,
    converted_currency: e.convertedCurrency,
    exchange_rate: e.exchangeRate,
  };
}

export function serializeSettings(u: User) {
  return {
    id: u.id,
    username: u.username,
    plan: u.plan,
    base_currency: u.baseCurrency,
    created_at: u.createdAt.toISOString(),
  };
}

// --- admin dashboard --------------------------------------------------------------------------

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

/** An account as admins see it. Never includes the password hash or token version. */
export function serializeAccount(u: User) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status,
    plan: u.role === "user" ? u.plan : null,
    base_currency: u.role === "user" ? u.baseCurrency : null,
    created_at: u.createdAt.toISOString(),
    last_login_at: iso(u.lastLoginAt),
  };
}

export function serializeFeedback(f: FeedbackRow, username: string | null) {
  return {
    id: f.id,
    type: f.type,
    message: f.message,
    page: f.page,
    status: f.status,
    admin_note: f.adminNote,
    created_at: f.createdAt.toISOString(),
    updated_at: iso(f.updatedAt),
    user_id: f.userId,
    username,
  };
}

export function serializeContactMessage(m: ContactMessageRow) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    status: m.status,
    admin_note: m.adminNote,
    user_id: m.userId,
    created_at: m.createdAt.toISOString(),
    updated_at: iso(m.updatedAt),
  };
}

export function serializeAuditEntry(a: AuditLogRow) {
  return {
    id: a.id,
    actor_id: a.actorId,
    actor_username: a.actorUsername,
    action: a.action,
    target_type: a.targetType,
    target_id: a.targetId,
    target_label: a.targetLabel,
    details: a.details,
    created_at: a.createdAt.toISOString(),
  };
}
