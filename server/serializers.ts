import "server-only";
import type { DocumentRow, ExtractionRow, User, VendorRow } from "./db/schema";

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
