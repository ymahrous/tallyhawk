import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { ThemeProvider } from "@/app/providers/ThemeContext";
import { PlanProvider } from "@/app/providers/PlanContext";
import { SettingsProvider } from "@/app/providers/SettingsContext";
import { CookieConsentProvider } from "@/app/providers/CookieConsentContext";

interface ProviderOptions {
  theme?: "light" | "dark";
}

/** Renders inside the same provider stack as app/layout.tsx. */
export function renderWithProviders(
  ui: ReactElement,
  { theme = "light", ...options }: ProviderOptions & RenderOptions = {}
) {
  // The inline theme script normally sets this class before hydration; ThemeProvider reads it.
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);

  function Providers({ children }: { children: ReactNode }) {
    return (
      <CookieConsentProvider>
        <ThemeProvider>
          <PlanProvider>
            <SettingsProvider>{children}</SettingsProvider>
          </PlanProvider>
        </ThemeProvider>
      </CookieConsentProvider>
    );
  }

  return render(ui, { wrapper: Providers, ...options });
}
