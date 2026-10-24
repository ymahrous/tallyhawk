import { describe, expect, it } from "vitest";
import { RETENTION, period } from "./retention";
import { LIMITS } from "@/server/rate-limit";

describe("retention schedule", () => {
  it("keeps deletion-record identifiers past the usual ~120-day card-dispute window, and no longer than the audit log", () => {
    expect(RETENTION.deletionRecordIdentifiersDays).toBeGreaterThanOrEqual(120);
    expect(RETENTION.deletionRecordIdentifiersDays).toBeLessThanOrEqual(RETENTION.auditLogIdentifiersDays);
  });

  it("never deletes a rate-limit counter whose window is still open", () => {
    for (const { windowSeconds } of Object.values(LIMITS)) {
      expect(windowSeconds).toBeLessThanOrEqual(RETENTION.rateLimitHours * 3600);
    }
  });

  it("keeps Stripe event ids longer than Stripe retries (3 days)", () => {
    expect(RETENTION.stripeEventDays).toBeGreaterThan(3);
  });

  it("describes periods in words", () => {
    expect(period(1, "hour")).toBe("1 hour");
    expect(period(120, "day")).toBe("120 days");
    expect(period(60, "minute")).toBe("60 minutes");
  });
});
