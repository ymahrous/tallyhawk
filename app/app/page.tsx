"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  uploadDocument, getDocuments, getExtraction, deleteDocument,
  Document, Extraction, isTokenExpired, getQuickBooksStatus,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import UsageMeter from "@/components/ui/UsageMeter";
import UpgradePrompt from "@/components/ui/UpgradePrompt";
import UploadZone from "@/components/dashboard/UploadZone";
import { UploadError, DeleteError } from "@/components/dashboard/Alerts";
import DocumentCard from "@/components/dashboard/DocumentCard";

const PAGE_SIZE = 10;

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
    if (isTokenExpired()) { router.push("/login"); return; }
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [router]);

  // ── Documents ──
  const [documents, setDocuments] = useState<Document[]>([]);
  const [extractions, setExtractions] = useState<Record<string, Extraction>>({});
  const fetchingIdsRef = useRef<Set<string>>(new Set());

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
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

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
    const schedule = () => { fetchDocs().then(() => { intervalRef.current = setTimeout(schedule, backoffRef.current); }); };
    schedule();
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); if (controllerRef.current) controllerRef.current.abort(); };
  }, [isAuthenticated, fetchDocs]);

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
    try { await uploadDocument(file); setUploadProgress(100); await fetchDocs(); } 
    catch (err: unknown) { const msg = err instanceof Error ? err.message : ""; if (msg === "limit_exceeded") setLimitError(true); else setUploadError("Upload failed. Please try again."); } 
    finally { clearInterval(progressInterval); setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 600); }
  };

  const handleCategoryUpdate = (documentId: string, newCategory: string) => {
    setExtractions((prev) => {
      const next = { ...prev };
      if (next[documentId]) { next[documentId] = { ...next[documentId], category: newCategory, extracted_data: { ...next[documentId].extracted_data, category: newCategory } }; }
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

  if (isLoading) return (<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>);

  return (
    <div className={`min-h-screen pb-20 ${isDark ? "bg-black" : "bg-gray-50"}`}>
      <div className="max-w-5xl mx-auto px-6 pt-24">
        
        {/* Header */}
        <div className="mb-12">
          <h1 className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>Documents</h1>
          <p className={`text-sm mt-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Upload invoices to extract structured data via AI.</p>
          <div className="mt-4">
            <UsageMeter />
            {limitError && (<div className="mt-4"><UpgradePrompt title="Free Tier Limit Reached" message="You've used all 10 of your monthly document uploads. Upgrade to Pro for unlimited processing, QuickBooks sync, and more." /></div>)}
          </div>
        </div>

        <UploadZone isUploading={isUploading} uploadProgress={uploadProgress} dragActive={dragActive} onUpload={handleUpload} setDragActive={setDragActive} onValidationError={handleValidationError} />
        <UploadError message={uploadError} onDismiss={() => setUploadError("")} />
        <DeleteError message={deleteError} onDismiss={() => setDeleteError("")} />

        {activeDocs.length > 0 && (
          <div className="mb-10">
            <h2 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Processing ({activeDocs.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeDocs.map((doc) => (<div key={doc.id} className={`p-5 rounded-2xl border backdrop-blur-sm ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}><div className="flex items-center gap-3"><div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full shrink-0" /><span className={`text-sm font-medium truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}>{doc.filename}</span></div></div>))}
            </div>
          </div>
        )}

        {failedDocs.length > 0 && ( <div className="mb-10"><h2 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Failed ({failedDocs.length})</h2><div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-white/5 border-red-500/20" : "bg-white border-red-200"}`}>{failedDocs.map((doc) => (<div key={doc.id} className={`p-6 flex items-center justify-between border-b last:border-0 ${isDark ? "border-white/10" : "border-gray-100"}`}><div className="flex items-center gap-4"><div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center"><svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div><div><p className={`text-sm font-medium truncate max-w-xs ${isDark ? "text-gray-300" : "text-gray-700"}`}>{doc.filename}</p><p className="text-xs text-red-500 mt-0.5">Processing failed</p></div></div><button onClick={() => handleDelete(doc.id)} className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-gray-500 hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-900"}`} aria-label="Delete document"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button></div>))}</div></div>)}

        {/* Results Table */}
        <div className={`rounded-2xl border overflow-hidden backdrop-blur-sm ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
          <div className={`px-8 py-5 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}>
            <h2 className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Results ({completedDocs.length})</h2>
          </div>

          {completedDocs.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center gap-4"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-white/5" : "bg-gray-100"}`}><svg className={`w-7 h-7 ${isDark ? "text-gray-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg></div><div className="text-center"><p className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>No documents yet</p><p className={`text-xs mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>Upload an invoice or receipt above to get started.</p></div></div>
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
                <div className={`px-8 py-4 border-t flex items-center justify-between ${isDark ? "border-white/10" : "border-gray-200"}`}>
                  <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>Page {page} of {totalPages}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "bg-white/5 hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>Previous</button>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "bg-white/5 hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>Next</button>
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