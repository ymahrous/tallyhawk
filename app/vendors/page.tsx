"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";

type Vendor = {
  id: string;
  canonical_name: string;
  aliases: string[];
};

export default function VendorsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  const [token, setToken] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergeSource, setMergeSource] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  // Sync auth state exactly like Navbar
  useEffect(() => {
    const syncAuth = () => {
      const userToken = localStorage.getItem("token");
      setToken(userToken);
      if (!userToken) {
        router.push("/login");
      }
    };
    syncAuth();
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, [router]);

  const fetchVendors = async (userToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/vendors/`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setVendors(data);
    } catch (err) {
      console.error("Failed to fetch vendors", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchVendors(token);
  }, [token]);

  const handleRename = async (vendorId: string, currentName: string) => {
    const newName = prompt("Enter new vendor name:", currentName);
    if (!newName || newName === currentName) return;

    const res = await fetch(`${API_BASE}/api/v1/vendors/${vendorId}/rename`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ new_name: newName }),
    });

    if (res.ok && token) fetchVendors(token);
  };

  const handleMerge = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return alert("Cannot merge a vendor into itself.");
    if (!confirm("Merge this vendor? All documents will be re-assigned to the target vendor.")) return;

    const res = await fetch(`${API_BASE}/api/v1/vendors/${sourceId}/merge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ target_vendor_id: targetId }),
    });

    if (res.ok && token) {
      setMergeSource(null);
      fetchVendors(token);
    }
  };

  // Matching Navbar's primaryBtnClass
  const primaryBtnClass = `text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
    isDark
      ? "bg-white text-black hover:bg-gray-200"
      : "bg-black text-white hover:bg-gray-800"
  }`;

  if (loading) return <div className={`p-8 ${isDark ? "text-white" : "text-black"}`}>Loading vendors...</div>;

  return (
    <div className={`min-h-screen pt-24 pb-12 px-6 ${isDark ? "bg-black text-white" : "bg-white text-gray-900"}`}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 tracking-tight">Vendor Intelligence</h1>
        <p className={`mb-8 text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          Manage and merge your vendors so your analytics are accurate. If two vendors are the same company, select "Merge Into" to combine them.
        </p>

        {vendors.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>No vendors found. They will appear here once you process documents.</p>
        ) : (
          <div className="space-y-4">
            {vendors.map((vendor) => (
              <div 
                key={vendor.id} 
                className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${
                  isDark 
                    ? "bg-black/80 border-white/10 hover:border-white/20" 
                    : "bg-white border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex-1">
                  <button 
                    onClick={() => handleRename(vendor.id, vendor.canonical_name)}
                    className={`text-lg font-semibold hover:underline underline-offset-2 decoration-gray-400 cursor-pointer text-left ${
                      isDark ? "hover:text-blue-400" : "hover:text-blue-600"
                    }`}
                    title="Click to rename"
                  >
                    {vendor.canonical_name}
                  </button>
                  <div className={`text-sm mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    Aliases: {vendor.aliases.length > 0 ? vendor.aliases.join(", ") : "None"}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  {mergeSource === vendor.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        className={`border rounded-lg px-3 py-1.5 text-sm ${
                          isDark 
                            ? "bg-black border-white/10 text-white focus:ring-white/30" 
                            : "bg-white border-gray-200 text-gray-900 focus:ring-gray-300"
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
                        className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                          isDark ? "border-white/10 hover:bg-white/10 text-gray-400" : "border-gray-200 hover:bg-gray-50 text-gray-500"
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setMergeSource(vendor.id)}
                      className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
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
    </div>
  );
}