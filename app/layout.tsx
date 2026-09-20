import "./globals.css";
import { Suspense } from "react";
import type { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { PlanProvider } from "./providers/PlanContext";
import AnalyticsGate from "@/components/ui/AnalyticsGate";
import { SettingsProvider } from "./providers/SettingsContext";
import { Inter, JetBrains_Mono } from "next/font/google";
import FeedbackButton from "@/components/ui/FeedbackButton";
import { ThemeProvider, themeScript } from "./providers/ThemeContext";
import CookieConsentBanner from "@/components/ui/CookieConsentBanner";
import { CookieConsentProvider } from "./providers/CookieConsentContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

const SITE_URL = "https://tallyhawk.vercel.app";
const SITE_DESCRIPTION =
  "Tallyhawk turns invoices and receipts into structured, tax-ready data with AI — then syncs it straight to QuickBooks Online. Built for freelancers and small business owners.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tallyhawk | AI Invoice & Receipt Processing for Freelancers",
    template: "%s | Tallyhawk",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "invoice processing software",
    "receipt scanning app",
    "AI expense tracking",
    "QuickBooks sync",
    "tax categorization",
    "freelancer bookkeeping",
    "document extraction",
    "OCR invoices",
    "small business accounting",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Tallyhawk",
    title: "Tallyhawk | AI Invoice & Receipt Processing for Freelancers",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Tallyhawk | AI Invoice & Receipt Processing for Freelancers",
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Tallyhawk",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.svg`,
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Tallyhawk",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: "5", priceCurrency: "USD" },
      ],
    },
  ],
};


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={`${inter.className} ${jetbrainsMono.className} antialiased`}>
        <CookieConsentProvider>
          <ThemeProvider>
            <PlanProvider>
              <SettingsProvider>
                <header>
                  <Suspense fallback={null}>
                    <Navbar />
                  </Suspense>
                </header>
                <div className="min-h-screen flex flex-col">
                  <main className="grow">
                    <Suspense fallback={null}>
                      {children}
                    </Suspense>
                  </main>
                  <Suspense fallback={null}>
                    <FeedbackButton />
                  </Suspense>
                  <Suspense fallback={null}>
                    <Footer />
                  </Suspense>
                </div>
              </SettingsProvider>
            </PlanProvider>
          </ThemeProvider>
          <CookieConsentBanner />
          <AnalyticsGate />
        </CookieConsentProvider>
      </body>
    </html>
  );
}