const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface Document {
  id: string;
  filename: string;
  s3_url: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  created_at: string;
  quickbooks_synced: boolean;
  flags?: string | null;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface VendorData {
  id: string;
  canonical_name: string;
  aliases: string[];
}

export interface Extraction {
  document_id: string;
  extracted_data: {
    vendor: string;
    total_amount: string;
    date: string;
    category?: string;
  };
  confidence_score: number;
  category?: string;
  vendor_id?: string | null;
  vendor?: VendorData | null;
}

export type TokenPayload = {
  sub: string;
  exp: number;
  plan?: string;
  iat?: number;
  [key: string]: unknown;
};

export interface SubscriptionData {
  plan: string;
  status: string;
  current_period_end: string | null;
  last_renewal_date: string | null;
}

export async function getSubscription(): Promise<SubscriptionData> {
  const res = await authFetch(`${API_URL}/billing/subscription`);
  if (!res.ok) throw new Error("Failed to fetch subscription");
  return res.json();
}

export function decodeToken(): TokenPayload | null {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

// --- AUTH FUNCTIONS ---
export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    let detail = "Invalid credentials";
    try {
      const errorData = await res.json();
      if (typeof errorData.detail === "string") detail = errorData.detail;
    } catch {
      // Response body was not valid JSON; use default message
    }
    throw new Error(detail);
  }

  const data: AuthResponse = await res.json();
  localStorage.setItem("token", data.access_token);
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  window.dispatchEvent(new Event("storage"));
}

export async function signup(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Signup failed");
  }

  const data = await res.json();
  localStorage.setItem("token", data.access_token);
}

export function isTokenExpired(): boolean {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // exp is in seconds; Date.now() is in ms
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// --- PROTECTED FETCH WRAPPER ---
async function authFetch(url: string, options: RequestInit = {}) {
  if (isTokenExpired()) {
    if (typeof window !== "undefined") localStorage.removeItem("token");
    throw new Error("Session expired");
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") localStorage.removeItem("token");
    throw new Error("Session expired");
  }

  return res;
}

// --- APP FUNCTIONS ---
export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authFetch(`${API_URL}/upload/`, {
    method: "POST",
    body: formData,
  });
  
  if (!res.ok) {
    // Try to extract the specific error detail from the backend
    const errorData = await res.json().catch(() => ({}));
    if (errorData.detail && errorData.detail.error === "limit_exceeded") {
      throw new Error("limit_exceeded");
    }
    throw new Error(errorData.detail || "Upload failed");
  }
  
  return res.json();
}

export async function getDocuments(signal?: AbortSignal): Promise<Document[]> {
  const res = await authFetch(`${API_URL}/documents/`, { signal });
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function getExtraction(documentId: string): Promise<Extraction> {
  const res = await authFetch(`${API_URL}/extraction/${documentId}`);
  if (!res.ok) throw new Error("Extraction not ready");
  return res.json();
}

export async function updateCategory(documentId: string, category: string): Promise<void> {
  const res = await authFetch(`${API_URL}/extraction/${documentId}/category`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error("Failed to update category");
}

export async function exportTaxSummary(year: number): Promise<void> {
  const res = await authFetch(`${API_URL}/reports/tax-summary?year=${year}`);
  if (!res.ok) throw new Error("Failed to export tax summary");
  
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `edocAI_Tax_Summary_${year}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/documents/${documentId}`, {
    method: "DELETE",
  });

  if (!res.ok && res.status !== 204) {
    throw new Error("Failed to delete document");
  }
}

// --- BILLING FUNCTIONS ---
export async function createCheckoutSession(): Promise<{ url: string }> {
  const res = await authFetch(`${API_URL}/billing/create-checkout-session`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to create checkout session");
  return res.json();
}

// Add these to lib/api.ts

export interface UsageData {
  plan: string;
  documents_processed: number;
  limit: number;
}

export async function getUsage(): Promise<UsageData> {
  const res = await authFetch(`${API_URL}/billing/usage`);
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json();
}

// --- QUICKBOOKS FUNCTIONS ---
export async function getQuickBooksConnectUrl(): Promise<{ url: string }> {
  const res = await authFetch(`${API_URL}/quickbooks/connect`);
  if (!res.ok) throw new Error("Failed to get QuickBooks connect URL");
  return res.json();
}

export async function getQuickBooksStatus(): Promise<{ connected: boolean }> {
  const res = await authFetch(`${API_URL}/quickbooks/status`);
  if (!res.ok) throw new Error("Failed to get QuickBooks status");
  return res.json();
}

export async function syncToQuickBooks(documentId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/quickbooks/sync/${documentId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to sync to QuickBooks");
  }
}

export async function disconnectQuickBooks(): Promise<void> {
  const res = await authFetch(`${API_URL}/quickbooks/disconnect`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to disconnect QuickBooks");
  }
}

export async function checkQuickBooksSyncStatus(documentId: string): Promise<{ synced: boolean }> {
  const res = await authFetch(`${API_URL}/quickbooks/sync-status/${documentId}`);
  if (!res.ok) return { synced: false };
  return res.json();
}

export interface CategorySpend { name: string; value: number; }
export interface VendorSpend { name: string; value: number; }
export interface MonthlySpend { month: string; spend: number; }

export async function getCategorySpend(year: number, month?: number): Promise<CategorySpend[]> {
  let url = `${API_URL}/analytics/spend-by-category?year=${year}`;
  if (month) url += `&month=${month}`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error("Failed to fetch category spend");
  return res.json();
}

export async function getVendorSpend(year: number, month?: number): Promise<VendorSpend[]> {
  let url = `${API_URL}/analytics/spend-by-vendor?year=${year}`;
  if (month) url += `&month=${month}`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error("Failed to fetch vendor spend");
  return res.json();
}

export async function getMonthlyTrend(year: number): Promise<MonthlySpend[]> {
  const res = await authFetch(`${API_URL}/analytics/monthly-trend?year=${year}`);
  if (!res.ok) throw new Error("Failed to fetch monthly trend");
  return res.json();
}

export interface DashboardStats {
  processed: number;
  synced: number;
  month_spend: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await authFetch(`${API_URL}/stats/dashboard`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Failed to request reset");
}

export async function resetPassword(token: string, new_password: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Failed to reset password");
}