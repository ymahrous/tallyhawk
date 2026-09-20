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
            Welcome to Tallyhawk. These Terms of Service apply to your use of the Tallyhawk web
            application, API, and associated documentation. By accessing or using the Service,
            you agree to be bound by these Terms.
          </p>

          {[
            {
              id: "1",
              title: "1. Acceptance of Terms",
              content: "By creating an account or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree to all of these Terms, you are not authorized to use the Service.",
            },
            {
              id: "2",
              title: "2. Description of Service",
              content: "Tallyhawk provides an AI-powered SaaS platform that allows users to upload financial documents (such as invoices and receipts), receive structured JSON data extracted via AI, sync data to accounting software (QuickBooks), and generate tax categorization reports. The Service includes a Free tier and a Pro subscription tier. Please note: The Service currently only supports processing and billing in USD.",
            },
            {
              id: "3",
              title: "3. User Accounts and Security",
              content: "You must be at least 18 years of age to use this Service. You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. Tallyhawk uses JSON Web Tokens for session management. You must not share your access tokens with third parties.",
            },
            {
              id: "4",
              title: "4. Subscriptions and Billing",
              content: "By subscribing to the Tallyhawk Pro tier, you agree to pay the applicable subscription fees via our payment processor (Stripe). All prices are listed in USD. Subscriptions renew automatically at the end of the billing cycle (monthly or annual). You may cancel your subscription at any time; access to Pro features will continue until the end of the current billing period. No partial refunds are provided for unused portions of a billing cycle.",
            },
            {
              id: "5",
              title: "5. User Content, Data Ownership & Integrations",
              content: "You retain all rights and ownership to the documents you upload. By uploading content, you grant Tallyhawk a limited, non-exclusive, temporary license to process the document strictly for generating extraction outputs, categorizations, and syncing to your authorized third-party integrations. \n\nYou are solely responsible for ensuring you have the legal right to upload and process the documents you submit, and that they do not violate any third-party privacy or confidentiality agreements. \n\nWe do not use your documents to train our underlying AI models or the models of our AI sub-processors.",
            },
            {
              id: "6",
              title: "6. Acceptable Use and Rate Limits",
              content: "To ensure platform stability, Tallyhawk enforces usage limits based on your subscription tier. You agree not to abuse the Service. Prohibited actions include, but are not limited to: \n\n• Circumventing or attempting to circumvent usage limits or tier restrictions.\n• Attempting to overload, compromise, or disrupt the infrastructure or AI processing pipeline.\n• Reverse engineering the AI extraction logic or proprietary algorithms.\n• Using automated scripts (bots) to mass-extract data without explicit prior written authorization.\n• Uploading malicious files, malware, or content that is illegal, harmful, or violates intellectual property rights.",
            },
            {
              id: "7",
              title: "7. Intellectual Property",
              content: "The Tallyhawk name, logo, underlying source code, application design, and proprietary AI pipelines are the intellectual property of the author. You may not copy, modify, distribute, or create derivative works based on any part of the Service without prior written consent. You retain all intellectual property rights to your uploaded documents.",
            },
            {
              id: "8",
              title: "8. AI Disclaimer and Accuracy",
              content: "The Service utilizes artificial intelligence and machine learning models to extract and categorize data. AI technology is inherently probabilistic, and extraction results may contain inaccuracies, omissions, or errors (\"hallucinations\"). \n\nYou are entirely responsible for reviewing, verifying, and approving all extracted data and synced financial records before using them for tax filing, legal compliance, or official accounting purposes. Tallyhawk is a data-processing tool and is not a substitute for a certified public accountant (CPA) or tax professional.",
            },
            {
              id: "9",
              title: "9. Disclaimer of Warranties",
              content: "The Service is provided on an as-is and as-available basis without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components.",
            },
            {
              id: "10",
              title: "10. Limitation of Liability",
              content: "To the maximum extent permitted by applicable law, in no event shall Tallyhawk, its developers, directors, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to financial losses, tax penalties, or accounting errors arising from incorrect AI extractions, failed accounting software synchronizations, or inability to use the Service.",
            },
            {
              id: "11",
              title: "11. Indemnification",
              content: "You agree to indemnify, defend, and hold harmless Tallyhawk and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, or expenses (including reasonable attorneys' fees) arising out of or in any way connected with: (a) your access to or use of the Service; (b) your violation of these Terms; or (c) your upload of documents that infringe or violate the rights of any third party, including privacy or intellectual property rights.",
            },
            {
              id: "12",
              title: "12. Termination",
              content: "We reserve the right to suspend or terminate your account and access to the Service at our sole discretion, without prior notice, for conduct that we determine violates these Terms, is harmful to other users, or disrupts the Service. Upon termination, your right to use the Service will immediately cease. Provisions that by their nature should survive termination shall remain in effect.",
            },
            {
              id: "13",
              title: "13. Changes to Terms",
              content: "We reserve the right to modify these Terms at any time. Your continued use of the Service after the effective date of the revised Terms constitutes acceptance of the changes.",
            },
            {
              id: "14",
              title: "14. Contact Information",
              content: "For questions about these Terms, please send us a message through the chat widget.",
            },
            {
              id: "15",
              title: "15. Governing Law and Dispute Resolution",
              content: "These Terms are governed by the laws of the jurisdiction in which Tallyhawk is legally established, without regard to conflict-of-laws principles, except where mandatory local consumer-protection law provides otherwise for users located in the EU, UK, or elsewhere. Before either party initiates formal legal proceedings, you agree to first contact us through the channel described in Section 14 so we can attempt to resolve the dispute informally.",
            },
            {
              id: "16",
              title: "16. International Use",
              content: "The Service is operated from the United States and may be accessed from other countries. If you access the Service from outside the United States, you do so on your own initiative and are responsible for compliance with local laws applicable to your use, including any applicable import/export control and economic sanctions regulations. The Service is not intended for use in any jurisdiction where such use would be unlawful.",
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
              <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}