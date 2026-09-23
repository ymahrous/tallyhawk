"use client";
import Link from "next/link";
import { resetPassword } from "@/lib/api";
import { useState, useEffect } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import PasswordToggle from "@/components/ui/PasswordToggle";
import { useRouter, useSearchParams } from "next/navigation";
import { validatePassword } from "@/lib/validation";
import PasswordStrengthMeter from "@/components/ui/PasswordStrengthMeter";

export default function ResetPasswordPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(token!, newPassword);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={`min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 ${
      isDark ? "bg-black" : "bg-gray-50"
    }`}>
      <div className={`relative w-full max-w-sm p-10 rounded-3xl shadow-2xl ${
        isDark ? "bg-slate-900/80 backdrop-blur-xl border border-white/10" : "bg-white/80 backdrop-blur-xl border border-gray-200/50"
      }`}>
        <div className="text-center mb-10">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            Reset Password
          </h1>
          <p className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Enter your new password below.
          </p>
        </div>

        {success ? (
          <div className="text-center">
            <p role="status" className="text-sm text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-lg mb-4">
              Password updated! Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* New Password Input Block */}
            <div className="relative flex items-center">
              <label htmlFor="reset-new-password" className="sr-only">New password</label>
              <input
                id="reset-new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError(validatePassword(e.target.value));
                }}
                className={`w-full bg-transparent text-sm pb-3 border-b-2 outline-none transition-colors placeholder:text-opacity-40 pr-10 ${
                  isDark
                    ? "border-gray-700 text-white focus:border-white placeholder-gray-500"
                    : "border-gray-200 text-gray-900 focus:border-black placeholder-gray-400"
                }`}
                placeholder="New password"
                required
              />
              <PasswordToggle
                show={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
                isDark={isDark}
              />
            </div>

            <PasswordStrengthMeter password={newPassword} isDark={isDark} />

            {/* Password validation error */}
            {passwordError && (
              <p role="alert" className="text-xs text-amber-500 mt-1">{passwordError}</p>
            )}

            {/* Confirm Password Input Block */}
            <div className="relative">
              <label htmlFor="reset-confirm-password" className="sr-only">Confirm new password</label>
              <input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-transparent text-sm pb-3 border-b-2 outline-none transition-colors placeholder:text-opacity-40 ${
                  isDark
                    ? "border-gray-700 text-white focus:border-white placeholder-gray-500"
                    : "border-gray-200 text-gray-900 focus:border-black placeholder-gray-400"
                }`}
                placeholder="Confirm new password"
                required
              />
            </div>

            {error && <p role="alert" className="text-sm text-red-500 font-medium bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || !token || !newPassword || !confirmPassword || newPassword !== confirmPassword || !!passwordError}
              className={`w-full py-3.5 rounded-full text-sm font-semibold transition-all shadow-lg disabled:shadow-none ${
                isDark
                  ? "bg-white text-black hover:bg-gray-200 disabled:bg-gray-600 shadow-white/10 disabled:text-gray-400"
                  : "bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 shadow-black/10 disabled:text-gray-600"
              }`}
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>

      <p className={`relative mt-8 text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        <Link href="/login" className={`font-semibold transition-colors ${isDark ? "text-white hover:text-gray-300" : "text-black hover:text-gray-700"}`}>
          Back to Login
        </Link>
      </p>
    </section>
  );
}