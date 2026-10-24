"use client";

import { useId, useState } from "react";
import { useTheme } from "@/app/providers/ThemeContext";
import { promptInstall, useInstallApp } from "@/lib/useInstallApp";

const STEPS = {
  ios: ["Tap the Share button in the browser toolbar.", "Choose “Add to Home Screen”.", "Tap “Add”."],
  "mac-safari": ["In Safari's menu bar, choose File.", "Choose “Add to Dock”.", "Click “Add”."],
} as const;

/**
 * An opt-in "Install app" control. Renders nothing when the browser can't install Tallyhawk or it's
 * already installed. `className` styles the trigger so it fits where it's placed (footer link,
 * account-page button).
 */
export default function InstallAppButton({ className, label = "Install app" }: { className: string; label?: string }) {
  const isDark = useTheme().theme === "dark";
  const state = useInstallApp();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (state === "prompt") {
    return (
      <button type="button" className={className} onClick={() => promptInstall()}>
        {label}
      </button>
    );
  }
  if (state !== "ios" && state !== "mac-safari") return null;

  return (
    <div className="relative inline-block">
      <button type="button" className={className} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="How to install Tallyhawk"
          className={`mt-3 w-64 rounded-xl border p-4 text-left text-sm shadow-lg ${
            isDark ? "border-white/10 bg-gray-950 text-gray-200" : "border-gray-200 bg-white text-gray-700"
          }`}
        >
          <ol className="list-decimal space-y-1 pl-5">
            {STEPS[state].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className={`mt-2 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Tallyhawk then opens from your {state === "ios" ? "home screen" : "Dock"} like an app.
          </p>
        </div>
      )}
    </div>
  );
}
