import { vi } from "vitest";

/** The router every component gets from useRouter() in tests. Reset before each test. */
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

const state = {
  pathname: "/",
  searchParams: new URLSearchParams(),
};

export function setPathname(pathname: string) {
  state.pathname = pathname;
}

export function setSearchParams(params: Record<string, string>) {
  state.searchParams = new URLSearchParams(params);
}

export function resetNavigation() {
  Object.values(router).forEach((fn) => fn.mockReset());
  state.pathname = "/";
  state.searchParams = new URLSearchParams();
}

export const nextNavigationMock = {
  useRouter: () => router,
  usePathname: () => state.pathname,
  useSearchParams: () => state.searchParams,
  redirect: vi.fn(),
  notFound: vi.fn(),
};
