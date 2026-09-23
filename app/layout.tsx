import "./globals.css";
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import JsonLd from "@/components/seo/JsonLd";
import { PlanProvider } from "./providers/PlanContext";
import AnalyticsGate from "@/components/ui/AnalyticsGate";
import { SettingsProvider } from "./providers/SettingsContext";
import { Inter, JetBrains_Mono } from "next/font/google";
import FeedbackButton from "@/components/ui/FeedbackButton";
import { ThemeProvider, themeScript } from "./providers/ThemeContext";
import CookieConsentBanner from "@/components/ui/CookieConsentBanner";
import { CookieConsentProvider } from "./providers/CookieConsentContext";
import { INDEXABLE_ROBOTS } from "@/lib/seo";
import { jsonLdGraph, organizationSchema, websiteSchema } from "@/lib/structured-data";
import { SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

// Site-wide defaults. There is deliberately no `alternates.canonical` here: it would be inherited
// by every route that doesn't set its own and point them all at the home page. Indexable pages set
// their canonical through pageMetadata() in lib/seo.ts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "finance",
  keywords: [
    "AI receipt scanner",
    "invoice processing software",
    "receipt to QuickBooks",
    "QuickBooks Online expense sync",
    "AI bookkeeping for freelancers",
    "expense categorization for taxes",
    "invoice data extraction",
    "multi-currency expense tracking",
  ],
  formatDetection: { telephone: false, address: false, email: false },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    siteName: SITE_NAME,
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: INDEXABLE_ROBOTS,
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <JsonLd data={jsonLdGraph(organizationSchema(), websiteSchema())} />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black focus:shadow-lg"
        >
          Skip to content
        </a>
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
                  <main id="main-content" className="grow">
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
