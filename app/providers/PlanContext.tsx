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

// NEW: Helper function to read the JWT instantly before the first render
function getInitialPlan(): string | null {
  if (typeof window === "undefined") return null; 
  const tokenData = decodeToken();
  return tokenData?.plan || null;
}

export function PlanProvider({ children }: { children: ReactNode }) {
  // NEW: Initialize state synchronously from the JWT to prevent flicker
  const [plan, setPlan] = useState<string | null>(getInitialPlan);
  const [documentsProcessed, setDocumentsProcessed] = useState(0);
  const [limit, setLimit] = useState(() => getInitialPlan() === "pro" ? -1 : 10);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [lastRenewalDate, setLastRenewalDate] = useState<string | null>(null);

  const refreshPlan = async () => {
    try {
      const usageData = await getUsage();
      setPlan(usageData.plan);
      setDocumentsProcessed(usageData.documents_processed);
      setLimit(usageData.limit);

      if (usageData.plan === "pro") {
        // Only fetch subscription dates if they are pro
        try {
          const subData = await getSubscription(); // Make sure this is imported from @/lib/api
          setCurrentPeriodEnd(subData.current_period_end);
          setLastRenewalDate(subData.last_renewal_date);
        } catch {}
      } else {
        setCurrentPeriodEnd(null);
        setLastRenewalDate(null);
      }

    } catch {
      // If API fails, fallback to JWT (which is already set, but good to be safe)
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
      refreshPlan(); // Verify with backend API
    } else {
      setIsLoading(false);
    }
    
    const syncAuth = () => {
      const currentToken = localStorage.getItem("token");
      if (currentToken) {
        refreshPlan();
      } else {
        setPlan(null);
        setDocumentsProcessed(0);
        setLimit(10);
        setCurrentPeriodEnd(null);
        setLastRenewalDate(null);
        setIsLoading(false);
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