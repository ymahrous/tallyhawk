import { test as base, expect, type Page, type Route } from "@playwright/test";
import { E2E_API_URL } from "./constants";

// Stateful fake of the Tallyhawk backend for browser tests. Handlers receive the parsed request
// and return a reply; unmatched requests fail the test so a new endpoint can't go unmocked.

export interface ApiRequest {
  method: string;
  path: string;
  search: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

export interface ApiReply {
  status?: number;
  json?: unknown;
  body?: string;
  contentType?: string;
}

export type ApiHandler = ApiReply | ((request: ApiRequest) => ApiReply);
export type ApiRoutes = Record<string, ApiHandler>;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type, Accept",
};

export class MockApi {
  readonly requests: ApiRequest[] = [];
  readonly unhandled: string[] = [];
  private routes: ApiRoutes = {};

  constructor(private readonly page: Page) {}

  async install() {
    await this.page.route(`${E2E_API_URL}/**`, (route) => this.handle(route));
  }

  set(routes: ApiRoutes) {
    Object.assign(this.routes, routes);
  }

  calls(key: string) {
    const [method, path] = key.split(" ");
    return this.requests.filter((r) => r.method === method && r.path === path);
  }

  private async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    let body: unknown = null;
    const raw = request.postData();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
    const parsed: ApiRequest = {
      method,
      path: url.pathname,
      search: url.searchParams,
      headers: request.headers(),
      body,
    };
    this.requests.push(parsed);

    const handler =
      this.routes[`${method} ${url.pathname}${url.search}`] ??
      this.routes[`${method} ${url.pathname}`];
    if (!handler) {
      this.unhandled.push(`${method} ${url.pathname}${url.search}`);
      await route.fulfill({ status: 404, headers: CORS_HEADERS, json: { detail: "Not mocked" } });
      return;
    }

    const reply = typeof handler === "function" ? handler(parsed) : handler;
    await route.fulfill({
      status: reply.status ?? 200,
      headers: CORS_HEADERS,
      contentType: reply.contentType ?? "application/json",
      body: reply.json !== undefined ? JSON.stringify(reply.json) : (reply.body ?? ""),
    });
  }
}

/** Unsigned JWT in the shape the client decodes. */
export function makeToken(payload: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64").replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "ada@example.com", exp: now + 3600, iat: now, plan: "free", ...payload })}.sig`;
}

export function accountRoutes({
  plan = "free",
  used = 3,
  baseCurrency = "USD",
}: { plan?: "free" | "pro"; used?: number; baseCurrency?: string } = {}): ApiRoutes {
  return {
    "GET /billing/usage": {
      json: { plan, documents_processed: used, limit: plan === "pro" ? -1 : 10 },
    },
    "GET /billing/subscription": {
      json: {
        plan,
        status: "active",
        current_period_end: null,
        last_renewal_date: "2026-09-01T00:00:00Z",
      },
    },
    "GET /auth/settings": {
      json: {
        id: "u1",
        username: "ada@example.com",
        plan,
        base_currency: baseCurrency,
        created_at: "2026-01-01T00:00:00Z",
      },
    },
    "GET /quickbooks/status": { json: { connected: false } },
    "GET /stats/dashboard": {
      json: { processed: 0, synced: 0, month_spend: 0, base_currency: baseCurrency },
    },
    "GET /documents/": { json: [] },
  };
}

interface Fixtures {
  api: MockApi;
  /** Seed a signed-in session (once per tab, so a logout inside the test sticks). */
  signIn: (payload?: Record<string, unknown>) => Promise<void>;
}

export const test = base.extend<Fixtures & { seedConsent: boolean }>({
  seedConsent: [true, { option: true }],

  api: [
    async ({ page, seedConsent }, use) => {
      const api = new MockApi(page);
      await api.install();
      if (seedConsent) {
        // Keep the cookie banner out of the way unless a test is about the banner.
        await page.addInitScript(() => {
          if (!localStorage.getItem("tallyhawk_analytics_consent"))
            localStorage.setItem("tallyhawk_analytics_consent", "rejected");
        });
      }
      await use(api);
      expect(api.unhandled, "every backend request should be mocked").toEqual([]);
    },
    { auto: true },
  ],

  signIn: async ({ page }, use) => {
    await use(async (payload = {}) => {
      const token = makeToken(payload);
      await page.addInitScript((value) => {
        if (sessionStorage.getItem("e2e-seeded")) return;
        sessionStorage.setItem("e2e-seeded", "1");
        localStorage.setItem("token", value);
      }, token);
    });
  },
});

export { expect };
