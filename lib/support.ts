// Rules for the feedback widget and the contact form, shared by the forms and the API so a form
// check and the server's check can't disagree.

export const FEEDBACK_TYPES = ["Suggestion", "Bug", "Other"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const MAX_FEEDBACK_LENGTH = 5000;

export const CONTACT_LIMITS = {
  name: 120,
  subject: 200,
  messageMin: 10,
  message: 5000,
} as const;

/** Triage states an admin moves feedback and contact messages through. */
export const TRIAGE_STATUSES = ["new", "in_progress", "resolved", "archived"] as const;
export type TriageStatus = (typeof TRIAGE_STATUSES)[number];

export interface ContactFormValues {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/** Field errors for the contact form ({} when valid). The email rule is lib/validation's. */
export function validateContactForm(values: ContactFormValues, validateEmail: (value: string) => string): Partial<Record<keyof ContactFormValues, string>> {
  const errors: Partial<Record<keyof ContactFormValues, string>> = {};
  const name = values.name.trim();
  const subject = values.subject.trim();
  const message = values.message.trim();
  if (!name) errors.name = "Please enter your name.";
  else if (name.length > CONTACT_LIMITS.name) errors.name = `Please keep your name under ${CONTACT_LIMITS.name} characters.`;
  const emailError = validateEmail(values.email.trim());
  if (emailError) errors.email = emailError;
  if (!subject) errors.subject = "Please add a subject.";
  else if (subject.length > CONTACT_LIMITS.subject) errors.subject = `Please keep the subject under ${CONTACT_LIMITS.subject} characters.`;
  if (message.length < CONTACT_LIMITS.messageMin) errors.message = `Please write at least ${CONTACT_LIMITS.messageMin} characters.`;
  else if (message.length > CONTACT_LIMITS.message) errors.message = `Please keep your message under ${CONTACT_LIMITS.message} characters.`;
  return errors;
}
