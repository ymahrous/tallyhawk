import { useSyncExternalStore } from "react";
import { getRole, type Role } from "@/lib/api";

// Same store as useIsLoggedIn (the token in localStorage, re-read on `storage` events), but answers
// *which kind* of account is signed in, so shared UI (navbar, feedback widget) can differ by role.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSnapshot(): Role | null {
  try {
    return getRole();
  } catch {
    return null;
  }
}

// Server HTML always renders the signed-out state, like useIsLoggedIn.
const getServerSnapshot = () => null;

/** "user", "admin", or null when signed out. */
export function useSessionRole(): Role | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
