import "@testing-library/jest-dom/vitest";
import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { nextNavigationMock, resetNavigation } from "./test/navigation";

// Every test file shares one controllable router (see test/navigation.ts).
vi.mock("next/navigation", () => nextNavigationMock);

// next/link needs a mounted App Router to handle clicks; a plain anchor keeps href assertions honest.
const NEXT_ONLY_LINK_PROPS = new Set(["prefetch", "replace", "scroll", "shallow", "passHref", "legacyBehavior", "onNavigate"]);
type LinkMockProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname: string } };
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: LinkMockProps) => {
    const anchorProps = Object.fromEntries(Object.entries(props).filter(([key]) => !NEXT_ONLY_LINK_PROPS.has(key)));
    return createElement("a", { href: typeof href === "string" ? href : href.pathname, ...anchorProps }, children);
  },
}));

// next/image validates remote hosts against next.config; tests only care about the rendered <img>.
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) =>
    createElement("img", { src, alt, width, height, ...rest }),
}));

// jsdom lacks matchMedia (ThemeContext) and ResizeObserver (recharts).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

beforeEach(() => {
  resetNavigation();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
