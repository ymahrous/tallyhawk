"use client";
import Link from "next/link";
import { useState } from "react";
// import { useRouter } from "next/navigation";
import { requestPasswordReset } from "@/lib/api";
import { useTheme } from "@/app/providers/ThemeContext";

export default function ForgotPasswordPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  // const router = useRouter();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");

  const validateEmail = (value: string): string => {
    if (!value) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email address.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    try {
      await requestPasswordReset(email.trim());
      setMessage("If an account with that email exists, a reset link has been sent to your inbox. Please check your email (and spam folder).");
    } catch (err) {
      setError("Unable to request reset. Please try again later.");
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
            Forgot Password
          </h1>
          <p className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Enter your email to get a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <label htmlFor="forgot-email" className="sr-only">Email address</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(validateEmail(e.target.value));
              }}
              aria-invalid={!!emailError}
              className={`w-full bg-transparent text-sm pb-3 border-b-2 outline-none transition-colors ${
                isDark ? "border-gray-700 text-white focus:border-white placeholder-gray-500" : "border-gray-200 text-gray-900 focus:border-black placeholder-gray-400"
              }`}
              placeholder="Email address"
              required
            />
          </div>

          {emailError && <p role="alert" className="text-xs text-amber-500 mt-1">{emailError}</p>}
          {error && <p role="alert" className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-lg">{message}</p>}

          <button
            type="submit"
            disabled={isLoading || !email || !!emailError}
            className={`w-full py-3.5 rounded-full text-sm font-semibold transition-all disabled:opacity-40 ${
              isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
            }`}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      </div>

      <p className={`relative mt-8 text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        Remember your password?{" "}
        <Link href="/login" className={`font-semibold transition-colors ${isDark ? "text-white hover:text-gray-300" : "text-black hover:text-gray-700"}`}>
          Login
        </Link>
      </p>
    </section>
  );
}