"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useCookieConsent } from "@/app/providers/CookieConsentContext";

export default function AnalyticsGate() {
  const { consent } = useCookieConsent();
  if (consent !== "accepted") return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
