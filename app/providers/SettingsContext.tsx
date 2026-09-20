"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getSettings, updateSettings, UserSettings } from "@/lib/api";
import { CurrencyCode } from "@/lib/currency";

interface SettingsData {
  baseCurrency: CurrencyCode;
  plan: "free" | "pro";
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
  updateBaseCurrency: (currency: CurrencyCode) => Promise<void>;
}

const SettingsContext = createContext<SettingsData>({
  baseCurrency: "USD",
  plan: "free",
  isLoading: true,
  refreshSettings: async () => {},
  updateBaseCurrency: async () => {},
});

// Helper function to read initial settings from localStorage if available
function getInitialBaseCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "USD";
  const stored = localStorage.getItem("tallyhawk_base_currency");
  if (stored) return stored as CurrencyCode;
  return "USD";
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(getInitialBaseCurrency);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [isLoading, setIsLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const data = await getSettings();
      setBaseCurrency(data.base_currency as CurrencyCode);
      setPlan(data.plan);
      localStorage.setItem("tallyhawk_base_currency", data.base_currency);
    } catch {
      // If API fails, keep the stored value or default
      const stored = localStorage.getItem("tallyhawk_base_currency");
      if (stored) {
        setBaseCurrency(stored as CurrencyCode);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateBaseCurrency = async (currency: CurrencyCode) => {
    setBaseCurrency(currency);
    localStorage.setItem("tallyhawk_base_currency", currency);
    try {
      await updateSettings(currency);
      // Notify other components of currency change
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tallyhawk:currency-changed", {
          detail: { currency }
        }));
      }
    } catch (error) {
      // Revert on error
      const stored = localStorage.getItem("tallyhawk_base_currency");
      const fallback = stored ? (stored as CurrencyCode) : "USD";
      setBaseCurrency(fallback);
      localStorage.setItem("tallyhawk_base_currency", fallback);
      throw error;
    }
  };

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      refreshSettings();
    } else {
      setIsLoading(false);
    }

    const syncAuth = () => {
      const currentToken = localStorage.getItem("token");
      if (currentToken) {
        refreshSettings();
      } else {
        setBaseCurrency("USD");
        setPlan("free");
        setIsLoading(false);
        localStorage.removeItem("tallyhawk_base_currency");
      }
    };
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  return (
    <SettingsContext.Provider value={{ baseCurrency, plan, isLoading, refreshSettings, updateBaseCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

// Hook to listen for currency changes from other tabs/components
export function useCurrencyChange() {
  const { baseCurrency } = useSettings();
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const handleChange = (e: CustomEvent) => {
      forceUpdate({});
    };
    window.addEventListener("tallyhawk:currency-changed", handleChange as EventListener);
    return () => window.removeEventListener("tallyhawk:currency-changed", handleChange as EventListener);
  }, []);

  return baseCurrency;
}