import { useSyncExternalStore } from "react";

// The JWT in localStorage is the auth source of truth (see lib/api.ts). `storage` only fires in
// other tabs, so logout() dispatches one manually for same-tab listeners.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSnapshot() {
  try {
    return !!localStorage.getItem("token");
  } catch {
    return false;
  }
}

// The server can't see localStorage, so server HTML always renders the logged-out state and the
// client swaps in the real value right after hydration.
function getServerSnapshot() {
  return false;
}

/** Whether a token is present. Re-reads on every render, so it also catches reload-free logins. */
export function useIsLoggedIn(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
