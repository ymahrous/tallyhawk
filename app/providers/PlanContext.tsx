"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getUsage, decodeToken, getSubscription } from "@/lib/api";

interface PlanData {
  plan: string | null;
  documentsProcessed: number;
  limit: number;
  isLoading: boolean;
  refreshPlan: () => Promise<void>;
  currentPeriodEnd: string | null;
  lastRenewalDate: string | null;
}

const PlanContext = createContext<PlanData>({
  plan: null,
  documentsProcessed: 0,
  limit: 10,
  isLoading: true,
  refreshPlan: async () => {},
  currentPeriodEnd: null,
  lastRenewalDate: null,
});

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<string | null>(null);
  const [documentsProcessed, setDocumentsProcessed] = useState(0);
  const [limit, setLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [lastRenewalDate, setLastRenewalDate] = useState<string | null>(null);

  const refreshPlan = async () => {
    try {
      const usageData = await getUsage();
      setPlan(usageData.plan);
      setDocumentsProcessed(usageData.documents_processed);
      setLimit(usageData.limit);

      // FETCH SUBSCRIPTION DATA
      if (usageData.plan === "pro") {
        const subData = await getSubscription();
        setCurrentPeriodEnd(subData.current_period_end);
        setLastRenewalDate(subData.last_renewal_date);
      } else {
        setCurrentPeriodEnd(null);
        setLastRenewalDate(null);
      }
    } catch {
      // Fallback to JWT if API fails or user is not logged in
      const tokenData = decodeToken();
      if (tokenData?.plan) {
        setPlan(tokenData.plan);
        if (tokenData.plan === "pro") setLimit(-1);
      } else {
        setPlan(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      refreshPlan();
    } else {
      setIsLoading(false);
    }
    
    // Re-fetch plan if auth state changes (e.g., login/logout)
    const syncAuth = () => {
      const currentToken = localStorage.getItem("token");
      if (currentToken) {
        refreshPlan();
      } else {
        setPlan(null);
        setDocumentsProcessed(0);
        setLimit(10);
      }
    };
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  return (
    <PlanContext.Provider value={{ plan, documentsProcessed, limit, isLoading, refreshPlan, currentPeriodEnd, lastRenewalDate }}>
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);