import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRole, homePathFor, isTokenExpired, type Role } from "@/lib/api";

/**
 * Guards a signed-in page for one account type. Signed-out (or expired) visitors go to /login; the
 * other account type goes to its own home, so customers never see admin pages and admins never see
 * customer pages. Returns true once the page may render. The API enforces the same split, so this
 * is about what people see, not what they can do.
 */
export function useAuthGuard(required: Role): boolean {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isTokenExpired()) {
      router.push("/login");
      return;
    }
    const role = getRole();
    if (role !== required) {
      router.replace(homePathFor(role));
      return;
    }
    setAllowed(true);
  }, [router, required]);

  return allowed;
}
