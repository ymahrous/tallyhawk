// Creates an admin account, or resets an existing admin's password. Use it once to bootstrap the
// first admin; after that, admins add each other from the dashboard (/admin/admins).
//
//   npm run admin:create -- admin@example.com              (prompts for the password)
//   ADMIN_PASSWORD='...' npm run admin:create -- admin@example.com
//
// Customers can't be turned into admins: admin and customer are separate account types.
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import bcrypt from "bcryptjs";
import pg from "pg";

const root = fileURLToPath(new URL("..", import.meta.url));
nextEnv.loadEnvConfig(root);

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Reads a line without echoing it to the terminal. */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) process.stdout.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

// Mirrors lib/validation.ts (validateEmail, validatePassword), which the API enforces too.
function passwordProblem(value) {
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (Buffer.byteLength(value, "utf8") > 72) return "Password must be at most 72 characters.";
  if (!/[A-Z]/.test(value)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(value)) return "Password must contain at least one number.";
  return null;
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail("Usage: npm run admin:create -- <email>");
if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set.");

const password = process.env.ADMIN_PASSWORD || (await promptHidden(`Password for ${email}: `));
const problem = passwordProblem(password);
if (problem) fail(problem);

const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(`SELECT id, role FROM "user" WHERE lower(username) = $1`, [email]);
  if (rows[0]?.role === "user") fail(`${email} is a customer account. Admins need their own email address.`);
  if (rows[0]) {
    await client.query(
      `UPDATE "user" SET hashed_password = $1, status = 'active', token_version = token_version + 1 WHERE id = $2`,
      [hash, rows[0].id]
    );
    console.log(`Reset the password of admin ${email} (and signed out its sessions).`);
  } else {
    await client.query(
      `INSERT INTO "user" (id, username, hashed_password, plan, base_currency, role, status) VALUES ($1, $2, $3, 'free', 'USD', 'admin', 'active')`,
      [randomUUID(), email, hash]
    );
    console.log(`Created admin ${email}. Sign in at /login.`);
  }
} finally {
  await client.end();
}
