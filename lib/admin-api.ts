import { API_URL, authFetch, errorMessage } from "@/lib/api";
import type { FeedbackType, TriageStatus } from "@/lib/support";

// The admin dashboard's API client: the /admin endpoints, through the same authFetch as lib/api.ts
// (so an expired or revoked admin session signs out the same way a customer's does).

async function request<T>(path: string, init: RequestInit = {}, fallback = "Request failed"): Promise<T> {
  const res = await authFetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(errorMessage(data, fallback));
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const jsonBody = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Builds `?a=1&b=2`, skipping empty values. */
function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "" && value !== false) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export interface Paged<T> {
  total: number;
  limit: number;
  offset: number;
  results: T[];
}

export interface PageParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export type AccountStatus = "active" | "suspended";

export interface AdminAccount {
  id: string;
  username: string;
  role: "user" | "admin";
  status: AccountStatus;
  plan: "free" | "pro" | null;
  base_currency: string | null;
  created_at: string;
  last_login_at: string | null;
  is_you?: boolean;
}

// --- overview & analytics ---

export interface AdminOverview {
  users: {
    total: number;
    pro: number;
    free: number;
    suspended: number;
    active_last_7d: number;
    signups_today: number;
    signups_last_7d: number;
    signups_last_30d: number;
  };
  admins: { total: number };
  documents: {
    total: number;
    by_status: Record<string, number>;
    created_today: number;
    created_last_7d: number;
    flagged: number;
    avg_confidence: number | null;
  };
  billing: {
    active_subscriptions: number;
    past_due: number;
    canceling_at_period_end: number;
    comped_pro: number;
    estimated_mrr_usd: number;
    price_per_seat_usd: number;
  };
  integrations: { quickbooks_connections: number };
  vendors: { total: number };
  feedback: { total: number; new: number; open_bugs: number };
  contact: { total: number; new: number };
}

export interface NameValue {
  name: string;
  value: number;
}

export interface AdminAnalytics {
  days: number;
  series: { date: string; signups: number; documents: number; failed: number; feedback: number; contact: number }[];
  totals: { signups: number; documents: number; failed: number; failure_rate: number; previous_signups: number; previous_documents: number };
  plans: NameValue[];
  document_statuses: NameValue[];
  categories: NameValue[];
  currencies: NameValue[];
  top_uploaders: { id: string; username: string; plan: string; documents: number }[];
  feedback_types: NameValue[];
}

export const getAdminMe = () => request<AdminAccount>("/admin/me");
export const getAdminOverview = () => request<AdminOverview>("/admin/overview", {}, "Failed to load the overview");
export const getAdminAnalytics = (days: number) => request<AdminAnalytics>(`/admin/analytics${query({ days })}`, {}, "Failed to load analytics");

// --- customers ---

export interface AdminUserRow {
  id: string;
  username: string;
  plan: "free" | "pro";
  status: AccountStatus;
  created_at: string;
  last_login_at: string | null;
  document_count: number;
  subscription_status: string | null;
  cancel_at_period_end: boolean;
}

export interface AdminUserQuery extends PageParams {
  plan?: "free" | "pro";
  status?: AccountStatus;
  sort?: "created_at" | "last_login_at" | "username" | "documents";
  order?: "asc" | "desc";
}

export interface AdminDocument {
  id: string;
  filename: string;
  status: string;
  flags: string | null;
  quickbooks_synced: boolean;
  created_at: string;
}

export interface AdminUserDetail extends AdminAccount {
  usage: { documents_processed_this_month: number; limit: number };
  documents: { total: number; by_status: Record<string, number>; recent: AdminDocument[] };
  subscription: {
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  } | null;
  vendors: number;
  quickbooks_connected: boolean;
  feedback_count: number;
  contact_count: number;
}

export const listAdminUsers = (params: AdminUserQuery = {}) =>
  request<Paged<AdminUserRow>>(`/admin/users${query({ ...params })}`, {}, "Failed to load users");
