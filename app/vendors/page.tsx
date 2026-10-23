"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { getVendors, isTokenExpired, mergeVendors, renameVendor, type VendorData } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function VendorsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState("");

  const fetchVendors = useCallback(async () => {
    try {
      setVendors(await getVendors());
    } catch (err) {
      // authFetch has already cleared an expired session; send the user to sign in again.
      if (err instanceof Error && err.message === "Session expired") {
        router.push("/login");
        return;
      }
      setError("Couldn't load your vendors. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Auth guard (localStorage is only readable after mount), then load.
  useEffect(() => {
    setIsMounted(true);
    if (isTokenExpired()) {
      router.push("/login");
      return;
    }
    fetchVendors();
  }, [router, fetchVendors]);

  const handleRename = async (vendorId: string, currentName: string) => {
    const newName = prompt("Enter new vendor name:", currentName);
    if (!newName || newName.trim() === "" || newName.trim() === currentName) return;

    setError("");
    try {
      await renameVendor(vendorId, newName.trim());
      await fetchVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename vendor");
    }
  };

  const handleMerge = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return alert("Cannot merge a vendor into itself.");
    if (!confirm("Merge this vendor? All documents will be re-assigned to the target vendor.")) return;

    setError("");
    try {
      await mergeVendors(sourceId, targetId);
      setMergeSource(null);
      await fetchVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge vendors");
    }
  };

  // Prevent hydration mismatch / flash
  if (!isMounted || loading) {
    return (
      <section className={`min-h-screen flex items-center justify-center ${
        isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"
      }`}>
        <p className="text-sm">Loading vendors...</p>
      </section>
    );
  }

  return (
    <section className={`min-h-screen flex flex-col items-center px-6 pt-24 pb-16 relative overflow-hidden ${
      isDark ? "bg-black" : "bg-gray-50"
    }`}>
      <div className="relative w-full max-w-2xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            Vendor Intelligence
          </h1>
          <p className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Manage and merge your vendors so your analytics are accurate. If two vendors are the same company, select &quot;Merge Into&quot; to combine them.
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-6 text-sm text-red-500 bg-red-500/10 px-4 py-3 rounded-xl">
            {error}
          </p>
        )}

        {vendors.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>No vendors found. They will appear here once you process documents.</p>
        ) : (
          <div className="space-y-4">
            {vendors.map((vendor) => (
              <div 
                key={vendor.id} 
                className={`p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${
                  isDark 
                    ? "bg-slate-900/80 border-white/10 hover:border-white/20" 
                    : "bg-white/80 border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex-1">
                  <button 
                    onClick={() => handleRename(vendor.id, vendor.canonical_name)}
                    className={`text-base font-semibold hover:underline underline-offset-2 decoration-gray-400 cursor-pointer text-left transition-colors ${
                      isDark ? "text-white hover:text-gray-300" : "text-gray-900 hover:text-gray-700"
                    }`}
                    title="Click to rename"
                  >
                    {vendor.canonical_name}
                  </button>
                  <div className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Aliases: {vendor.aliases.length > 0 ? vendor.aliases.join(", ") : "None"}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  {mergeSource === vendor.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        className={`border rounded-lg px-3 py-1.5 text-sm outline-none ${
                          isDark 
                            ? "bg-transparent border-white/10 text-white focus:ring-white/30" 
                            : "bg-transparent border-gray-200 text-gray-900 focus:ring-black/30"
                        }`}
                        onChange={(e) => handleMerge(vendor.id, e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Select target...</option>
                        {vendors.filter(v => v.id !== vendor.id).map(v => (
                          <option key={v.id} value={v.id}>{v.canonical_name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => setMergeSource(null)} 
                        className={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
                          isDark ? "border-white/10 hover:bg-white/10 text-gray-400" : "border-gray-200 hover:bg-gray-50 text-gray-500"
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setMergeSource(vendor.id)}
                      className={`text-xs font-medium px-4 py-2 rounded-lg border transition-colors ${
                        isDark ? "border-white/10 hover:bg-white/10 text-gray-400" : "border-gray-200 hover:bg-gray-50 text-gray-500"
                      }`}
                    >
                      Merge Into...
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}