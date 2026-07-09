"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isTokenExpired, login } from "@/lib/api";
import { useTheme } from "../providers/ThemeContext";
import PasswordToggle from "@/components/ui/PasswordToggle";

export default function LoginPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockSecondsRemaining, setLockSecondsRemaining] = useState(0);
  const [emailError, setEmailError] = useState("");

  const validateEmail = (value: string): string => {
    if (!value) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email address.";
    return "";
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isTokenExpired()) { router.push("/app"); return; }
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    if (lockedUntil === null) {
      setIsLocked(false);
      setLockSecondsRemaining(0);
      return;
    }

    const ticker = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setIsLocked(false);
        setLockSecondsRemaining(0);
        setLockedUntil(null);
        clearInterval(ticker);
      } else {
        setIsLocked(true);
        setLockSecondsRemaining(remaining);
      }
    }, 1000);

    const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
    setIsLocked(remaining > 0);
    setLockSecondsRemaining(Math.max(remaining, 0));

    return () => clearInterval(ticker);
  }, [lockedUntil]);

  useEffect(() => {
    if (!isLocked) return;
    const ticker = setInterval(() => {
      if (Date.now() >= lockedUntil!) {
        setLockedUntil(null);
      }
    }, 1000);
    return () => clearInterval(ticker);
  }, [isLocked, lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      setError(`Too many attempts. Try again in ${lockSecondsRemaining} seconds.`);
      return;
    }

    setError("");
    setIsLoading(true);

    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    try {
      await login(email, password);
      // router.push("/app");
      window.location.reload();
    } catch (err: unknown) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= 5) {
        const unlockTime = Date.now() + 30_000;
        setLockedUntil(unlockTime);
        setAttempts(0);
        setError("Too many failed attempts. Please wait 30 seconds.");
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={`min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 relative overflow-hidden ${
      isDark ? "bg-black" : "bg-gray-50"
    }`}>
      {/* Floating Card */}
      <div className={`relative w-full max-w-sm p-10 rounded-3xl shadow-2xl ${
        isDark ? "bg-slate-900/80 backdrop-blur-xl border border-white/10" : "bg-white/80 backdrop-blur-xl border border-gray-200/50"
      }`}>
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            Welcome back
          </h1>
          <p className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Sign in to your edocAI account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(validateEmail(e.target.value));
              }}
              className={`w-full bg-transparent text-sm pb-3 border-b-2 outline-none transition-colors placeholder:text-opacity-40 ${
                isDark 
                  ? "border-gray-700 text-white focus:border-white placeholder-gray-500" 
                  : "border-gray-200 text-gray-900 focus:border-black placeholder-gray-400"
              }`}
              placeholder="Email address"
              required
            />

            {emailError && (
              <p className="text-xs text-amber-500 mt-1">{emailError}</p>
            )}
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full bg-transparent text-sm pb-3 border-b-2 outline-none transition-colors placeholder:text-opacity-40 pr-10 ${
                isDark 
                  ? "border-gray-700 text-white focus:border-white placeholder-gray-500" 
                  : "border-gray-200 text-gray-900 focus:border-black placeholder-gray-400"
              }`}
              placeholder="Password"
              required
            />
            
            <PasswordToggle
              show={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
              isDark={isDark}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium bg-red-500/10 px-4 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || isLocked || !email || !password || !!emailError}
            className={`w-full py-3.5 rounded-full text-sm font-semibold transition-all shadow-lg disabled:shadow-none ${
              isDark
                ? "bg-white text-black hover:bg-gray-200 disabled:bg-gray-600 shadow-white/10 disabled:text-gray-400"
                : "bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 shadow-black/10 disabled:text-gray-600"
            }`}
          >
            {isLocked
              ? `Locked (${lockSecondsRemaining}s)`
              : isLoading
              ? "Signing in..."
              : "Continue"}
          </button>

          <div className="flex justify-start mt-2">
            <Link href="/forgot-password" className={`text-xs transition-colors ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
              forgot password
            </Link>
          </div>
        </form>
      </div>

      {/* Footer Link */}
      <p className={`relative mt-8 text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        Don{"'"}t have an account?{" "}
        <Link href="/signup" className={`font-semibold transition-colors ${isDark ? "text-white hover:text-gray-300" : "text-black hover:text-gray-700"}`}>
          Sign up
        </Link>
      </p>
    </section>
  );
}