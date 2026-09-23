import { describe, it, expect, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ThemeProvider, useTheme, themeScript } from "./ThemeContext";
import { PlanProvider, usePlan } from "./PlanContext";
import { SettingsProvider, useSettings, useCurrencyChange } from "./SettingsContext";
import { CookieConsentProvider, useCookieConsent } from "./CookieConsentContext";
import { accountRoutes, mockApi } from "@/test/api-mock";
import { signIn } from "@/test/auth";

describe("ThemeProvider", () => {
  function ThemeProbe() {
    const { theme, toggleTheme } = useTheme();
    return <button onClick={toggleTheme}>theme:{theme}</button>;
  }

  it("adopts the class the inline script already applied", () => {
    document.documentElement.classList.add("light");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByRole("button")).toHaveTextContent("theme:light");
  });

  it("toggles, persists to localStorage and updates <html>", async () => {
    document.documentElement.classList.add("dark");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("theme:light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("follows theme changes made in another tab", () => {
    document.documentElement.classList.add("light");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: "dark" }));
    });

    expect(screen.getByRole("button")).toHaveTextContent("theme:dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("ships an inline script that applies the stored theme before paint", () => {
    localStorage.setItem("theme", "dark");
    new Function(themeScript)();
    expect(document.documentElement).toHaveClass("dark");
  });
});

describe("CookieConsentProvider", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CookieConsentProvider>{children}</CookieConsentProvider>
  );

  it("shows the banner until a choice is made, then persists it", () => {
    const { result } = renderHook(() => useCookieConsent(), { wrapper });
    expect(result.current.showBanner).toBe(true);

    act(() => result.current.accept());

    expect(result.current).toMatchObject({ consent: "accepted", showBanner: false });
    expect(localStorage.getItem("tallyhawk_analytics_consent")).toBe("accepted");
  });

  it("restores a stored choice and can be reopened and dismissed", () => {
    localStorage.setItem("tallyhawk_analytics_consent", "rejected");
    const { result } = renderHook(() => useCookieConsent(), { wrapper });
    expect(result.current).toMatchObject({ consent: "rejected", showBanner: false });

    act(() => result.current.reopen());
    expect(result.current.showBanner).toBe(true);

    act(() => result.current.dismiss());
    expect(result.current.showBanner).toBe(false);
    expect(result.current.consent).toBe("rejected");
  });
});

describe("PlanProvider", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PlanProvider>{children}</PlanProvider>
  );

  it("is a signed-out free plan without a token and makes no requests", async () => {
    const server = mockApi();
    const { result } = renderHook(() => usePlan(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ plan: null, limit: 10 });
    expect(server.requests).toHaveLength(0);
  });

  it("seeds the plan from the JWT before the backend answers, then reconciles", async () => {
    signIn({ plan: "pro" });
    mockApi(accountRoutes({ plan: "pro", used: 42 }));

    const { result } = renderHook(() => usePlan(), { wrapper });
    expect(result.current).toMatchObject({ plan: "pro", limit: -1 });

    await waitFor(() => expect(result.current.documentsProcessed).toBe(42));
    expect(result.current.lastRenewalDate).toBe("2026-09-23T00:00:00Z");
    expect(result.current.currentPeriodEnd).toBe("2026-10-23T00:00:00Z");
  });

  it("falls back to the JWT plan when the usage endpoint fails", async () => {
    signIn({ plan: "pro" });
    mockApi({ "GET /billing/usage": { status: 500 } });

    const { result } = renderHook(() => usePlan(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ plan: "pro", limit: -1 });
  });

  it("resets when the token is removed in the same tab", async () => {
    signIn({ plan: "free" });
    mockApi(accountRoutes({ used: 7 }));
    const { result } = renderHook(() => usePlan(), { wrapper });
    await waitFor(() => expect(result.current.documentsProcessed).toBe(7));

    act(() => {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("storage"));
    });

    expect(result.current).toMatchObject({ plan: null, documentsProcessed: 0, limit: 10 });
  });
});

describe("SettingsProvider", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  );

  it("seeds the base currency from the local cache and reconciles with the backend", async () => {
    localStorage.setItem("tallyhawk_base_currency", "EUR");
    signIn();
    mockApi(accountRoutes({ baseCurrency: "GBP" }));

    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.baseCurrency).toBe("EUR");

    await waitFor(() => expect(result.current.baseCurrency).toBe("GBP"));
    expect(localStorage.getItem("tallyhawk_base_currency")).toBe("GBP");
  });

  it("updates optimistically and announces the change", async () => {
    signIn();
    mockApi({ ...accountRoutes(), "PATCH /auth/settings": { json: {} } });
    const listener = vi.fn();
    window.addEventListener("tallyhawk:currency-changed", listener);

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.updateBaseCurrency("JPY"));

    window.removeEventListener("tallyhawk:currency-changed", listener);
    expect(result.current.baseCurrency).toBe("JPY");
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ currency: "JPY" });
  });

  it("reverts and rethrows when the update fails", async () => {
    signIn();
    mockApi({
      ...accountRoutes({ baseCurrency: "USD" }),
      "PATCH /auth/settings": { status: 500, json: { detail: "Nope" } },
    });

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.updateBaseCurrency("CAD")).rejects.toThrow("Nope");
    });
    expect(result.current.baseCurrency).toBe("USD");
    expect(localStorage.getItem("tallyhawk_base_currency")).toBe("USD");
  });

  it("clears the cached currency on logout", async () => {
    signIn();
    mockApi(accountRoutes({ baseCurrency: "EUR" }));
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.baseCurrency).toBe("EUR"));

    act(() => {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("storage"));
    });

    expect(result.current.baseCurrency).toBe("USD");
    expect(localStorage.getItem("tallyhawk_base_currency")).toBeNull();
  });

  it("useCurrencyChange re-renders consumers on the custom event", () => {
    const { result } = renderHook(() => useCurrencyChange(), { wrapper });
    expect(result.current).toBe("USD");
    act(() => {
      window.dispatchEvent(
        new CustomEvent("tallyhawk:currency-changed", { detail: { currency: "USD" } })
      );
    });
    expect(result.current).toBe("USD");
  });
});
