"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  uploadDocument, getDocuments, getExtraction, deleteDocument,
  Document, Extraction, isTokenExpired, getQuickBooksStatus,
  getDashboardStats, DashboardStats
} from "@/lib/api";
import { useSettings } from "@/app/providers/SettingsContext";
import { formatCurrency, CurrencyCode } from "@/lib/currency";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UsageMeter from "@/components/ui/UsageMeter";
import { useTheme } from "@/app/providers/ThemeContext";
import UpgradePrompt from "@/components/ui/UpgradePrompt";
import UploadZone from "@/components/dashboard/UploadZone";
import DocumentCard from "@/components/dashboard/DocumentCard";
import { UploadError, DeleteError } from "@/components/dashboard/Alerts";

const PAGE_SIZE = 10;

export default function DashboardPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { baseCurrency } = useSettings();
  const [limitError, setLimitError] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // ── Auth ──
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [qbConnected, setQbConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isTokenExpired()) { router.push("/login"); return; }
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [router]);

  // ── Documents ──
  const [documents, setDocuments] = useState<Document[]>([]);
  const [extractions, setExtractions] = useState<Record<string, Extraction>>({});
  const fetchingIdsRef = useRef<Set<string>>(new Set());

  // ── Dashboard Stats ──
  const fetchStats = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStats();
  }, [isAuthenticated, documents, fetchStats]);

  // ── Base currency change (backend reconverts existing documents in the background) ──
  const [reconvertingCurrency, setReconvertingCurrency] = useState(false);

  // ── UI State ──
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [page, setPage] = useState(1);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // ── Polling ──
  const backoffRef = useRef(3000);
  const controllerRef = useRef<AbortController | null>(null);
  // Fetches now and re-arms the timer. Needed after an upload: an idle list polls every 30s, and the
  // already-scheduled tick would otherwise leave a new document on "Processing" for up to 30s.
  const pollNowRef = useRef<() => Promise<void>>(async () => {});

  const fetchDocs = useCallback(async () => {
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();
    try {
      const docs = await getDocuments(controllerRef.current.signal);
      setDocuments(docs);
      const allTerminal = docs.every((d) => d.status === "COMPLETED" || d.status === "FAILED");
      backoffRef.current = allTerminal ? 30000 : 3000;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.message === "limit_exceeded") setLimitError(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    // Each tick clears any pending timer before arming the next, so overlapping ticks
    // (a manual poll during an in-flight one) still leave exactly one loop running.
    const tick = async () => {
      await fetchDocs();
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(tick, backoffRef.current);
    };
    pollNowRef.current = () => { clearTimeout(timer); return tick(); };
    tick();
    return () => { stopped = true; clearTimeout(timer); if (controllerRef.current) controllerRef.current.abort(); };
  }, [isAuthenticated, fetchDocs]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handleCurrencyChanged = () => {
      setReconvertingCurrency(true);
      const timer = setTimeout(() => {
        fetchStats();
        fetchDocs();
        setReconvertingCurrency(false);
      }, 4000);
      return () => clearTimeout(timer);
    };
    window.addEventListener("tallyhawk:currency-changed", handleCurrencyChanged);
    return () => window.removeEventListener("tallyhawk:currency-changed", handleCurrencyChanged);
  }, [isAuthenticated, fetchStats, fetchDocs]);

  // ── Extractions ──
  useEffect(() => {
    if (!isAuthenticated) return;
    const completedIds = documents.filter((d) => d.status === "COMPLETED").map((d) => d.id).filter((id) => !extractions[id] && !fetchingIdsRef.current.has(id));
    if (completedIds.length === 0) return;
    completedIds.forEach((id) => fetchingIdsRef.current.add(id));
    Promise.all(completedIds.map(async (id) => { try { const data = await getExtraction(id); return { id, data }; } catch { return null; } finally { fetchingIdsRef.current.delete(id); } }))
      .then((results) => { const next: Record<string, Extraction> = {}; results.forEach((r) => { if (r) next[r.id] = r.data; }); if (Object.keys(next).length > 0) setExtractions((prev) => ({ ...prev, ...next })); });
  }, [documents, isAuthenticated, extractions]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchQB = async () => { try { const s = await getQuickBooksStatus(); setQbConnected(s.connected); } catch {} };
    fetchQB();
  }, [isAuthenticated]);

  // ── Handlers ──
  const handleUpload = async (file: File) => {
    setLimitError(false); setUploadError("");
    setIsUploading(true); setUploadProgress(0);
    const progressInterval = setInterval(() => setUploadProgress((prev) => (prev < 80 ? prev + 10 : prev)), 200);
    try { await uploadDocument(file); setUploadProgress(100); await pollNowRef.current(); }
    catch (err: unknown) { const msg = err instanceof Error ? err.message : ""; if (msg === "limit_exceeded") setLimitError(true); else setUploadError("Upload failed. Please try again."); } 
    finally { clearInterval(progressInterval); setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 600); }
  };

  const handleCategoryUpdate = (documentId: string, newCategory: string) => {
    setExtractions((prev) => {
      const next = { ...prev };
      if (next[documentId]) {
        next[documentId] = { 
          ...next[documentId], 
          category: newCategory, 
          extracted_data: {
            ...next[documentId].extracted_data,
            category: newCategory 
          } 
        };
      }
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id)); setDeleteError("");
    try { await deleteDocument(id); await fetchDocs(); setExtractions((prev) => { const next = { ...prev }; delete next[id]; return next; }); } 
    catch { setDeleteError("Failed to delete document. Please try again."); } 
    finally { setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; }); }
  };

  const handleValidationError = (message: string) => {
    setUploadError(message);
  };

  // ── Derived ──
  const activeDocs = documents.filter((d) => d.status === "PENDING" || d.status === "PROCESSING");
  const completedDocs = documents.filter((d) => d.status === "COMPLETED");
  const failedDocs = documents.filter((d) => d.status === "FAILED");
  const totalPages = Math.ceil(completedDocs.length / PAGE_SIZE);
  const paginatedDocs = completedDocs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className={`min-h-screen pb-24 ${isDark ? "bg-black" : "bg-gray-50"}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8 md:space-y-10">
        
        {/* Header */}
        <div className="pt-20 md:pt-24 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                Documents
              </h1>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Upload invoices to extract structured data via AI.
              </p>
            </div>
            <Link 
              href="/capture" 
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 ${isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              Mobile Capture
            </Link>
          </div>
          
          <div className="space-y-4">
            <UsageMeter />
            {limitError && (
              <UpgradePrompt
                title="Free Tier Limit Reached"
                message="You've used all 10 of your monthly document uploads. Upgrade to Pro for unlimited processing, QuickBooks sync, and more."
              />
            )}
            {reconvertingCurrency && (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isDark ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-700"}`}>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full shrink-0" />
                <p className="text-sm">We&apos;re updating your existing documents to the new currency…</p>
              </div>
            )}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className={`p-4 rounded-xl border ${isDark ? "border-white/5 bg-white/5" : "border-gray-200 bg-white"}`}>
              <p className={`text-xs mb-1 truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}>Processed</p>
              <p className={`text-lg sm:text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{stats.processed}</p>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? "border-white/5 bg-white/5" : "border-gray-200 bg-white"}`}>
              <p className={`text-xs mb-1 truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}>Synced</p>
              <p className="text-lg sm:text-xl font-semibold text-emerald-400">{stats.synced}</p>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? "border-white/5 bg-white/5" : "border-gray-200 bg-white"}`}>
              <p className={`text-xs mb-1 truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                This Month ({baseCurrency})
              </p>
              <p className={`text-lg sm:text-xl font-semibold wrap-break-word ${isDark ? "text-white" : "text-gray-900"}`}>
                {formatCurrency(stats.month_spend, baseCurrency as CurrencyCode)}
              </p>
              {!!stats.excluded_from_month_spend && (
                <p className={`text-[11px] mt-1 ${isDark ? "text-amber-500" : "text-amber-600"}`}>
                  {stats.excluded_from_month_spend} pending conversion, not included
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <UploadZone 
            isUploading={isUploading} 
            uploadProgress={uploadProgress} 
            dragActive={dragActive} 
            onUpload={handleUpload} 
            setDragActive={setDragActive} 
            onValidationError={handleValidationError} 
          />
          <UploadError message={uploadError} onDismiss={() => setUploadError("")} />
          <DeleteError message={deleteError} onDismiss={() => setDeleteError("")} />
        </div>

        {activeDocs.length > 0 && (
          <div className="space-y-4">
            <h2 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Processing ({activeDocs.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeDocs.map((doc) => (
                <div key={doc.id} className={`p-5 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
                  <div className="flex items-center gap-3">
                    <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full shrink-0" />
                    <span className={`text-sm font-medium truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}>{doc.filename}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {failedDocs.length > 0 && (
          <div className="space-y-4">
            <h2 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Failed ({failedDocs.length})
            </h2>
            <div className={`rounded-2xl border overflow-hidden divide-y ${isDark ? "bg-white/5 border-red-500/20 divide-white/10" : "bg-white border-red-200 divide-gray-100"}`}>
              {failedDocs.map((doc) => (
                <div key={doc.id} className="p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}>{doc.filename}</p>
                      <p className="text-xs text-red-500 mt-0.5">Processing failed</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(doc.id)} 
                    className={`p-2 rounded-lg transition-colors self-end sm:self-center ${isDark ? "hover:bg-white/10 text-gray-500 hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-900"}`} 
                    aria-label="Delete document"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Container */}
        <div className="space-y-4">
          <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <div className={`px-4 sm:px-6 py-4 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}>
              <h2 className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Results ({completedDocs.length})</h2>
            </div>

            {completedDocs.length === 0 ? (
              <div className="p-8 sm:p-16 flex flex-col items-center justify-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
                  <svg className={`w-7 h-7 ${isDark ? "text-gray-400" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="text-center space-y-1">
                  <p className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>No documents yet</p>
                  <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>Upload an invoice or receipt above to get started.</p>
                </div>
              </div>
            ) : (
              <>
                <div className={`divide-y ${isDark ? "divide-white/10" : "divide-gray-100"}`}>
                  {paginatedDocs.map((doc) => (
                    <DocumentCard 
                      key={doc.id} 
                      doc={doc} 
                      ext={extractions[doc.id]} 
                      qbConnected={qbConnected} 
                      isDeleting={deletingIds.has(doc.id)} 
                      onCategoryUpdate={handleCategoryUpdate} 
                      onDelete={handleDelete} 
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${isDark ? "border-white/10" : "border-gray-200"}`}>
                    <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>Page {page} of {totalPages}</p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setPage((p) => Math.max(1, p - 1))} 
                        disabled={page === 1} 
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "bg-white/5 hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
                      >
                        Previous
                      </button>
                      <button 
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                        disabled={page === totalPages} 
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "bg-white/5 hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}