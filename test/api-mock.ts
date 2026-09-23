import { vi } from "vitest";

// A fetch-level fake of the Tallyhawk backend. Tests exercise the real lib/api.ts client (auth
// headers, error mapping, 401 handling) instead of mocking it away, which is what makes the page
// tests integration tests.

export const API_BASE = "http://api.test";

export interface MockRequest {
  method: string;
  url: URL;
  path: string;
  headers: Headers;
  body: unknown;
}

export interface MockReply {
  status?: number;
  json?: unknown;
  body?: BodyInit | null;
  headers?: Record<string, string>;
}

export type RouteHandler = MockReply | ((request: MockRequest) => MockReply | Promise<MockReply>);

/** Keys are "METHOD /path" or "METHOD /path?query" (the query form wins when both match). */
export type Routes = Record<string, RouteHandler>;

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") return body ?? null;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export function mockApi(initialRoutes: Routes = {}) {
  const routes: Routes = { ...initialRoutes };
  const requests: MockRequest[] = [];
  const unhandled: string[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    );
    const method = (init.method ?? "GET").toUpperCase();
    const path = url.pathname;

    if (init.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");

    const request: MockRequest = {
      method,
      url,
      path,
      headers: new Headers(init.headers),
      body: parseBody(init.body as BodyInit),
    };
    requests.push(request);

    const handler = routes[`${method} ${path}${url.search}`] ?? routes[`${method} ${path}`];
    if (!handler) {
      unhandled.push(`${method} ${path}${url.search}`);
      return new Response(JSON.stringify({ detail: "Not mocked" }), { status: 404 });
    }

    const reply = typeof handler === "function" ? await handler(request) : handler;
    const status = reply.status ?? 200;
    const body =
      status === 204
        ? null
        : reply.json !== undefined
          ? JSON.stringify(reply.json)
          : (reply.body ?? null);
    return new Response(body, {
      status,
      headers: { "Content-Type": "application/json", ...reply.headers },
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    fetchMock,
    requests,
    unhandled,
    /** Add or replace routes mid-test (e.g. to change what the next poll returns). */
    set(more: Routes) {
      Object.assign(routes, more);
    },
    /** Requests matching "METHOD /path" (query string ignored). */
    callsTo(key: string) {
      const [method, path] = key.split(" ");
      return requests.filter((r) => r.method === method && r.path === path);
    },
  };
}

/** Backend responses the app's providers request on mount for a signed-in user. */
export function accountRoutes({
  plan = "free",
  used = 3,
  baseCurrency = "USD",
}: { plan?: "free" | "pro"; used?: number; baseCurrency?: string } = {}): Routes {
  return {
    "GET /billing/usage": {
      json: { plan, documents_processed: used, limit: plan === "pro" ? -1 : 10 },
    },
    "GET /billing/subscription": {
      json: {
        plan,
        status: "active",
        current_period_end: "2026-10-23T00:00:00Z",
        last_renewal_date: "2026-09-23T00:00:00Z",
      },
    },
    "GET /auth/settings": {
      json: {
        id: "user-1",
        username: "ada@example.com",
        plan,
        base_currency: baseCurrency,
        created_at: "2026-01-01T00:00:00Z",
      },
    },
  };
}
