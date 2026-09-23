import { describe, it, expect } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navbar from "./Navbar";
import { renderWithProviders } from "@/test/render";
import { accountRoutes, mockApi } from "@/test/api-mock";
import { router, setPathname } from "@/test/navigation";
import { signIn } from "@/test/auth";

const hrefs = (container: HTMLElement) =>
  within(container)
    .getAllByRole("link")
    .map((a) => a.getAttribute("href"));

describe("Navbar (signed out)", () => {
  it("links the logo home and exposes crawlable links, not click handlers", () => {
    renderWithProviders(<Navbar />);
    const nav = screen.getByRole("navigation", { name: "Main" });

    expect(screen.getByRole("link", { name: "Tallyhawk home" })).toHaveAttribute("href", "/");
    expect(hrefs(nav)).toEqual(
      expect.arrayContaining(["/#features", "/pricing", "/login", "/signup"])
    );
  });

  it("marks the current page", () => {
    setPathname("/pricing");
    renderWithProviders(<Navbar />);
    const pricingLinks = screen.getAllByRole("link", { name: "Pricing" });
    expect(pricingLinks[0]).toHaveAttribute("aria-current", "page");
  });

  it("toggles the theme", async () => {
    renderWithProviders(<Navbar />, { theme: "light" });
    await userEvent.click(screen.getAllByRole("button", { name: "Toggle theme" })[0]);
    expect(document.documentElement).toHaveClass("dark");
  });

  it("opens and closes the mobile menu, including with Escape", async () => {
    renderWithProviders(<Navbar />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const menu = document.getElementById("mobile-menu")!;
    expect(hrefs(menu)).toEqual(["/#features", "/pricing", "/login", "/signup"]);

    await userEvent.keyboard("{Escape}");
    expect(document.getElementById("mobile-menu")).toBeNull();
  });
});

describe("Navbar (signed in)", () => {
  it("shows the dashboard link and a user menu with every app page", async () => {
    signIn();
    mockApi(accountRoutes());
    renderWithProviders(<Navbar />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/app");
    await userEvent.click(screen.getByRole("button", { name: "User menu" }));

    const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
    expect(items.map((item) => item.getAttribute("href"))).toEqual([
      "/app",
      "/analytics",
      "/vendors",
      "/account",
      null,
    ]);
    expect(items.at(-1)).toHaveTextContent("Log out");
  });

  it("routes Analytics in the mobile menu to /analytics (regression: it pointed at /vendors)", async () => {
    signIn();
    mockApi(accountRoutes());
    renderWithProviders(<Navbar />);

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = document.getElementById("mobile-menu")!;
    expect(within(menu).getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "href",
      "/analytics"
    );
  });

  it("logs out: clears the token and returns home", async () => {
    signIn();
    mockApi(accountRoutes());
    renderWithProviders(<Navbar />);

    await userEvent.click(screen.getByRole("button", { name: "User menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(localStorage.getItem("token")).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/");
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
  });

  it("closes the user menu on an outside click", async () => {
    signIn();
    mockApi(accountRoutes());
    renderWithProviders(<Navbar />);

    await userEvent.click(screen.getByRole("button", { name: "User menu" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("hides the dashboard shortcut while already on the dashboard", () => {
    signIn();
    mockApi(accountRoutes());
    setPathname("/app");
    renderWithProviders(<Navbar />);
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
  });
});
