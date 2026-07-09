"use client";
import { logout } from "@/lib/api";
import { useEffect, useState, useRef } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncAuth = () => setIsLoggedIn(!!localStorage.getItem("token"));
    syncAuth();
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, [pathname]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Close dropdown if clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => { logout(); router.push("/"); };

  const navLinkClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      pathname === href
        ? isDark ? "text-white" : "text-gray-900"
        : isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-900"
    }`;

  const primaryBtnClass = `text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
    isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
  }`;

  return (
    <nav className={`fixed top-0 w-full z-50 border-b backdrop-blur-xl ${isDark ? "bg-black/80 border-white/10" : "bg-white/80 border-gray-200"}`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push("/")}>
          <span className={`text-lg font-semibold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>edocAI</span>
        </div>

        {/* Desktop Right Side */}
        <div className="hidden md:flex items-center gap-6">
          <button onClick={toggleTheme} className={`p-2 rounded-full transition-colors ${isDark ? "hover:bg-white/10 text-white" : "hover:bg-black/10 text-gray-900"}`} aria-label="Toggle theme">
            {isDark ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
          </button>

          {pathname !== "/pricing" && (
            <button onClick={() => router.push("/pricing")} className={navLinkClass("/pricing")}>Pricing</button>
          )}

          {isLoggedIn ? (
            <div className="flex items-center gap-4">
              {/* Always show Dashboard button prominently */}
              {pathname !== "/app" && (
                <button onClick={() => router.push("/app")} className={primaryBtnClass}>Dashboard</button>
              )}

              {/* User Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${isDark ? "border-white/20 hover:border-white/40 text-white" : "border-gray-300 hover:border-gray-400 text-gray-700"}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </button>

                {dropdownOpen && (
                  <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-lg border backdrop-blur-xl py-2 z-50 ${isDark ? "bg-black border-white/10" : "bg-white border-gray-200"}`}>
                    {pathname === "/app" && (
                      <button onClick={() => { router.push("/app"); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${isDark ? "text-white hover:bg-white/10" : "text-gray-900 hover:bg-gray-100"}`}>
                        Dashboard
                      </button>
                    )}
                    <button onClick={() => { router.push("/analytics"); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${pathname === "/analytics" ? (isDark ? "text-white" : "text-gray-900") : (isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100")}`}>
                      Analytics
                    </button>
                    <button onClick={() => { router.push("/vendors"); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${pathname === "/vendors" ? (isDark ? "text-white" : "text-gray-900") : (isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100")}`}>
                      Vendors
                    </button>
                    <button onClick={() => { router.push("/account"); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${pathname === "/account" ? (isDark ? "text-white" : "text-gray-900") : (isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100")}`}>
                      Account
                    </button>
                    <div className={`my-1 border-t ${isDark ? "border-white/10" : "border-gray-100"}`}></div>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/login")} className={navLinkClass("/login")}>Login</button>
              <button onClick={() => router.push("/signup")} className={primaryBtnClass}>Get Started</button>
            </div>
          )}
        </div>

        {/* Mobile Right Side */}
        <div className="flex md:hidden items-center gap-2">
          <button onClick={toggleTheme} className={`p-2 rounded-full transition-colors ${isDark ? "hover:bg-white/10 text-white" : "hover:bg-black/10 text-gray-900"}`} aria-label="Toggle theme">
            {isDark ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
          </button>
          <button onClick={() => setMenuOpen((prev) => !prev)} className={`p-2 rounded-full transition-colors ${isDark ? "hover:bg-white/10 text-white" : "hover:bg-black/10 text-gray-900"}`}>
            {menuOpen ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className={`md:hidden border-t px-6 py-4 flex flex-col gap-4 ${isDark ? "bg-black/90 border-white/10" : "bg-white/90 border-gray-200"}`}>
          {pathname !== "/pricing" && <button onClick={() => router.push("/pricing")} className={navLinkClass("/pricing")}>Pricing</button>}
          {isLoggedIn ? (
            <>
              <button onClick={() => router.push("/app")} className={navLinkClass("/app")}>Dashboard</button>
              <button onClick={() => router.push("/vendors")} className={navLinkClass("/analytics")}>Analytics</button>
              <button onClick={() => router.push("/vendors")} className={navLinkClass("/vendors")}>Vendors</button>
              <button onClick={() => router.push("/account")} className={navLinkClass("/account")}>Account</button>
              <button onClick={handleLogout} className="text-sm font-medium text-red-500 transition-colors">Log out</button>
            </>
          ) : (
            <>
              <button onClick={() => router.push("/login")} className={navLinkClass("/login")}>Login</button>
              <button onClick={() => router.push("/signup")} className={`text-sm font-medium px-4 py-2 rounded-lg text-left ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>Get Started</button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}