"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import { usePlan } from "@/app/providers/PlanContext";
import { useSettings } from "@/app/providers/SettingsContext";
import {
  getCategorySpend,
  getVendorSpend,
  getMonthlyTrend,
  isTokenExpired,
  CategorySpend,
  VendorSpend,
  MonthlySpend
} from "@/lib/api";
import { formatCurrency, CurrencyCode } from "@/lib/currency";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from "recharts";

const MONTHS = [
  { value: undefined, label: "All Months" },
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
];

export default function AnalyticsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { plan } = usePlan();

  const currentYear = new Date().getFullYear();
  const AVAILABLE_YEARS = [0, 1, 2, 3, 4, 5].map(i => currentYear - i);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);

  const [categoryData, setCategoryData] = useState<CategorySpend[]>([]);
  const [vendorData, setVendorData] = useState<VendorSpend[]>([]);
  const [trendData, setTrendData] = useState<MonthlySpend[]>([]);
  const [loading, setLoading] = useState(true);

  const { baseCurrency } = useSettings();
  const currencyFormatter = (value: number) => formatCurrency(value, baseCurrency as CurrencyCode);

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
      setLoading(true);
      try {
        const [cats, vendors, trend] = await Promise.all([
          getCategorySpend(selectedYear, selectedMonth),
          getVendorSpend(selectedYear, selectedMonth),
          getMonthlyTrend(selectedYear),
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
  }, [plan, router, selectedYear, selectedMonth]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <div className={`animate-spin h-8 w-8 border-4 rounded-full border-t-transparent ${isDark ? "border-white" : "border-black"}`}></div>
      </div>
    );
  }

  if (plan !== "pro") {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-6 ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <div className={`max-w-md p-8 text-center rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>Upgrade to Pro</h2>
          <p className={`text-sm mb-6 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Spend analytics are exclusive to Pro users. Upgrade to unlock powerful insights.
          </p>
          <button 
            onClick={() => router.push("/pricing")} 
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"}`}
          >
            View Pricing
          </button>
        </div>
      </div>
    );
  }

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
  const tooltipStyle = { 
    backgroundColor: isDark ? "#111" : "#fff", 
    border: `1px solid ${isDark ? "#333" : "#e5e7eb"}`, 
    borderRadius: "8px", 
    color: isDark ? "#fff" : "#111" 
  };

  return (
    <div className={`min-h-screen pb-20 ${isDark ? "bg-black" : "bg-gray-50"}`}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-24 md:pt-28">
        
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
              Analytics
            </h1>
            <p className={`text-sm mt-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Insights generated from your processed documents based on invoice date.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`text-sm px-3 py-2.5 rounded-lg border outline-none cursor-pointer ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"}`}
            >
              {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select 
              value={selectedMonth || ""} 
              onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : undefined)}
              className={`text-sm px-3 py-2.5 rounded-lg border outline-none cursor-pointer ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"}`}
            >
              {MONTHS.map(m => <option key={m.label} value={m.value || ""}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Spend Trend (Full Year) */}
          <div className={`lg:col-span-2 p-6 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <h3 className={`text-sm font-semibold mb-6 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Monthly Spend Trend ({selectedYear}) - {baseCurrency}
            </h3>
            <div className="h-64">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#333" : "#e5e7eb"} />
                    <XAxis dataKey="month" stroke={isDark ? "#666" : "#999"} fontSize={12} />
                    <YAxis
                      stroke={isDark ? "#666" : "#999"}
                      fontSize={12}
                      tickFormatter={currencyFormatter}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any, name?: string | number) => [value !== undefined ? currencyFormatter(Number(value)) : "", String(name || "")]) as any}
                    />
                    <Line type="monotone" dataKey="spend" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={`h-full flex items-center justify-center text-sm ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                  No data available for this period.
                </div>
              )}
            </div>
          </div>

          {/* Top Vendors */}
          <div className={`p-6 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <h3 className={`text-sm font-semibold mb-6 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Top Vendors ({baseCurrency})
            </h3>
            <div className="h-64">
              {vendorData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorData} layout="vertical">
                    <XAxis
                      type="number"
                      stroke={isDark ? "#666" : "#999"}
                      fontSize={12}
                      tickFormatter={currencyFormatter}
                    />
                    <YAxis dataKey="name" type="category" width={100} stroke={isDark ? "#666" : "#999"} fontSize={12} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any, name?: string | number) => [value !== undefined ? currencyFormatter(Number(value)) : "", String(name || "")]) as any}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={`h-full flex items-center justify-center text-sm ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                  No data available.
                </div>
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className={`p-6 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <h3 className={`text-sm font-semibold mb-6 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Spend by Category ({baseCurrency})
            </h3>
            <div className="h-64 flex items-center justify-center">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                      {categoryData.map((entry: CategorySpend, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any, name?: string | number) => [value !== undefined ? currencyFormatter(Number(value)) : "", String(name || "")]) as any}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={`text-sm ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                  No data available.
                </div>
              )}
            </div>
            {categoryData.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-4 justify-center">
                {categoryData.map((entry: CategorySpend, index: number) => (
                  <div key={index} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className={isDark ? "text-gray-400" : "text-gray-600"}>{entry.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}