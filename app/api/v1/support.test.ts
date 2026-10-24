// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { contactMessages, feedback } from "@/server/db/schema";
import { call, createAdmin, createTestDb, createUser, resetTestDb } from "@/test/server";
import { POST as contact } from "./contact/route";
import { POST as submitFeedback } from "./feedback/route";

// The public support channels: the feedback widget (incl. bug reports) and the contact form.

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(() => resetTestDb(db));

const MESSAGE = { name: "Ada Lovelace", email: "Ada@Example.com", subject: "Invoice question", message: "How do I export last year?" };

describe("feedback", () => {
  it("accepts anonymous feedback", async () => {
    const res = await call(submitFeedback, "POST", "/feedback", { body: { type: "Bug", message: "Upload stuck" } });
    expect(res.json).toEqual({ status: "success" });
    expect((await db.select().from(feedback))[0]).toMatchObject({ type: "Bug", message: "Upload stuck", userId: null, status: "new" });
    expect((await call(submitFeedback, "POST", "/feedback", { body: { type: "Bug" } })).status).toBe(422);
  });

  it("links a signed-in customer's bug report to them, with the page it came from", async () => {
    const { user, token } = await createUser(db);
    await call(submitFeedback, "POST", "/feedback", { token, body: { type: "Bug", message: "Chart is blank", page: "/analytics" } });
    expect((await db.select().from(feedback))[0]).toMatchObject({ userId: user.id, page: "/analytics" });

    // A bad or admin token never blocks feedback; it's just not linked.
    const admin = await createAdmin(db);
    await call(submitFeedback, "POST", "/feedback", { token: admin.token, body: { type: "Other", message: "hi" } });
    await call(submitFeedback, "POST", "/feedback", { token: "garbage", body: { type: "Other", message: "hi" } });
    expect((await db.select().from(feedback)).filter((f) => f.userId === null)).toHaveLength(2);
  });

  it("stores the text as written (regression: the widget HTML-escaped it before sending)", async () => {
    await call(submitFeedback, "POST", "/feedback", { body: { type: "Suggestion", message: "  Support <3 & tabs  " } });
    expect((await db.select().from(feedback))[0].message).toBe("Support <3 & tabs");
  });

  it("bounds what it accepts", async () => {
    const tooLong = await call(submitFeedback, "POST", "/feedback", { body: { type: "Bug", message: "x".repeat(5001) } });
    expect(tooLong.status).toBe(422);
    expect((await call(submitFeedback, "POST", "/feedback", { body: { type: "Spam", message: "x" } })).status).toBe(422);
    expect((await call(submitFeedback, "POST", "/feedback", { body: { type: "Bug", message: "x", page: "https://evil.test" } })).status).toBe(422);
    expect((await call(submitFeedback, "POST", "/feedback", { body: { type: "Bug", message: "   " } })).status).toBe(422);
  });

  it("rate-limits each client", async () => {
    for (let i = 0; i < 10; i++) await call(submitFeedback, "POST", "/feedback", { body: { type: "Bug", message: `#${i}` } });
    expect((await call(submitFeedback, "POST", "/feedback", { body: { type: "Bug", message: "more" } })).status).toBe(429);
    expect(await db.select().from(feedback)).toHaveLength(10);
  });
});

describe("contact form", () => {
  it("stores a message for the admin inbox", async () => {
    const res = await call(contact, "POST", "/contact", { body: MESSAGE });
    expect(res).toMatchObject({ status: 201, json: { status: "success" } });
    expect((await db.select().from(contactMessages))[0]).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      subject: "Invoice question",
      status: "new",
      userId: null,
    });
  });

  it("links the message to a signed-in customer", async () => {
    const { user, token } = await createUser(db);
    await call(contact, "POST", "/contact", { token, body: MESSAGE });
    expect((await db.select().from(contactMessages))[0].userId).toBe(user.id);
  });

  it("validates every field, including single-line name and subject", async () => {
    const bad = await call(contact, "POST", "/contact", { body: { ...MESSAGE, email: "nope", message: "short" } });
    expect(bad.status).toBe(422);
    expect(bad.json.detail.map((d: { loc: string[] }) => d.loc[1]).sort()).toEqual(["email", "message"]);
    expect((await call(contact, "POST", "/contact", { body: { ...MESSAGE, subject: "Hi\r\nBcc: victim@test.com" } })).status).toBe(422);
    expect((await call(contact, "POST", "/contact", { body: { ...MESSAGE, name: "x".repeat(121) } })).status).toBe(422);
    expect(await db.select().from(contactMessages)).toEqual([]);
  });

  it("quietly drops submissions that fill the honeypot", async () => {
    const res = await call(contact, "POST", "/contact", { body: { ...MESSAGE, website: "http://spam.test" } });
    expect(res).toMatchObject({ status: 200, json: { status: "success" } });
    expect(await db.select().from(contactMessages)).toEqual([]);
  });

  it("rate-limits each client", async () => {
    for (let i = 0; i < 5; i++) expect((await call(contact, "POST", "/contact", { body: MESSAGE })).status).toBe(201);
    expect((await call(contact, "POST", "/contact", { body: MESSAGE })).status).toBe(429);
  });
});
