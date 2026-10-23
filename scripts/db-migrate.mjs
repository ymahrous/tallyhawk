// Applies server/db/migrations/*.sql in filename order against DATABASE_URL.
// Every migration is idempotent (IF NOT EXISTS), so re-running is harmless.
// Usage: DATABASE_URL=postgres://... npm run db:migrate   (or put DATABASE_URL in .env.local)
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";

const root = fileURLToPath(new URL("..", import.meta.url));
nextEnv.loadEnvConfig(root);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const dir = new URL("../server/db/migrations/", import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  for (const file of files) {
    await client.query(await readFile(new URL(file, dir), "utf8"));
    console.log(`applied ${file}`);
  }
} finally {
  await client.end();
}
