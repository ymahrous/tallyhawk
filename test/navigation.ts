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
  params: {} as Record<string, string>,
};

export function setPathname(pathname: string) {
  state.pathname = pathname;
}

export function setSearchParams(params: Record<string, string>) {
  state.searchParams = new URLSearchParams(params);
}

/** Dynamic route segments returned by useParams(), e.g. `{ userId: "u1" }`. */
export function setParams(params: Record<string, string>) {
  state.params = params;
}

export function resetNavigation() {
  Object.values(router).forEach((fn) => fn.mockReset());
  state.pathname = "/";
  state.searchParams = new URLSearchParams();
  state.params = {};
}

export const nextNavigationMock = {
  useRouter: () => router,
  usePathname: () => state.pathname,
  useSearchParams: () => state.searchParams,
  useParams: () => state.params,
  redirect: vi.fn(),
  notFound: vi.fn(),
};
