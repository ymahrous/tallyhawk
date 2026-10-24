"use client";

import { useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { sendContactMessage } from "@/lib/api";
import { CONTACT_LIMITS, validateContactForm, type ContactFormValues } from "@/lib/support";
import { validateEmail } from "@/lib/validation";

const EMPTY: ContactFormValues = { name: "", email: "", subject: "", message: "" };

const FIELDS: { key: keyof ContactFormValues; label: string; type?: string; autoComplete?: string; maxLength: number }[] = [
  { key: "name", label: "Name", autoComplete: "name", maxLength: CONTACT_LIMITS.name },
  { key: "email", label: "Email", type: "email", autoComplete: "email", maxLength: 254 },
  { key: "subject", label: "Subject", maxLength: CONTACT_LIMITS.subject },
];

/** The contact page's form (a client island on a Server Component page). */
export default function ContactForm() {
  const isDark = useTheme().theme === "dark";
  const [values, setValues] = useState<ContactFormValues>(EMPTY);
  // Honeypot: visually hidden and skipped by keyboard and screen readers, so only bots fill it in.
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormValues, string>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [submitError, setSubmitError] = useState("");

  const inputClass = (hasError: boolean) =>
    `w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
      hasError
        ? "border-red-500"
        : isDark
          ? "border-white/10 focus:border-indigo-400"
          : "border-gray-300 focus:border-indigo-500"
    } ${isDark ? "bg-white/5 text-white placeholder-gray-500" : "bg-white text-gray-900 placeholder-gray-400"}`;
  const labelClass = `mb-1.5 block text-sm font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`;

  const update = (key: keyof ContactFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    const found = validateContactForm(values, validateEmail);
    setErrors(found);
    if (Object.keys(found).length) return;

    setStatus("sending");
    try {
      await sendContactMessage({
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
        website,
      });
      setStatus("sent");
      setValues(EMPTY);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "We couldn't send your message. Please try again.");
      setStatus("idle");
    }
  };

  if (status === "sent") {
    return (
      <div role="status" className={`rounded-2xl border p-6 ${isDark ? "border-emerald-500/30 bg-emerald-500/10" : "border-emerald-200 bg-emerald-50"}`}>
        <p className={`font-semibold ${isDark ? "text-emerald-300" : "text-emerald-800"}`}>Thanks, your message is on its way.</p>
        <p className={`mt-1 text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>We'll reply to the email address you gave us.</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className={`mt-4 text-sm font-medium underline underline-offset-4 ${isDark ? "text-white" : "text-gray-900"}`}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {FIELDS.map(({ key, label, type = "text", autoComplete, maxLength }) => (
        <div key={key}>
          <label htmlFor={`contact-${key}`} className={labelClass}>{label}</label>
          <input
            id={`contact-${key}`}
            type={type}
            autoComplete={autoComplete}
            maxLength={maxLength}
            value={values[key]}
            onChange={(e) => update(key, e.target.value)}
            aria-invalid={!!errors[key]}
            aria-describedby={errors[key] ? `contact-${key}-error` : undefined}
            className={inputClass(!!errors[key])}
          />
          {errors[key] && <p id={`contact-${key}-error`} className="mt-1 text-xs text-red-500">{errors[key]}</p>}
        </div>
      ))}

      <div>
        <label htmlFor="contact-message" className={labelClass}>Message</label>
        <textarea
          id="contact-message"
          rows={6}
          maxLength={CONTACT_LIMITS.message}
          value={values.message}
          onChange={(e) => update("message", e.target.value)}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          className={`${inputClass(!!errors.message)} resize-y`}
        />
        {errors.message && <p id="contact-message-error" className="mt-1 text-xs text-red-500">{errors.message}</p>}
      </div>

      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {submitError && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-500">{submitError}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className={`w-full rounded-full py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
          isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
