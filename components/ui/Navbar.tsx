"use client";

import { logout } from "@/lib/api";
import { useEffect, useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const syncAuth = () => {
      setIsLoggedIn(!!localStorage.getItem("token"));
    };
    syncAuth();
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const navLinkClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      pathname === href
        ? isDark
          ? "text-white"
          : "text-gray-900"
        : isDark
        ? "text-gray-500 hover:text-white"
        : "text-gray-400 hover:text-gray-900"
    }`;

  return (
    <nav
      className={`fixed top-0 w-full z-50 border-b backdrop-blur-xl ${
        isDark ? "bg-black/80 border-white/10" : "bg-white/80 border-gray-200"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => router.push("/")}
        >
          <span className={`text-lg font-semibold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            edocAI
          </span>
        </div>

        {/* Desktop Right Side */}
        <div className="hidden md:flex items-center gap-4">

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-colors ${
              isDark ? "hover:bg-white/10 text-white" : "hover:bg-black/10 text-gray-900"
            }`}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Pricing (ALWAYS VISIBLE) */}
          {pathname !== "/pricing" && (
            <button
              onClick={() => router.push("/pricing")}
              className={navLinkClass("/pricing")}
            >
              Pricing
            </button>
          )}

          {/* Auth Links */}
          {isLoggedIn ? (
            <div className="flex items-center gap-4">
              {pathname !== "/app" && (
                <button onClick={() => router.push("/app")} className={navLinkClass("/app")}>
                  Dashboard
                </button>
              )}

              {pathname !== "/account" && (
                <button onClick={() => router.push("/account")} className={navLinkClass("/account")}>
                  Account
                </button>
              )}

              <button onClick={handleLogout} className={navLinkClass("")}>
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/login")} className={navLinkClass("/login")}>
                Login
              </button>

              <button
                onClick={() => router.push("/signup")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-full transition-colors"
              >
                Get Started
              </button>
            </div>
          )}
        </div>

        {/* Mobile Right Side */}
        <div className="flex md:hidden items-center gap-2">

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-colors ${
              isDark ? "hover:bg-white/10 text-white" : "hover:bg-black/10 text-gray-900"
            }`}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className={`p-2 rounded-full transition-colors ${
              isDark ? "hover:bg-white/10 text-white" : "hover:bg-black/10 text-gray-900"
            }`}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div
          className={`md:hidden border-t px-6 py-4 flex flex-col gap-4 ${
            isDark ? "bg-black/90 border-white/10" : "bg-white/90 border-gray-200"
          }`}
        >
          {/* Pricing ALWAYS visible */}
          {pathname !== "/pricing" && (
            <button
              onClick={() => router.push("/pricing")}
              className={navLinkClass("/pricing")}
            >
              Pricing
            </button>
          )}

          {isLoggedIn ? (
            <>
              <button onClick={() => router.push("/app")} className={navLinkClass("/app")}>
                Dashboard
              </button>

              <button onClick={() => router.push("/account")} className={navLinkClass("/account")}>
                Account
              </button>

              <button onClick={handleLogout} className={navLinkClass("")}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button onClick={() => router.push("/login")} className={navLinkClass("/login")}>
                Login
              </button>

              <button
                onClick={() => router.push("/signup")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-full text-left"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}