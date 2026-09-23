"use client";

import { useState, useEffect } from "react"; // <-- ADD useEffect
import { useTheme } from "@/app/providers/ThemeContext";
import { usePlan } from "@/app/providers/PlanContext";
import { syncToQuickBooks, checkQuickBooksSyncStatus } from "@/lib/api"; // <-- ADD checkQuickBooksSyncStatus

interface SyncButtonProps {
  documentId: string;
  qbConnected: boolean;
  initialSyncedStatus: boolean;
}

export default function SyncButton({ documentId, qbConnected, initialSyncedStatus }: SyncButtonProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { plan } = usePlan();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSynced, setIsSynced] = useState(initialSyncedStatus);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false); // New: loading state for check
  const [error, setError] = useState<string | null>(null);

  // NEW: Verify sync status with QuickBooks when the component loads
  useEffect(() => {
    if (plan === "pro" && qbConnected && !initialSyncedStatus) {
      const verifyStatus = async () => {
        setIsCheckingStatus(true);
        try {
          const status = await checkQuickBooksSyncStatus(documentId);
          if (status.synced) setIsSynced(true);
        } catch {}
        finally {
          setIsCheckingStatus(false);
        }
      };
      verifyStatus();
    }
  }, [plan, qbConnected, documentId, initialSyncedStatus]);

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      await syncToQuickBooks(documentId);
      setIsSynced(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Sync failed";
      setError(errorMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  // 1. Free tier locked button
  if (plan !== "pro") {
    return (
      <button
        disabled
        className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-not-allowed ${
          isDark ? "bg-white/5 text-gray-500" : "bg-gray-100 text-gray-400"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Pro
      </button>
    );
  }

  // 2. Pro but not connected
  if (!qbConnected) {
    return (
      <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        Connect QB to sync
      </span>
    );
  }

  // 3. Successfully Synced (The green badge that will now persist correctly!)
  if (isSynced) {
    return (
      <span className="text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Synced
      </span>
    );
  }

  // 4. The active Sync button
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleSync}
        disabled={isSyncing || isCheckingStatus} // Disable while checking status too
        className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
          isDark 
            ? "bg-white/10 text-white hover:bg-white/20 disabled:opacity-50" 
            : "bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-50"
        }`}
      >
        {isSyncing || isCheckingStatus ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
        {isCheckingStatus ? "Checking..." : isSyncing ? "Syncing..." : "Sync to QB"}
      </button>
      
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}