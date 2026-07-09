import "./globals.css";
import { Suspense } from "react";
import type { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { Analytics } from "@vercel/analytics/next";
import { PlanProvider } from "./providers/PlanContext";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next"
import FeedbackButton from "@/components/ui/FeedbackButton";
import { ThemeProvider, themeScript } from "./providers/ThemeContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: {
    default: "edocAI | Automated Document Processing",
    template: "%s | edocAI",
  },
  description: "AI-powered financial document automation.",
  keywords: ["AI", "Machine Learning", "Document Extraction", "OCR", "FastAPI", "Next.js"],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://edocai.vercel.app",
    siteName: "edocAI",
    title: "edocAI | Automated Document Processing",
    description: "AI-powered financial document automation.",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
};


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} ${jetbrainsMono.className} antialiased`}>
        <ThemeProvider>
          <PlanProvider>
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
          </PlanProvider>
        </ThemeProvider>
      </body>
      <Analytics />
      <SpeedInsights />
    </html>
  );
}