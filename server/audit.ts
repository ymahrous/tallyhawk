import "server-only";
import type { Executor } from "./db";
import { auditLog, type User } from "./db/schema";
import { clientIp } from "./http";
import { hashIdentifier } from "./rate-limit";

export interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  /** Human-readable target (an email, a subject line) kept even after the target is deleted. */
  targetLabel?: string;
  details?: Record<string, unknown>;
}

/** Records an admin write. Call it after the change succeeds, inside the same transaction when there is one. */
export async function audit(db: Executor, request: Request, actor: Pick<User, "id" | "username">, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorId: actor.id,
    actorUsername: actor.username,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    targetLabel: entry.targetLabel ?? null,
    details: entry.details ?? null,
    ipHash: hashIdentifier(clientIp(request)),
  });
}
