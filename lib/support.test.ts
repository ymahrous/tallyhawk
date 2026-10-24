import { describe, expect, it } from "vitest";
import { CONTACT_LIMITS, FEEDBACK_TYPES, TRIAGE_STATUSES, validateContactForm } from "./support";
import { validateEmail } from "./validation";

const valid = { name: "Ada", email: "ada@example.com", subject: "Billing", message: "Can I get an invoice?" };

describe("support rules", () => {
  it("lists the feedback types and triage states the API accepts", () => {
    expect(FEEDBACK_TYPES).toEqual(["Suggestion", "Bug", "Other"]);
    expect(TRIAGE_STATUSES).toEqual(["new", "in_progress", "resolved", "archived"]);
  });

  it("accepts a complete contact form", () => {
    expect(validateContactForm(valid, validateEmail)).toEqual({});
  });

  it("reports every missing or oversized field", () => {
    expect(validateContactForm({ name: " ", email: "nope", subject: "", message: "short" }, validateEmail)).toEqual({
      name: "Please enter your name.",
      email: "Please enter a valid email address.",
      subject: "Please add a subject.",
      message: `Please write at least ${CONTACT_LIMITS.messageMin} characters.`,
    });
    const tooLong = validateContactForm(
      { name: "n".repeat(CONTACT_LIMITS.name + 1), email: valid.email, subject: "s".repeat(CONTACT_LIMITS.subject + 1), message: "m".repeat(CONTACT_LIMITS.message + 1) },
      validateEmail
    );
    expect(Object.keys(tooLong).sort()).toEqual(["message", "name", "subject"]);
  });
});
