"use client";

import { useTheme } from "@/app/providers/ThemeContext";

export default function AccessibilityStatement() {
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
          Accessibility Statement
        </h1>
        <p className={`text-sm mb-12 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          Last updated: July 2026
        </p>

        <div className="space-y-8">
          <p>
            Tallyhawk is committed to making our web application usable by everyone, including people who rely on
            assistive technology such as screen readers, keyboard-only navigation, or voice control. Accessibility is
            an ongoing effort, and this page describes where we currently stand.
          </p>

          {[
            {
              id: "1",
              title: "1. Conformance Target",
              content: "We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1, Level AA. These guidelines explain how to make web content more accessible to people with a wide range of disabilities. Tallyhawk is not yet fully conformant, but we are actively working through the gaps described below.",
            },
            {
              id: "2",
              title: "2. Measures We Take",
              content: "• Semantic HTML and native interactive elements (buttons, form fields, links) so assistive technology can identify and operate them correctly. \n• Descriptive alt text on document preview images, and aria-label attributes on icon-only controls (theme toggle, delete, menu). \n• Form fields are associated with visible or screen-reader-only labels rather than placeholder text alone. \n• Error and status messages are exposed to screen readers via live regions instead of relying on color alone. \n• A dark/light theme that respects your operating system's color scheme preference, with no flash of unstyled content on load. \n• Layouts that reflow for keyboard and touch use, avoiding reliance on hover-only interactions for core functionality.",
            },
            {
              id: "3",
              title: "3. Known Limitations",
              content: "We know we still have work to do, including: fully auditing color contrast across dark and light themes; ensuring every interactive element has a visible focus indicator, not just a hover state; and running the app through real screen reader testing (VoiceOver, NVDA, JAWS) rather than automated checks alone. These are active work items, not settled gaps we consider acceptable.",
            },
            {
              id: "4",
              title: "4. Third-Party Content",
              content: "Some parts of the Service embed third-party components (for example, the Stripe billing portal and the QuickBooks OAuth flow). We choose reputable vendors, but we do not control the accessibility of their interfaces directly.",
            },
            {
              id: "5",
              title: "5. Feedback",
              content: "If you encounter an accessibility barrier while using Tallyhawk, please tell us through the chat widget in the corner of the screen, including the page you were on and, if possible, the assistive technology you were using. We prioritize accessibility fixes reported this way.",
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
