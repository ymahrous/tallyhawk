"use client";

import Link from "next/link";
import { logout } from "@/lib/api";
import { Logo } from "@/components/brand/Logo";
import { useEffect, useState, useRef } from "react";
import { useIsLoggedIn } from "@/lib/useIsLoggedIn";
import { useTheme } from "@/app/providers/ThemeContext";
import { useRouter, usePathname } from "next/navigation";

const APP_LINKS = [
  { href: "/app", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" },
  { href: "/vendors", label: "Vendors" },
  { href: "/account", label: "Account" },
];

function ThemeIcon({ isDark }: { isDark: boolean }) {
  return isDark ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const isLoggedIn = useIsLoggedIn();

  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMenuOpen(false); setDropdownOpen(false); }, [pathname]);

  // Close menus on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setDropdownOpen(false); setMenuOpen(false); }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleLogout = () => { logout(); router.push("/"); };

  const navLinkClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      pathname === href
        ? isDark ? "text-white" : "text-gray-900"
        : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
    }`;

  const dropdownLinkClass = (href: string) =>
    `block w-full text-left px-4 py-2 text-sm ${
      pathname === href
        ? isDark ? "text-white" : "text-gray-900"
        : isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"
    }`;

  const primaryBtnClass = `text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
    isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
  }`;

  const iconBtnClass = `p-2 rounded-full transition-colors ${isDark ? "hover:bg-white/10 text-white" : "hover:bg-black/10 text-gray-900"}`;
  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <nav aria-label="Main" className={`fixed top-0 w-full z-50 border-b backdrop-blur-xl ${isDark ? "bg-black/80 border-white/10" : "bg-white/80 border-gray-200"}`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

        <Link href="/" aria-label="Tallyhawk home" className={isDark ? "text-white" : "text-gray-900"}>
          <Logo />
        </Link>

        {/* Desktop Right Side */}
        <div className="hidden md:flex items-center gap-6">
          <button onClick={toggleTheme} className={iconBtnClass} aria-label="Toggle theme">
            <ThemeIcon isDark={isDark} />
          </button>

          <Link href="/#features" className={navLinkClass("/#features")}>Features</Link>
          <Link href="/pricing" className={navLinkClass("/pricing")} aria-current={current("/pricing")}>Pricing</Link>

          {isLoggedIn ? (
            <div className="flex items-center gap-4">
              {pathname !== "/app" && (
                <Link href="/app" className={primaryBtnClass}>Dashboard</Link>
              )}

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-label="User menu"
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${isDark ? "border-white/20 hover:border-white/40 text-white" : "border-gray-300 hover:border-gray-400 text-gray-700"}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </button>

                {dropdownOpen && (
                  <div role="menu" className={`absolute right-0 mt-2 w-48 rounded-xl shadow-lg border backdrop-blur-xl py-2 z-50 ${isDark ? "bg-black border-white/10" : "bg-white border-gray-200"}`}>
                    {APP_LINKS.map(({ href, label }) => (
                      <Link key={href} href={href} role="menuitem" className={dropdownLinkClass(href)} aria-current={current(href)}>
                        {label}
                      </Link>
                    ))}
                    <div className={`my-1 border-t ${isDark ? "border-white/10" : "border-gray-100"}`}></div>
                    <button role="menuitem" onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className={navLinkClass("/login")} aria-current={current("/login")}>Log in</Link>
              <Link href="/signup" className={primaryBtnClass}>Get started</Link>
            </div>
          )}
        </div>

        {/* Mobile Right Side */}
        <div className="flex md:hidden items-center gap-2">
          <button onClick={toggleTheme} className={iconBtnClass} aria-label="Toggle theme">
            <ThemeIcon isDark={isDark} />
          </button>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className={iconBtnClass}
          >
            {menuOpen ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div id="mobile-menu" className={`md:hidden border-t px-6 py-4 flex flex-col gap-4 ${isDark ? "bg-black/90 border-white/10" : "bg-white/90 border-gray-200"}`}>
          <Link href="/#features" className={navLinkClass("/#features")}>Features</Link>
          <Link href="/pricing" className={navLinkClass("/pricing")} aria-current={current("/pricing")}>Pricing</Link>
          {isLoggedIn ? (
            <>
              {APP_LINKS.map(({ href, label }) => (
                <Link key={href} href={href} className={navLinkClass(href)} aria-current={current(href)}>{label}</Link>
              ))}
              <button onClick={handleLogout} className="text-left text-sm font-medium text-red-500 transition-colors">Log out</button>
            </>
          ) : (
            <>
              <Link href="/login" className={navLinkClass("/login")} aria-current={current("/login")}>Log in</Link>
              <Link href="/signup" className={`text-sm font-medium px-4 py-2 rounded-lg text-left ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>Get started</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
