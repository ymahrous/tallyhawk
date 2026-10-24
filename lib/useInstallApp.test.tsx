import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";

// The store keeps module state for the page's lifetime (as the browser does), so every test loads
// a fresh copy.
let promptInstall: typeof import("./useInstallApp").promptInstall;
let useInstallApp: typeof import("./useInstallApp").useInstallApp;
beforeEach(async () => {
  vi.resetModules();
  ({ promptInstall, useInstallApp } = await import("./useInstallApp"));
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { maxTouchPoints?: number }).maxTouchPoints;
});

/** A stand-in for Chromium's beforeinstallprompt event. */
function fireInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

function setUserAgent(ua: string, maxTouchPoints = 0) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  // jsdom's navigator has no maxTouchPoints at all.
  Object.defineProperty(navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
}

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

describe("useInstallApp", () => {
  it("is unavailable until the browser offers an install, then prompts once and reports the result", async () => {
    setUserAgent(MAC_CHROME);
    const { result } = renderHook(() => useInstallApp());
    expect(result.current).toBe("unavailable");
    expect(await promptInstall()).toBe("unavailable");

    const event = fireInstallPrompt("dismissed");
    expect(event.defaultPrevented).toBe(true); // no browser mini-infobar: installing is opt-in
    expect(result.current).toBe("prompt");

    let outcome: string | undefined;
    await act(async () => {
      outcome = await promptInstall();
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(outcome).toBe("dismissed");
    expect(result.current).toBe("unavailable"); // a prompt can only be used once
  });

  it("explains Add to Home Screen on iPhone and iPad, and Add to Dock in Safari for Mac", () => {
    setUserAgent(IPHONE);
    expect(renderHook(() => useInstallApp()).result.current).toBe("ios");
    setUserAgent(MAC_SAFARI, 5); // iPadOS reports a touch-screen Mac
    expect(renderHook(() => useInstallApp()).result.current).toBe("ios");
    setUserAgent(MAC_SAFARI, 0);
    expect(renderHook(() => useInstallApp()).result.current).toBe("mac-safari");
  });

  it("knows when it's already running as the installed app", () => {
    setUserAgent(IPHONE);
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({ matches: query === "(display-mode: standalone)" }) as MediaQueryList);
    expect(renderHook(() => useInstallApp()).result.current).toBe("installed");
  });

  it("marks the app installed once the browser confirms it", () => {
    setUserAgent(MAC_CHROME);
    const { result } = renderHook(() => useInstallApp());
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current).toBe("installed");
  });

  it("offers nothing in the server render", () => {
    function Probe() {
      return <span>{useInstallApp()}</span>;
    }
    expect(renderToString(<Probe />)).toContain("unavailable");
  });
});
