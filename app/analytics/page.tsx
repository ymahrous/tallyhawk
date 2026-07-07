"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlan } from "@/app/providers/PlanContext";
import { useTheme } from "@/app/providers/ThemeContext";
import { CategorySpend, VendorSpend, MonthlySpend } from "@/lib/api";
import { getCategorySpend, getVendorSpend, getMonthlyTrend, isTokenExpired } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";

export default function AnalyticsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { plan } = usePlan();

  const [categoryData, setCategoryData] = useState<CategorySpend[]>([]);
  const [vendorData, setVendorData] = useState<VendorSpend[]>([]);
  const [trendData, setTrendData] = useState<MonthlySpend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isTokenExpired() || !localStorage.getItem("token")) {
      router.push("/login");
      return;
    }
    
    if (plan !== "pro") {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [cats, vendors, trend] = await Promise.all([
          getCategorySpend(),
          getVendorSpend(),
          getMonthlyTrend(),
        ]);
        setCategoryData(cats);
        setVendorData(vendors);
        setTrendData(trend);
      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [plan, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (plan !== "pro") {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-6 ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <div className={`max-w-md p-8 text-center rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>Upgrade to Pro</h2>
          <p className={`text-sm mb-6 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Spend analytics are exclusive to Pro users. Upgrade to unlock powerful insights.
          </p>
          <button onClick={() => router.push("/pricing")} className={`px-6 py-2.5 rounded-lg text-sm font-medium ${isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"}`}>
            View Pricing
          </button>
        </div>
      </div>
    );
  }

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
  const tooltipStyle = { backgroundColor: isDark ? "#111" : "#fff", border: `1px solid ${isDark ? "#333" : "#e5e7eb"}`, borderRadius: "8px", color: isDark ? "#fff" : "#111" };

  return (
    <div className={`min-h-screen pb-20 ${isDark ? "bg-black" : "bg-gray-50"}`}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-24 md:pt-28">
        <div className="mb-10">
          <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>Analytics</h1>
          <p className={`text-sm mt-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Insights generated from your processed documents.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Spend Trend */}
          <div className={`lg:col-span-2 p-6 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <h3 className={`text-sm font-semibold mb-6 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Monthly Spend Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#333" : "#e5e7eb"} />
                  <XAxis dataKey="month" stroke={isDark ? "#666" : "#999"} fontSize={12} />
                  <YAxis stroke={isDark ? "#666" : "#999"} fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="spend" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Vendors */}
          <div className={`p-6 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <h3 className={`text-sm font-semibold mb-6 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Top Vendors</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorData} layout="vertical">
                  <XAxis type="number" stroke={isDark ? "#666" : "#999"} fontSize={12} />
                  <YAxis dataKey="name" type="category" width={100} stroke={isDark ? "#666" : "#999"} fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className={`p-6 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <h3 className={`text-sm font-semibold mb-6 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Spend by Category</h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {categoryData.map((entry: CategorySpend, index: number) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className={isDark ? "text-gray-400" : "text-gray-600"}>{entry.name}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}