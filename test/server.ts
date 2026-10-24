import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { vi } from "vitest";
import { createSessionToken, hashPassword } from "@/server/auth";
import { setDb, type Db } from "@/server/db";
import * as schema from "@/server/db/schema";

// Harness for API route tests. A real (in-process, WASM) Postgres via PGlite with the production
// migration applied, so queries, constraints and upserts behave exactly as they do on Neon.
// Usage, at the top of a `// @vitest-environment node` test file:
//
//   vi.mock("@/server/background", async () => (await import("@/test/server")).backgroundMock);
//   let db: Db;
//   beforeAll(async () => (db = await createTestDb()));
//   beforeEach(() => resetTestDb(db));

const MIGRATIONS_DIR = new URL("../server/db/migrations/", import.meta.url);
const MIGRATIONS = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(new URL(f, MIGRATIONS_DIR), "utf8"));
const TABLES = [
  "extraction",
  "document",
  "vendor",
  "subscription",
  "usagerecord",
  "quickbooksconnection",
  "feedback",
  "contactmessage",
  "passwordresettoken",
  "auditlog",
  "stripeevent",
  "ratelimit",
  '"user"',
];

export async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  for (const sql of MIGRATIONS) await client.exec(sql);
  // Idempotent: every migration must survive re-running against an existing schema.
  for (const sql of MIGRATIONS) await client.exec(sql);
  const db = drizzle(client, { schema }) as unknown as Db;
  setDb(db);
  return db;
}

export async function resetTestDb(db: Db) {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} CASCADE`));
}

// --- background tasks (after()) ---------------------------------------------------------------

const pending: Promise<unknown>[] = [];

/** Drop-in for `@/server/background`: queues tasks so tests can await them with flushBackground(). */
export const backgroundMock = {
  runInBackground: (_name: string, task: () => Promise<unknown>) => {
    pending.push(task());
  },
};

export async function flushBackground() {
  while (pending.length) await pending.shift();
}

// --- fixtures ------------------------------------------------------------------------------------

interface UserFixture {
  username?: string;
  password?: string;
  plan?: string;
  baseCurrency?: string;
  role?: schema.AccountRole;
  status?: schema.AccountStatus;
}

/** A customer (or, with `role: "admin"`, an admin) plus a valid session token for them. */
export async function createUser(
  db: Db,
  { username = "ada@example.com", password = "Password1!", plan = "free", baseCurrency = "USD", role = "user", status = "active" }: UserFixture = {}
) {
  const [user] = await db
    .insert(schema.users)
    .values({ username, hashedPassword: await hashPassword(password), plan, baseCurrency, role, status })
    .returning();
  const token = await createSessionToken(user);
  return { user, token, password };
}

/** An admin account and an admin session token. */
export function createAdmin(db: Db, fixture: Omit<UserFixture, "role" | "plan" | "baseCurrency"> = {}) {
  return createUser(db, { username: "admin@tallyhawk.test", password: "Admin-pass1", ...fixture, role: "admin" });
}

interface DocFixture {
  ownerId: string;
  filename?: string;
  status?: string;
  createdAt?: Date;
  extraction?: Partial<typeof schema.extractions.$inferInsert> | null;
}

export async function createDocument(db: Db, { ownerId, filename = "receipt.pdf", status = "COMPLETED", createdAt, extraction = {} }: DocFixture) {
  const [doc] = await db
    .insert(schema.documents)
    .values({ ownerId, filename, s3Url: `https://bucket.test/${filename}`, status, ...(createdAt ? { createdAt } : {}) })
    .returning();
  let ext: typeof schema.extractions.$inferSelect | undefined;
  if (extraction) {
    [ext] = await db
      .insert(schema.extractions)
      .values({ documentId: doc.id, confidenceScore: 0.98, extractedData: {}, ...extraction })
      .returning();
  }
  return { doc, ext };
}

// --- calling route handlers ----------------------------------------------------------------------

type RouteHandler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

interface CallOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

/** Invokes a route handler the way Next does. `path` may include a query string. */
export async function call(handler: RouteHandler, method: string, path: string, options: CallOptions = {}) {
  const headers = new Headers(options.headers);
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  let body: BodyInit | undefined;
  if (options.body instanceof FormData || typeof options.body === "string") body = options.body;
  else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers.set("content-type", "application/json");
  }
  const request = new Request(`http://localhost:3000/api/v1${path}`, { method, headers, body });
  const response = await handler(request, { params: Promise.resolve(options.params ?? {}) });
  const text = await response.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // not JSON (e.g. CSV)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests assert on arbitrary response shapes
  return { status: response.status, headers: response.headers, text, json: json as any };
}

/** Stubs global fetch for outbound calls (exchange rates, QuickBooks, file downloads). */
export function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, init)
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}
