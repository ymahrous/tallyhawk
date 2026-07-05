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
        <p className={`text-sm mb-12 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          Last updated: July 2026
        </p>

        <div className="space-y-8">
          <p>
            This Privacy Policy describes how edocAI ("we," "us," or "our") collects, uses, and protects information
            when you use our web application and API. We are committed to minimizing data
            collection, ensuring data portability, and maximizing transparency in compliance with global data protection regulations including GDPR and CCPA.
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
              <p><strong className={isDark ? "text-white" : "text-gray-900"}>Billing Data:</strong> When you subscribe to our Pro plan, payment processing is handled entirely by Stripe. We store your subscription status and billing dates, but we never see or store your full credit card number.</p>
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
              <p>We use your data strictly to provide and improve the Service:</p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li><strong className={isDark ? "text-white" : "text-gray-900"}>Email:</strong> Account identification, security alerts, and JWT payload generation.</li>
                <li><strong className={isDark ? "text-white" : "text-gray-900"}>Documents:</strong> Passed to our AI inference pipeline to generate structured extractions and tax categorizations.</li>
                <li><strong className={isDark ? "text-white" : "text-gray-900"}>Usage Data:</strong> To enforce free tier limits and display usage meters.</li>
                <li><strong className={isDark ? "text-white" : "text-gray-900"}>Integration Tokens:</strong> To sync data to your connected accounting software.</li>
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
                { label: "AI Processing", detail: "Documents are sent to Google Gemini API for processing. We do not retain rights to your data to train their models." },
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

          {/* Sections 4-9 */}
          {[
            {
              id: "4",
              title: "4. Data Retention and Deletion (GDPR & CCPA Compliance)",
              content: "You have the right to access, correct, or delete your personal data at any time. You can delete your account and all associated documents directly from your Account Settings. Upon deletion, your data is purged from our primary databases and storage buckets within 48 hours. Residual backups containing your data may persist for up to 30 days before automatic expiration.",
            },
            {
              id: "5",
              title: "5. Third-Party Services",
              content: "The Service relies on the following third-party infrastructure providers, who process data strictly under Data Processing Agreements (DPAs): Stripe (Payment Processing), Google Cloud (Gemini API & AI inference), Intuit (QuickBooks API), AWS/GCS (File storage), and Vercel/Railway (Application hosting).",
            },
            {
              id: "6",
              title: "6. Cookies and Local Storage",
              content: "We use your browser's localStorage exclusively to store your JWT access token so you remain logged in. We do not use traditional tracking cookies. Clearing your browser data will log you out but will not delete your account or documents from our servers.",
            },
            {
              id: "7",
              title: "7. International Data Transfers",
              content: "If you are accessing the Service from outside the United States, please be aware that your data may be transferred to, stored, and processed in the US. By using the Service, you consent to this transfer pursuant to applicable Standard Contractual Clauses (SCCs).",
            },
            {
              id: "8",
              title: "8. Changes to This Policy",
              content: "We reserve the right to modify this Privacy Policy at any time. Your continued use of the Service after changes constitutes acceptance of the modified Privacy Policy.",
            },
            {
              id: "9",
              title: "9. Contact",
              content: "For privacy, data deletion, or DPA inquiries, please open an issue on our GitHub repository.",
            },
          ].map(({ id, title, content }) => (
            <div key={id} id={id} className={`rounded-2xl border p-6 ${
              isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
            }`}>
              <h2 className={`text-base font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
                {title}
              </h2>
              <p className="text-sm leading-relaxed">{content}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}