import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CookieConsentBanner from "./CookieConsentBanner";
import AnalyticsGate from "./AnalyticsGate";
import { renderWithProviders } from "@/test/render";

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => <div data-testid="speed-insights" />,
}));

function renderConsent() {
  return renderWithProviders(
    <>
      <CookieConsentBanner />
      <AnalyticsGate />
    </>
  );
}

describe("cookie consent and analytics", () => {
  it("asks first and loads nothing until the visitor decides", () => {
    renderConsent();
    expect(screen.getByRole("dialog", { name: "Analytics consent" })).toBeInTheDocument();
    expect(screen.queryByTestId("vercel-analytics")).toBeNull();
    // No "Close" on first visit: a choice is required.
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("loads Vercel Analytics and Speed Insights only after Accept", async () => {
    renderConsent();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("vercel-analytics")).toBeInTheDocument();
    expect(screen.getByTestId("speed-insights")).toBeInTheDocument();
    expect(localStorage.getItem("tallyhawk_analytics_consent")).toBe("accepted");
  });

  it("never loads analytics after Reject", async () => {
    renderConsent();
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(screen.queryByTestId("vercel-analytics")).toBeNull();
    expect(localStorage.getItem("tallyhawk_analytics_consent")).toBe("rejected");
  });
});
