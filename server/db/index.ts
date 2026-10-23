import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

// One pool per server instance. In dev, Next re-evaluates modules on every edit, so the pool is
// parked on globalThis to avoid leaking connections across hot reloads.
const globalForDb = globalThis as unknown as { __tallyhawkDb?: Db };

/** Lazily connects on first use so `next build` never needs DATABASE_URL. */
export function getDb(): Db {
  if (globalForDb.__tallyhawkDb) return globalForDb.__tallyhawkDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString, max: Number(process.env.DATABASE_POOL_MAX ?? 5) });
  globalForDb.__tallyhawkDb = drizzle(pool, { schema });
  return globalForDb.__tallyhawkDb;
}

/** Test hook: swap in another drizzle instance (e.g. PGlite). Pass `undefined` to reset. */
export function setDb(db: Db | undefined) {
  globalForDb.__tallyhawkDb = db;
}

export { schema };
