"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getUsage, decodeToken, getRole, getSubscription } from "@/lib/api";
import { PRODUCT_FACTS } from "@/lib/site";

const FREE_LIMIT = PRODUCT_FACTS.freeDocumentsPerMonth;

interface PlanData {
  plan: string | null;
  documentsProcessed: number;
  limit: number;
  isLoading: boolean;
  refreshPlan: () => Promise<void>;
  currentPeriodEnd: string | null;
  lastRenewalDate: string | null;
  /** Stripe's subscription status ("active", "past_due", …), or null without one. */
  subscriptionStatus: string | null;
  /** The subscription ends at currentPeriodEnd instead of renewing. */
  cancelAtPeriodEnd: boolean;
  /** A Stripe customer exists, so the billing portal can be opened. */
  canManageBilling: boolean;
}

const PlanContext = createContext<PlanData>({
  plan: null,
  documentsProcessed: 0,
  limit: FREE_LIMIT,
  isLoading: true,
  refreshPlan: async () => {},
  currentPeriodEnd: null,
  lastRenewalDate: null,
  subscriptionStatus: null,
  cancelAtPeriodEnd: false,
  canManageBilling: false,
});

// Reads the JWT synchronously so the first render doesn't flicker. Admin sessions have no plan:
// admins aren't customers.
function getInitialPlan(): string | null {
  if (typeof window === "undefined") return null;
  const tokenData = decodeToken();
  return tokenData?.role === "admin" ? null : tokenData?.plan || null;
}

export function PlanProvider({ children }: { children: ReactNode }) {
  // NEW: Initialize state synchronously from the JWT to prevent flicker
  const [plan, setPlan] = useState<string | null>(getInitialPlan);
  const [documentsProcessed, setDocumentsProcessed] = useState(0);
  const [limit, setLimit] = useState(() => getInitialPlan() === "pro" ? -1 : FREE_LIMIT);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [lastRenewalDate, setLastRenewalDate] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [canManageBilling, setCanManageBilling] = useState(false);

  const clearSubscription = () => {
    setCurrentPeriodEnd(null);
    setLastRenewalDate(null);
    setSubscriptionStatus(null);
    setCancelAtPeriodEnd(false);
    setCanManageBilling(false);
  };

  const refreshPlan = async () => {
    // Billing endpoints are customer-only; an admin session has nothing to load.
    if (getRole() === "admin") {
      setPlan(null);
      clearSubscription();
      setIsLoading(false);
      return;
    }
    try {
      const usageData = await getUsage();
      setPlan(usageData.plan);
      setDocumentsProcessed(usageData.documents_processed);
      setLimit(usageData.limit);

      if (usageData.plan === "pro") {
        // Only fetch subscription dates if they are pro
        try {
          const subData = await getSubscription();
          setCurrentPeriodEnd(subData.current_period_end);
          setLastRenewalDate(subData.last_renewal_date);
          setSubscriptionStatus(subData.status === "inactive" ? null : subData.status);
          setCancelAtPeriodEnd(Boolean(subData.cancel_at_period_end));
          setCanManageBilling(Boolean(subData.can_manage));
        } catch {}
      } else {
        clearSubscription();
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
        setLimit(FREE_LIMIT);
        clearSubscription();
        setIsLoading(false);
      }
    };
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  return (
    <PlanContext.Provider
      value={{
        plan,
        documentsProcessed,
        limit,
        isLoading,
        refreshPlan,
        currentPeriodEnd,
        lastRenewalDate,
        subscriptionStatus,
        cancelAtPeriodEnd,
        canManageBilling,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);