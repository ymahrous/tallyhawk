import { useSyncExternalStore } from "react";

// "Install app" support. The manifest (app/manifest.ts) makes the site installable; this store
// tracks whether this browser can install it right now, and how:
//   "prompt"    Chrome, Edge, Samsung Internet, Android: the browser's own install dialog
//   "ios"       iPhone/iPad: no install API, so we explain Share → Add to Home Screen
//   "mac-safari" Safari on macOS: File → Add to Dock
//   "installed" already running as the installed app
//   "unavailable" the browser can't install web apps (e.g. Firefox), or it's the server render
// No service worker is involved, and nothing is stored.

export type InstallState = "prompt" | "ios" | "mac-safari" | "installed" | "unavailable";

/** Chromium's install event (not in TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// Chromium fires `beforeinstallprompt` once, soon after load, and never again for that page view, so
// it's captured when this module loads rather than when a button mounts.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // keep the browser's mini-infobar away; installing is opt-in
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installedNow = true;
    deferredPrompt = null;
    notify();
  });
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

function getSnapshot(): InstallState {
  if (installedNow || isStandalone()) return "installed";
  if (deferredPrompt) return "prompt";
  const ua = navigator.userAgent;
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS reports a Mac
  if (/iPhone|iPad|iPod/.test(ua) || touchMac) return "ios";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR/.test(ua)) return "mac-safari";
  return "unavailable";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Opens the browser's install dialog (only in the "prompt" state). The prompt can be used once. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  deferredPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installedNow = true;
  notify();
  return outcome;
}

/** How (and whether) this browser can install Tallyhawk right now. "unavailable" on the server. */
export function useInstallApp(): InstallState {
  return useSyncExternalStore(subscribe, getSnapshot, () => "unavailable");
}
