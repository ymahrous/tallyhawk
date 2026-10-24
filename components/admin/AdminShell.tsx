"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/app/providers/ThemeContext";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { ADMIN_LINKS, isActiveAdminLink } from "./nav";
import { adminStyles } from "./styles";

/**
 * Frame of every /admin page: the admin-only guard (customers are sent to /app, signed-out visitors
 * to /login) and the section navigation. Pages render nothing until the guard passes.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const isDark = useTheme().theme === "dark";
  const styles = adminStyles(isDark);
  const pathname = usePathname() ?? "/admin";
  const allowed = useAuthGuard("admin");

  if (!allowed) return null;

  const linkClass = (active: boolean) =>
    `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? isDark ? "bg-white/10 text-white" : "bg-gray-900 text-white"
        : isDark ? "text-gray-400 hover:bg-white/5 hover:text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <div className={`min-h-screen ${styles.page}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-24 pt-24 sm:px-6 lg:flex-row lg:gap-10">
        <nav aria-label="Admin sections" className="lg:w-52 lg:shrink-0">
          <p className={`mb-3 hidden text-xs font-semibold uppercase tracking-wider lg:block ${styles.muted}`}>Admin</p>
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {ADMIN_LINKS.map(({ href, label }) => {
              const active = isActiveAdminLink(pathname, href);
              return (
                <li key={href}>
                  <Link href={href} className={`block ${linkClass(active)}`} aria-current={active ? "page" : undefined}>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
