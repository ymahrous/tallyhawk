"use client";

import Link from "next/link";
import { resetPassword } from "@/lib/api";
import { useState, useEffect } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
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
            <p className="text-sm text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-lg mb-4">
              Password updated! Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`w-full bg-transparent text-sm pb-3 border-b-2 outline-none transition-colors ${
                  isDark ? "border-gray-700 text-white focus:border-white placeholder-gray-500" : "border-gray-200 text-gray-900 focus:border-black placeholder-gray-400"
                }`}
                placeholder="New password"
                required
              />
            </div>

            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-transparent text-sm pb-3 border-b-2 outline-none transition-colors ${
                  isDark ? "border-gray-700 text-white focus:border-white placeholder-gray-500" : "border-gray-200 text-gray-900 focus:border-black placeholder-gray-400"
                }`}
                placeholder="Confirm new password"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || !token || !newPassword || newPassword !== confirmPassword}
              className={`w-full py-3.5 rounded-full text-sm font-semibold transition-all disabled:opacity-40 ${
                isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
              }`}
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>

      <p className={`relative mt-8 text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        <Link href="/login" className={`font-semibold transition-colors ${isDark ? "text-white hover:text-gray-300" : "text-black hover:text-gray-700"}`}>
          Back to Login
        </Link>
      </p>
    </section>
  );
}