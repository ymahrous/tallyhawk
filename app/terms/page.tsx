"use client";

import { useTheme } from "@/app/providers/ThemeContext";

export default function TermsOfService() {
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
          Terms of Service
        </h1>
        <p className={`text-sm mb-12 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          Last updated: July 2026
        </p>

        <div className="space-y-8">
          <p>
            Welcome to edocAI. These Terms of Service apply to your use of the edocAI web
            application, API, and associated documentation. By accessing or using the Service,
            you agree to be bound by these Terms.
          </p>

          {[
            {
              id: "1",
              title: "1. Acceptance of Terms",
              content: "By creating an account or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to all of these Terms, you are not authorized to use the Service.",
            },
            {
              id: "2",
              title: "2. Description of Service",
              content: "edocAI provides an AI-powered SaaS platform that allows users to upload financial documents (such as invoices and receipts), receive structured JSON data extracted via AI, sync data to accounting software (QuickBooks), and generate tax categorization reports. The Service includes a Free tier and a Pro subscription tier.",
            },
            {
              id: "3",
              title: "3. User Accounts and Security",
              content: "You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. edocAI uses JSON Web Tokens for session management. You must not share your access tokens with third parties.",
            },
            {
              id: "4",
              title: "4. Subscriptions and Billing",
              content: "By subscribing to the edocAI Pro tier, you agree to pay the applicable subscription fees via our payment processor (Stripe). Subscriptions renew automatically at the end of the billing cycle (monthly or annual). You may cancel your subscription at any time; access to Pro features will continue until the end of the current billing period. No partial refunds are provided for unused portions of a billing cycle.",
            },
            {
              id: "5",
              title: "5. User Content & Integrations",
              content: "You retain all rights to the documents you upload. By uploading content, you grant edocAI a limited, non-exclusive license to process the document strictly for generating extraction outputs, categorizations, and syncing to your authorized third-party integrations. You are solely responsible for ensuring you have the legal right to upload and process the documents you submit. We do not use your documents to train our underlying AI models.",
            },
            {
              id: "6",
              title: "6. Acceptable Use and Rate Limits",
              content: "To ensure platform stability, edocAI enforces usage limits based on your subscription tier. You agree not to abuse the Service by circumventing these limits, attempting to overload the infrastructure, reverse engineering the AI pipeline, or using automated scripts to mass-extract data without prior authorization.",
            },
            {
              id: "7",
              title: "7. Intellectual Property",
              content: "The edocAI name, logo, underlying code, and UI design are the intellectual property of edocAI. You may not copy, modify, or distribute any part of the Service without prior written consent.",
            },
            {
              id: "8",
              title: "8. Disclaimer of Warranties",
              content: "The Service is provided on an as-is and as-available basis without warranties of any kind. AI extraction results and tax categorizations may contain inaccuracies. You are entirely responsible for verifying all extracted data and synced financial records before using them for tax, legal, or official accounting purposes. edocAI is not a substitute for a certified accountant.",
            },
            {
              id: "9",
              title: "9. Limitation of Liability",
              content: "In no event shall edocAI, its developers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to financial losses arising from incorrect AI extractions or failed accounting software synchronizations.",
            },
            {
              id: "10",
              title: "10. Changes to Terms",
              content: "We reserve the right to modify these Terms at any time. Your continued use of the Service after changes constitutes acceptance of the modified Terms.",
            },
            {
              id: "11",
              title: "11. Contact Information",
              content: "For questions about these Terms, please send us a message through the chat widget.",
            },
          ].map(({ id, title, content }) => (
            <div key={id} id={id} className={`rounded-2xl border p-6 ${
              isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
            }`}>
              <h2 className={`text-base font-semibold mb-3 ${
                isDark ? "text-white" : "text-gray-900"
              }`}>
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