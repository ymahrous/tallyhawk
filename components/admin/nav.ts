/** The admin dashboard's sections, shared by the navbar's admin menu and the dashboard sidebar. */
export const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Customers" },
  { href: "/admin/deleted-accounts", label: "Deleted accounts" },
  { href: "/admin/admins", label: "Admins" },
  { href: "/admin/contact", label: "Contact inbox" },
  { href: "/admin/feedback", label: "Feedback & bugs" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/account", label: "Admin account" },
] as const;

/** Whether `href` is the current section (the overview only matches exactly). */
export function isActiveAdminLink(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}
