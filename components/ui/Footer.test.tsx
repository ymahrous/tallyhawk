import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Footer from "./Footer";
import CookieConsentBanner from "./CookieConsentBanner";
import { renderWithProviders } from "@/test/render";
import { PRIVATE_ROUTE_PREFIXES } from "@/lib/site";

describe("Footer", () => {
  it("only links to public pages", () => {
    renderWithProviders(<Footer />);
    const internal = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href")!)
      .filter((href) => href.startsWith("/"));

    expect(internal).toEqual(
      expect.arrayContaining(["/", "/pricing", "/terms", "/privacy", "/accessibility", "/#faq"])
    );
    for (const href of internal) {
      expect(
        PRIVATE_ROUTE_PREFIXES.some((prefix) => href === prefix || href.startsWith(`${prefix}/`))
      ).toBe(false);
    }
  });

  it("gives the icon-only GitHub link an accessible name and opens it safely", () => {
    renderWithProviders(<Footer />);
    const github = screen.getByRole("link", { name: "Tallyhawk on GitHub" });
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("uses real headings for each link group", () => {
    renderWithProviders(<Footer />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Product",
      "Capabilities",
      "Legal",
    ]);
  });

  it("reopens the cookie banner from Cookie Preferences", async () => {
    localStorage.setItem("tallyhawk_analytics_consent", "accepted");
    renderWithProviders(
      <>
        <Footer />
        <CookieConsentBanner />
      </>
    );
    expect(screen.queryByRole("dialog", { name: "Analytics consent" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Cookie Preferences" }));

    expect(screen.getByRole("dialog", { name: "Analytics consent" })).toBeInTheDocument();
  });
});
