"use client";

import { useTheme } from "@/app/providers/ThemeContext";

export default function PrivacyPolicy() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section className={`min-h-screen pt-32 pb-24 px-6 ${
      isDark ? "bg-black text-gray-300" : "bg-white text-gray-700"
    }`}>
      <div className="max-w-3xl mx-auto">
        <h1 className={`text-4xl font-bold tracking-tight mb-4 ${
          isDark ? "text-white" : "text-gray-900"
        }`}>
          Privacy Policy
        </h1>
        <p className={`text-sm mb-12 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          Last updated: July 2026
        </p>

        <div className="space-y-8">
          <p>
            This Privacy Policy describes how Tallyhawk ("we," "us," or "our") collects, uses, and protects information
            when you use our web application and API. We are committed to minimizing data
            collection, ensuring data portability, and maximizing transparency in compliance with applicable data
            protection laws, including the EU/UK General Data Protection Regulation (GDPR), the California Consumer
            Privacy Act as amended by the CPRA, and Canada's Personal Information Protection and Electronic Documents
            Act (PIPEDA). Regardless of where you are located, we apply the same data-handling standards described
            below.
          </p>

          {/* Section 1 */}
          <div id="1" className={`rounded-2xl border p-6 ${
            isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
          }`}>
            <h2 className={`text-base font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
              1. Information We Collect
            </h2>
            <div className="space-y-3 text-sm leading-relaxed">
              <p><strong className={isDark ? "text-white" : "text-gray-900"}>Account Data:</strong> We store your email address and a cryptographically hashed version of your password. We do not store passwords in plain text.</p>
              <p><strong className={isDark ? "text-white" : "text-gray-900"}>Billing Data:</strong> When you subscribe to our Pro plan, payment processing is handled entirely by Stripe. We store your subscription status and billing dates, but we never see or store your full credit card number. <strong className={isDark ? "text-white" : "text-gray-900"}>Please note: We currently only support transactions in USD.</strong></p>
              <p><strong className={isDark ? "text-white" : "text-gray-900"}>Document Data:</strong> Documents you upload are temporarily stored in our secure cloud storage for AI processing. We also store the extracted structured data (vendor, amount, category) to provide our service features.</p>
              <p><strong className={isDark ? "text-white" : "text-gray-900"}>Integration Data:</strong> If you connect QuickBooks, we store OAuth tokens securely to facilitate synchronization. We do not access or store your QuickBooks financial data beyond what is necessary to push expense records.</p>
              <p><strong className={isDark ? "text-white" : "text-gray-900"}>System Logs:</strong> Our hosting providers may automatically collect standard server logs such as IP address and browser type to prevent spam and ensure security.</p>
            </div>
          </div>

          {/* Section 2 */}
          <div id="2" className={`rounded-2xl border p-6 ${
            isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
          }`}>
            <h2 className={`text-base font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
              2. How We Use Your Information
            </h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>We use your data strictly to provide and improve the Service based on the following legal bases:</p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li><strong className={isDark ? "text-white" : "text-gray-900"}>Contractual Necessity:</strong> Processing documents, extracting data, and syncing to QuickBooks to deliver the core service you signed up for.</li>
                <li><strong className={isDark ? "text-white" : "text-gray-900"}>Legitimate Interest:</strong> Using email for security alerts, using system logs to prevent fraud and spam, and displaying usage meters to enforce free tier limits.</li>
                <li><strong className={isDark ? "text-white" : "text-gray-900"}>Consent:</strong> Storing JWT tokens in your browser's localStorage to maintain your logged-in session.</li>
              </ul>
              <p className="mt-2">We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
            </div>
          </div>

          {/* Section 3 */}
          <div id="3" className={`rounded-2xl border p-6 ${
            isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
          }`}>
            <h2 className={`text-base font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
              3. Data Storage and Security
            </h2>
            <p className="text-sm leading-relaxed mb-4">
              Your data is stored securely using industry-standard practices:
            </p>
            <div className="space-y-2">
              {[
                { label: "Database", detail: "User metadata is stored in a managed PostgreSQL database with strict row-level isolation." },
                { label: "Files", detail: "Documents are stored in a secure object storage bucket with restricted access controls." },
                { label: "Authentication", detail: "Passwords are hashed using Bcrypt. Sessions are managed via short-lived JWTs." },
                { label: "AI Processing", detail: "Documents are sent to Google Gemini API for processing. Depending on our current API tier, Google may temporarily retain this data for abuse monitoring, but we do not grant them the right to train public models on your documents." },
                { label: "Integrations", detail: "QuickBooks OAuth tokens are encrypted at rest and never exposed to the client." },
              ].map(({ label, detail }) => (
                <div key={label} className={`flex gap-3 text-sm rounded-xl px-4 py-3 ${
                  isDark ? "bg-black/40" : "bg-white border border-gray-200"
                }`}>
                  <strong className={`shrink-0 ${isDark ? "text-white" : "text-gray-900"}`}>{label}:</strong>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sections 4-10 */}
          {[
            {
              id: "4",
              title: "4. Your Data Rights (GDPR, UK GDPR, CCPA/CPRA, PIPEDA & Other Frameworks)",
              content: "Depending on where you live, you may have the following rights regarding your personal data. We honor these rights for all users, not only where legally mandated: \n\n• Right to Access & Portability: You can request a copy of your data in a machine-readable format (e.g., JSON export of your documents). \n• Right to Rectification: You can correct inaccurate personal data. \n• Right to Erasure: You can delete your account and all associated documents directly from your Account Settings. Upon deletion, your data is purged from our primary databases and storage buckets within 48 hours. Residual backups containing your data may persist for up to 30 days before automatic expiration. \n• Right to Object / Restrict Processing: You can request that we stop processing your data while retaining your account. \n• Right to Non-Discrimination (CCPA/CPRA): Exercising your privacy rights will not result in discriminatory treatment. \n• Do Not Sell or Share (CCPA/CPRA): We do not sell or share your personal information with third parties for cross-context behavioral advertising, so there is nothing to opt out of. \n• Sensitive Personal Information (CPRA): Documents you upload may contain sensitive financial information. We use it solely to provide the Service (extraction, categorization, sync) and do not use it to infer characteristics about you. \n\nTo exercise any of these rights, use Account Settings where available, or contact us as described in Section 11. We may need to verify your identity before fulfilling a request.",
            },
            {
              id: "5",
              title: "5. Data Retention",
              content: "We retain your documents and extracted data for as long as your account is active or until you manually delete them. If you cancel your subscription, your data remains intact but processing is paused until you downgrade or delete it. If you delete your account, data is purged from primary systems within 48 hours and from backups within 30 days.",
            },
            {
              id: "6",
              title: "6. Third-Party Services",
              content: "The Service relies on the following third-party infrastructure providers, who process data strictly under Data Processing Agreements (DPAs): Stripe (Payment Processing), Google Cloud (Gemini API & AI inference), Intuit (QuickBooks API), AWS/GCS (File storage), and Vercel/Railway (Application hosting).",
            },
            {
              id: "7",
              title: "7. Cookies and Local Storage",
              content: "We use your browser's localStorage for two purposes: storing your JWT access token so you remain logged in, and remembering your preferences (theme, base currency, analytics consent choice). We do not use traditional tracking cookies. Clearing your browser data will log you out but will not delete your account or documents from our servers. \n\nWith your consent (via the banner shown on your first visit, or reopened anytime from the \"Cookie Preferences\" link in the footer), we load Vercel Analytics and Vercel Speed Insights, which are cookieless, aggregate analytics tools that do not identify you personally. If you decline or don't respond, these tools are not loaded at all.",
            },
            {
              id: "8",
              title: "8. International Data Transfers",
              content: "If you are accessing the Service from outside the United States, please be aware that your data may be transferred to, stored, and processed in the US. By using the Service, you consent to this transfer pursuant to applicable Standard Contractual Clauses (SCCs).",
            },
            {
              id: "9",
              title: "9. Children's Privacy",
              content: "The Service is not intended for anyone under the age of 18. We do not knowingly collect personal information from children. If we discover that a child under 18 has provided us with personal data, we will delete such information immediately.",
            },
            {
              id: "10",
              title: "10. Changes to This Policy",
              content: "We reserve the right to modify this Privacy Policy at any time. Your continued use of the Service after changes constitutes acceptance of the modified Privacy Policy.",
            },
            {
              id: "11",
              title: "11. Contact",
              content: "For privacy, data deletion, data portability requests, or DPA inquiries, please send us an issue through the chat widget.",
            },
          ].map(({ id, title, content }) => (
            <div key={id} id={id} className={`rounded-2xl border p-6 ${
              isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
            }`}>
              <h2 className={`text-base font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
                {title}
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}