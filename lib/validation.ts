const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message, or "" when the email is valid. */
export function validateEmail(value: string): string {
  if (!value) return "Email is required.";
  if (!EMAIL_PATTERN.test(value)) return "Please enter a valid email address.";
  return "";
}

/** Mirrors the backend's password policy. Returns an error message, or "" when the password is acceptable. */
export function validatePassword(value: string): string {
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(value)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(value)) return "Password must contain at least one number.";
  return "";
}

export interface PasswordStrength {
  /** 0–5: one point each for length ≥ 8, length ≥ 12, an uppercase letter, a digit and a symbol. */
  score: number;
  label: string;
  /** Tailwind background class for the filled meter segments. */
  color: string;
}

export function getPasswordStrength(value: string): PasswordStrength {
  if (!value) return { score: 0, label: "", color: "" };

  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  if (score <= 1) return { score, label: "Very weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Weak", color: "bg-orange-500" };
  if (score === 3) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score === 4) return { score, label: "Strong", color: "bg-blue-500" };
  return { score, label: "Very strong", color: "bg-emerald-500" };
}
