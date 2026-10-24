import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstallAppButton from "./InstallAppButton";
import { renderWithProviders } from "@/test/render";

// useInstallApp keeps module state (an "installed" flag can't be undone within a page view), so each
// test gets a fresh copy of the modules.
async function load() {
  vi.resetModules();
  return {
    Button: (await import("./InstallAppButton")).default,
    Footer: (await import("@/components/ui/Footer")).default,
  };
}

afterEach(() => vi.restoreAllMocks());

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("InstallAppButton", () => {
  it("renders nothing where the browser can't install apps", () => {
    const { container } = render(<InstallAppButton className="btn" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the browser's install dialog when one is available", async () => {
    const { Button } = await load();
    renderWithProviders(<Button className="btn" />);
    const prompt = vi.fn(async () => {});
    act(() => {
      window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) }));
    });
    await userEvent.click(screen.getByRole("button", { name: "Install app" }));
    expect(prompt).toHaveBeenCalledOnce();
    // Accepted: nothing left to offer.
    expect(screen.queryByRole("button", { name: "Install app" })).toBeNull();
  });

  it("shows Add to Home Screen steps on iPhone", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    const { Button } = await load();
    renderWithProviders(<Button className="btn" label="Install Tallyhawk" />);
    const trigger = screen.getByRole("button", { name: "Install Tallyhawk" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    const steps = screen.getByRole("region", { name: "How to install Tallyhawk" });
    expect(steps).toHaveTextContent("Tap the Share button");
    expect(steps).toHaveTextContent("Add to Home Screen");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("appears in the footer only when installing is possible", async () => {
    const { Footer } = await load();
    renderWithProviders(<Footer />);
    const product = screen.getByRole("navigation", { name: "Product" });
    expect(product).not.toHaveTextContent("Install app");
    act(() => {
      window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome: "dismissed" }) }));
    });
    expect(screen.getByRole("navigation", { name: "Product" })).toHaveTextContent("Install app");
  });
});
