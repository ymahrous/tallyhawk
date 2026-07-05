"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  uploadDocument,
  getDocuments,
  getExtraction,
  deleteDocument,
  Document,
  Extraction,
  isTokenExpired,
  getQuickBooksStatus,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import UsageMeter from "@/components/ui/UsageMeter";
import UpgradePrompt from "@/components/ui/UpgradePrompt";
import SyncButton from "@/components/ui/SyncButton";
import CategoryPage from "@/components/ui/CategoryPage";
import WarningBadge from "@/components/ui/WarningBadge";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const PAGE_SIZE = 10;

// ─── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ isDark }: { isDark: boolean }) {
  return (
    <div className="p-16 flex flex-col items-center justify-center gap-4">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
        isDark ? "bg-white/5" : "bg-gray-100"
      }`}>
        <svg className={`w-7 h-7 ${isDark ? "text-gray-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <div className="text-center">
        <p className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          No documents yet
        </p>
        <p className={`text-xs mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
          Upload an invoice or receipt above to get started.
        </p>
      </div>
    </div>
  );
}

// ─── Failed Doc Row ────────────────────────────────────────────────────────────
function FailedRow({
  doc,
  isDark,
  onDelete,
}: {
  doc: Document;
  isDark: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`p-6 flex items-center justify-between border-b last:border-0 ${
      isDark ? "border-white/10" : "border-gray-100"
    }`}>
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p className={`text-sm font-medium truncate max-w-xs ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            {doc.filename}
          </p>
          <p className="text-xs text-red-500 mt-0.5">Processing failed</p>
        </div>
      </div>
      <button
        onClick={() => onDelete(doc.id)}
        className={`p-2 rounded-lg transition-colors ${
          isDark ? "hover:bg-white/10 text-gray-500 hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-900"
        }`}
        aria-label="Delete document"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [limitError, setLimitError] = useState(false);

  // ── Auth ──
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [qbConnected, setQbConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isTokenExpired()) {
      router.push("/login");
      return;
    }
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [router]);

  // ── Documents ──
  const [documents, setDocuments] = useState<Document[]>([]);
  const [extractions, setExtractions] = useState<Record<string, Extraction>>({});
  const fetchingIdsRef = useRef<Set<string>>(new Set());

  // ── Upload ──
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // ── Pagination ──
  const [page, setPage] = useState(1);

  // ── Delete ──
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // ── Polling with exponential backoff ──
  const backoffRef = useRef(3000);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchDocs = useCallback(async () => {
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    try {
      const docs = await getDocuments(controllerRef.current.signal);
      setDocuments(docs);

      const allTerminal = docs.every(
        (d) => d.status === "COMPLETED" || d.status === "FAILED"
      );
      backoffRef.current = allTerminal ? 30000 : 3000;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      if (errorMessage === "limit_exceeded") {
        setLimitError(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const schedule = () => {
      fetchDocs().then(() => {
        intervalRef.current = setTimeout(schedule, backoffRef.current);
      });
    };

    schedule();

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, [isAuthenticated, fetchDocs]);

  // ── Fetch extractions (race-condition safe) ──
  useEffect(() => {
    if (!isAuthenticated) return;

    const completedIds = documents
      .filter((d) => d.status === "COMPLETED")
      .map((d) => d.id)
      .filter((id) => !extractions[id] && !fetchingIdsRef.current.has(id));

    if (completedIds.length === 0) return;

    completedIds.forEach((id) => fetchingIdsRef.current.add(id));

    Promise.all(
      completedIds.map(async (id) => {
        try {
          const data = await getExtraction(id);
          return { id, data };
        } catch {
          return null;
        } finally {
          fetchingIdsRef.current.delete(id);
        }
      })
    ).then((results) => {
      const next: Record<string, Extraction> = {};
      results.forEach((r) => { if (r) next[r.id] = r.data; });
      if (Object.keys(next).length > 0) {
        setExtractions((prev) => ({ ...prev, ...next }));
      }
    });
  }, [documents, isAuthenticated, extractions]);

  // Fetch QB Status
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchDashboardData = async () => {
      try {
        const qbStatus = await getQuickBooksStatus();
        setQbConnected(qbStatus.connected);
      } catch (err) {
        console.error("Failed to load QB status");
      }
    };
    fetchDashboardData();
  }, [isAuthenticated]);

  // ── File validation ──
  const validateFile = (file: File): string => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Unsupported file type. Please upload ${ACCEPTED_EXTENSIONS.join(", ")}.`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
    }
    return "";
  };

  // ── Upload ──
  const handleUpload = async (file: File) => {
    setLimitError(false);
    setUploadError("");
    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev < 80 ? prev + 10 : prev));
    }, 200);

    try {
      await uploadDocument(file);
      setUploadProgress(100);
      await fetchDocs();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      if (errorMessage === "limit_exceeded") {
        setLimitError(true);
      } else {
        setUploadError("Upload failed. Please try again.");
      }
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 600);
    }
  };

  // ── Category Update (Optimistic UI) ──
  const handleCategoryUpdate = (documentId: string, newCategory: string) => {
    setExtractions((prev) => {
      const next = { ...prev };
      if (next[documentId]) {
        next[documentId] = {
          ...next[documentId],
          category: newCategory, // Update the top-level category
          extracted_data: {
            ...next[documentId].extracted_data,
            category: newCategory // Also update it inside the JSON payload
          }
        };
      }
      return next;
    });
  };

  // ── Drag and drop ──
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    setDeleteError("");
    try {
      await deleteDocument(id);
      await fetchDocs();
      setExtractions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      setDeleteError("Failed to delete document. Please try again.");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ── Derived lists ──
  const activeDocs = documents.filter(
    (d) => d.status === "PENDING" || d.status === "PROCESSING"
  );
  const completedDocs = documents.filter((d) => d.status === "COMPLETED");
  const failedDocs = documents.filter((d) => d.status === "FAILED");

  // ── Pagination ──
  const totalPages = Math.ceil(completedDocs.length / PAGE_SIZE);
  const paginatedDocs = completedDocs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className={`min-h-screen pb-20 ${isDark ? "bg-black" : "bg-gray-50"}`}>
      <div className="max-w-5xl mx-auto px-6 pt-24">
        
        {/* Header */}
        <div className="mb-12">
          <h1 className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            Documents
          </h1>
          <p className={`text-sm mt-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Upload invoices to extract structured data via AI.
          </p>
          <div className="mt-4">
            <UsageMeter />
            {limitError && (
              <div className="mt-4">
                <UpgradePrompt 
                  title="Free Tier Limit Reached"
                  message="You've used all 10 of your monthly document uploads. Upgrade to Pro for unlimited processing, QuickBooks sync, and more."
                />
              </div>
            )}
          </div>
        </div>

        {/* Upload Zone */}
        <div
          className={`border-2 border-dashed rounded-2xl p-12 mb-4 flex flex-col items-center justify-center transition-all duration-300 backdrop-blur-sm ${
            dragActive
              ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
              : isDark
              ? "border-white/10 bg-white/5 hover:bg-white/10"
              : "border-gray-300 bg-white hover:border-gray-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
              <svg className={`w-8 h-8 ${isDark ? "text-gray-400" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className={`font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Drop files here or <span className="text-indigo-500">browse</span>
              </p>
              <p className={`text-sm ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                PDF, JPG, PNG up to {MAX_FILE_SIZE_MB}MB
              </p>
            </div>
          </label>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            onChange={(e) => e.target.files && handleUpload(e.target.files[0])}
          />

          {/* Upload Progress */}
          {isUploading && (
            <div className="w-full mt-8 max-w-sm">
              <div className={`h-1 w-full rounded-full overflow-hidden ${
                isDark ? "bg-white/10" : "bg-gray-200"
              }`}>
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className={`text-xs mt-2 text-center ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}
        </div>

        {/* Upload Error */}
        {uploadError && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-500">{uploadError}</p>
            <button onClick={() => setUploadError("")} className="ml-auto text-red-400 hover:text-red-300" aria-label="Dismiss error">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Delete Error */}
        {deleteError && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-500">{deleteError}</p>
            <button onClick={() => setDeleteError("")} className="ml-auto text-red-400 hover:text-red-300" aria-label="Dismiss error">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Active Queue */}
        {activeDocs.length > 0 && (
          <div className="mb-10">
            <h2 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${
              isDark ? "text-gray-500" : "text-gray-400"
            }`}>
              Processing ({activeDocs.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={`p-5 rounded-2xl border backdrop-blur-sm ${
                    isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full shrink-0" />
                    <span className={`text-sm font-medium truncate ${
                      isDark ? "text-gray-300" : "text-gray-700"
                    }`}>
                      {doc.filename}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed Documents */}
        {failedDocs.length > 0 && (
          <div className="mb-10">
            <h2 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${
              isDark ? "text-gray-500" : "text-gray-400"
            }`}>
              Failed ({failedDocs.length})
            </h2>
            <div className={`rounded-2xl border overflow-hidden ${
              isDark ? "bg-white/5 border-red-500/20" : "bg-white border-red-200"
            }`}>
              {failedDocs.map((doc) => (
                <FailedRow
                  key={doc.id}
                  doc={doc}
                  isDark={isDark}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}

        {/* Results Table */}
        <div className={`rounded-2xl border overflow-hidden backdrop-blur-sm ${
          isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        }`}>
          <div className={`px-8 py-5 border-b flex items-center justify-between ${
            isDark ? "border-white/10" : "border-gray-200"
          }`}>
            <h2 className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Results ({completedDocs.length})
            </h2>
          </div>

          {completedDocs.length === 0 ? (
            <EmptyState isDark={isDark} />
          ) : (
            <>
              <div className={`divide-y ${isDark ? "divide-white/10" : "divide-gray-100"}`}>
                {paginatedDocs.map((doc) => {
                  const ext = extractions[doc.id];
                  return (
                    <div
                      key={doc.id}
                      className={`p-6 md:p-8 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
                    >
                      <div className="flex flex-col gap-6">

                        {/* Top Row: Filename, Category, Actions */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate ${isDark ? "text-gray-200" : "text-gray-900"}`}>
                              {doc.filename}
                            </p>

                            {/* NEW WARNING BADGE */}
                            <WarningBadge flags={doc.flags} />
                            
                            <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                              {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {ext && <CategoryPage documentId={doc.id} currentCategory={ext.category} onCategoryUpdate={handleCategoryUpdate} />}
                            <SyncButton documentId={doc.id} qbConnected={qbConnected} initialSyncedStatus={doc.quickbooks_synced} />
                            
                            <button
                              onClick={() => handleDelete(doc.id)}
                              disabled={deletingIds.has(doc.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isDark ? "hover:bg-white/10 text-gray-600 hover:text-red-400" : "hover:bg-gray-100 text-gray-400 hover:text-red-500"
                              }`}
                              aria-label="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Bottom Row: Extracted JSON */}
                        {ext && (
                          <div className="bg-black/80 rounded-xl p-5 border border-white/5">
                            <pre className="text-emerald-400 font-mono text-xs leading-loose overflow-x-auto">
                              {JSON.stringify(ext.extracted_data, null, 2)}
                            </pre>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={`px-8 py-4 border-t flex items-center justify-between ${
                  isDark ? "border-white/10" : "border-gray-200"
                }`}>
                  <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isDark ? "bg-white/5 hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isDark ? "bg-white/5 hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
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
  );
}