export const getAdminUser = (id: string) => request<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`, {}, "Failed to load the user");
export const updateAdminUser = (id: string, changes: { plan?: "free" | "pro"; status?: AccountStatus }) =>
  request<AdminAccount>(`/admin/users/${encodeURIComponent(id)}`, jsonBody("PATCH", changes), "Failed to update the user");
export const deleteAdminUser = (id: string) =>
  request<void>(`/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" }, "Failed to delete the user");
export const signOutAdminUser = (id: string) =>
  request<void>(`/admin/users/${encodeURIComponent(id)}/sign-out`, { method: "POST" }, "Failed to sign the user out");
export const sendAdminUserPasswordReset = (id: string) =>
  request<{ message: string }>(`/admin/users/${encodeURIComponent(id)}/password-reset`, { method: "POST" }, "Failed to send the reset link");

// --- admins ---

export const listAdmins = () => request<AdminAccount[]>("/admin/admins", {}, "Failed to load admins");
export const createAdminAccount = (username: string, password: string) =>
  request<AdminAccount>("/admin/admins", jsonBody("POST", { username, password }), "Failed to create the admin");
export const updateAdminAccount = (id: string, status: AccountStatus) =>
  request<AdminAccount>(`/admin/admins/${encodeURIComponent(id)}`, jsonBody("PATCH", { status }), "Failed to update the admin");
export const deleteAdminAccount = (id: string) =>
  request<void>(`/admin/admins/${encodeURIComponent(id)}`, { method: "DELETE" }, "Failed to delete the admin");

// --- support inboxes ---

export interface TriageList<T> extends Paged<T> {
  status_counts: Partial<Record<TriageStatus, number>>;
}

export interface TriageChanges {
  status?: TriageStatus;
  admin_note?: string | null;
}

export interface AdminFeedback {
  id: string;
  type: FeedbackType | string;
  message: string;
  page: string | null;
  status: TriageStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
  user_id: string | null;
  username: string | null;
}

export interface AdminContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: TriageStatus;
  admin_note: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export const listAdminFeedback = (params: PageParams & { type?: FeedbackType; status?: TriageStatus } = {}) =>
  request<TriageList<AdminFeedback>>(`/admin/feedback${query({ ...params })}`, {}, "Failed to load feedback");
export const updateAdminFeedback = (id: string, changes: TriageChanges) =>
  request<AdminFeedback>(`/admin/feedback/${encodeURIComponent(id)}`, jsonBody("PATCH", changes), "Failed to update feedback");
export const deleteAdminFeedback = (id: string) =>
  request<void>(`/admin/feedback/${encodeURIComponent(id)}`, { method: "DELETE" }, "Failed to delete feedback");

export const listAdminContact = (params: PageParams & { status?: TriageStatus } = {}) =>
  request<TriageList<AdminContactMessage>>(`/admin/contact${query({ ...params })}`, {}, "Failed to load messages");
export const updateAdminContact = (id: string, changes: TriageChanges) =>
  request<AdminContactMessage>(`/admin/contact/${encodeURIComponent(id)}`, jsonBody("PATCH", changes), "Failed to update the message");
export const deleteAdminContact = (id: string) =>
  request<void>(`/admin/contact/${encodeURIComponent(id)}`, { method: "DELETE" }, "Failed to delete the message");

// --- documents ---

export interface AdminDocumentRow extends AdminDocument {
  owner_id: string;
  owner_username: string;
}

export const listAdminDocuments = (params: PageParams & { status?: string; flagged?: boolean } = {}) =>
  request<Paged<AdminDocumentRow>>(`/admin/documents${query({ ...params })}`, {}, "Failed to load documents");
export const reprocessAdminDocument = (id: string) =>
  request<{ status: string }>(`/admin/documents/${encodeURIComponent(id)}/reprocess`, { method: "POST" }, "Failed to reprocess the document");

// --- audit log ---

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_username: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const getAuditLog = (params: PageParams & { area?: string } = {}) =>
  request<Paged<AuditEntry>>(`/admin/audit-log${query({ ...params })}`, {}, "Failed to load the audit log");
