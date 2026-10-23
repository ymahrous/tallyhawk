import "server-only";
import { after } from "next/server";

/**
 * Runs `task` after the response has been sent — this replaces the Celery/Redis worker. On Vercel
 * the invocation stays alive until the task settles (bounded by the route's `maxDuration`); on a
 * Node server it simply keeps running in-process. Failures are logged, never thrown to the client.
 */
export function runInBackground(name: string, task: () => Promise<unknown>): void {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(JSON.stringify({ level: "error", task: name, error: String(error) }));
    }
  });
}
