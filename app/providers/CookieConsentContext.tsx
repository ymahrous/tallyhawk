"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ConsentStatus = "accepted" | "rejected" | null;

interface CookieConsentData {
  consent: ConsentStatus;
  showBanner: boolean;
  accept: () => void;
  reject: () => void;
  reopen: () => void;
  dismiss: () => void;
}

const STORAGE_KEY = "tallyhawk_analytics_consent";

const CookieConsentContext = createContext<CookieConsentData>({
  consent: null,
  showBanner: false,
  accept: () => {},
  reject: () => {},
  reopen: () => {},
  dismiss: () => {},
});

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentStatus>(null);
  const [isReady, setIsReady] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "accepted" || stored === "rejected") setConsent(stored);
    } catch {
      // localStorage unavailable (private browsing, etc.) — banner will show every visit
    }
    setIsReady(true);
  }, []);

  const persist = (value: "accepted" | "rejected") => {
    setConsent(value);
    setManualOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {}
  };

  const accept = () => persist("accepted");
  const reject = () => persist("rejected");
  const reopen = () => setManualOpen(true);
  const dismiss = () => setManualOpen(false);

  const showBanner = isReady && (consent === null || manualOpen);

  return (
    <CookieConsentContext.Provider value={{ consent, showBanner, accept, reject, reopen, dismiss }}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export const useCookieConsent = () => useContext(CookieConsentContext);
