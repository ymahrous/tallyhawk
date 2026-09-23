import { getPasswordStrength } from "@/lib/validation";

const LABEL_COLORS = [
  "text-red-500",
  "text-red-500",
  "text-orange-500",
  "text-yellow-500",
  "text-blue-500",
  "text-emerald-500",
];

/** Five-segment strength bar shown under new-password fields (signup, reset password). */
export default function PasswordStrengthMeter({
  password,
  isDark,
}: {
  password: string;
  isDark: boolean;
}) {
  if (!password) return null;
  const strength = getPasswordStrength(password);

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((segment) => (
          <div
            key={segment}
            data-filled={segment <= strength.score}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              segment <= strength.score ? strength.color : isDark ? "bg-white/10" : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p aria-live="polite" className={`text-xs transition-colors ${LABEL_COLORS[strength.score]}`}>
        <span className="sr-only">Password strength: </span>
        {strength.label}
      </p>
    </div>
  );
}
