/**
 * Phase 9D security-fix tests for the server actions.
 *
 * next/headers, next/navigation and next/cache are mocked (the actions run
 * outside a real request here); Prisma runs against portfolio_test, so the
 * DB behaviour — sessions, audit rows, unique-constraint races — is real.
 */
import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  headers: async () => state.headers,
  cookies: async () => ({
    get: (name: string) => {
      const value = state.cookies.get(name);
      return value === undefined ? undefined : { value };
    },
    set: (name: string, value: string) => {
      state.cookies.set(name, value);
    },
    delete: (name: string) => {
      state.cookies.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

import { prisma } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, getSessionUser, hashPassword } from "@/server/auth";
import { changePasswordAction, loginAction, setupAction } from "@/server/actions/auth";
import { uploadMediaAction } from "@/server/actions/media";
import { resetDatabase } from "./helpers/db";

let counter = 0;
function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Date.now()}@test.local`;
}
function uniqueIp(): string {
  counter += 1;
  return `203.0.113.${100 + (counter % 100)}`;
}

function setHeaders(values: Record<string, string>): void {
  state.headers = new Headers(values);
}

function loginForm(email: string, password: string, next?: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  if (next !== undefined) fd.set("next", next);
  return fd;
}

function setupForm(email: string, token?: string): FormData {
  const fd = new FormData();
  fd.set("name", "First Admin");
  fd.set("email", email);
  fd.set("password", "SetupPassw0rd1");
  fd.set("confirmPassword", "SetupPassw0rd1");
  if (token !== undefined) fd.set("setupToken", token);
  return fd;
}

function changePasswordForm(currentPassword: string): FormData {
  const fd = new FormData();
  fd.set("currentPassword", currentPassword);
  fd.set("newPassword", "NewPassw0rd123");
  fd.set("confirmPassword", "NewPassw0rd123");
  return fd;
}

async function makeUser(email: string, password = "TestPassw0rd1") {
  return prisma.user.create({
    data: { email, name: "Test User", passwordHash: await hashPassword(password), role: "ADMIN" },
  });
}

async function redirectTarget(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const match = /^NEXT_REDIRECT:(.+)$/.exec(message);
    if (match) return match[1];
    throw error;
  }
  throw new Error("expected a redirect but the action returned normally");
}

beforeEach(async () => {
  await resetDatabase();
  state.cookies.clear();
  setHeaders({ host: "localhost:3000" });
  delete process.env.SETUP_TOKEN;
  delete process.env.TRUSTED_PROXY_HOPS;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Phase 9D #2 login timing oracle", () => {
  it("unknown emails take as long as a real password check (dummy bcrypt compare)", async () => {
    const email = uniqueEmail("known");
    await makeUser(email);
    const ip = uniqueIp();
    setHeaders({ host: "localhost:3000", "x-forwarded-for": ip });

    const unknownStart = Date.now();
    const unknown = await loginAction(
      { ok: false, message: "" },
      loginForm(uniqueEmail("ghost"), "Whatever123"),
    );
    const unknownMs = Date.now() - unknownStart;
    expect(unknown).toEqual({ ok: false, message: "Email or password is incorrect." });
    expect(unknownMs).toBeGreaterThan(50);

    const knownStart = Date.now();
    const known = await loginAction({ ok: false, message: "" }, loginForm(email, "WrongPass123"));
    const knownMs = Date.now() - knownStart;
    expect(known).toEqual({ ok: false, message: "Email or password is incorrect." });
    expect(knownMs).toBeGreaterThan(50);
  });
});

describe("Phase 9D #3 login next redirect", () => {
  it("uses safeInternalPath: internal paths pass, external and protocol-relative fall back", async () => {
    const email = uniqueEmail("redirect");
    await makeUser(email);
    setHeaders({ host: "localhost:3000", "x-forwarded-for": uniqueIp() });

    expect(
      await redirectTarget(loginAction({ ok: false, message: "" }, loginForm(email, "TestPassw0rd1", "/admin/projects"))),
    ).toBe("/admin/projects");
    expect(
      await redirectTarget(loginAction({ ok: false, message: "" }, loginForm(email, "TestPassw0rd1", "/vi"))),
    ).toBe("/vi");
    expect(
      await redirectTarget(
        loginAction({ ok: false, message: "" }, loginForm(email, "TestPassw0rd1", "https://evil.example")),
      ),
    ).toBe("/admin");
    expect(
      await redirectTarget(loginAction({ ok: false, message: "" }, loginForm(email, "TestPassw0rd1", "//evil.example"))),
    ).toBe("/admin");
  });
});

describe("Phase 9D #4 case-insensitive login rate-limit bucket", () => {
  it("mixed-case spellings of one email share a single bucket", async () => {
    const email = uniqueEmail("case");
    await makeUser(email);
    const ip = uniqueIp();
    setHeaders({ host: "localhost:3000", "x-forwarded-for": ip });

    const variants = [email, email.toUpperCase(), email.toLowerCase(), email.toUpperCase(), email, email.toUpperCase()];
    for (const variant of variants) {
      const result = await loginAction({ ok: false, message: "" }, loginForm(variant, "WrongPass123"));
      expect(result).toEqual({ ok: false, message: "Email or password is incorrect." });
    }
    // 6 failed attempts across cases exhaust the per-account bucket (limit 6).
    const blocked = await loginAction({ ok: false, message: "" }, loginForm(email.toUpperCase(), "WrongPass123"));
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toMatch(/Too many attempts/);
  });
});

describe("Phase 9D #7 setup and change-password rate limiting", () => {
  it("throttles setup attempts per IP", async () => {
    const previous = process.env.SETUP_TOKEN;
    process.env.SETUP_TOKEN = "correct-token";
    try {
      setHeaders({ host: "localhost:3000", "x-forwarded-for": uniqueIp() });
      for (let i = 0; i < 10; i++) {
        const result = await setupAction({ ok: false, message: "" }, setupForm(uniqueEmail("setup"), "wrong-token"));
        expect(result).toEqual({ ok: false, message: "Setup token is incorrect." });
      }
      const blocked = await setupAction({ ok: false, message: "" }, setupForm(uniqueEmail("setup"), "wrong-token"));
      expect(blocked).toEqual({ ok: false, message: "Too many setup attempts. Try again later." });
    } finally {
      if (previous === undefined) delete process.env.SETUP_TOKEN;
      else process.env.SETUP_TOKEN = previous;
    }
  });

  it("throttles change-password attempts per authenticated user", async () => {
    const user = await makeUser(uniqueEmail("changepw"));
    await createSession(user.id);
    for (let i = 0; i < 5; i++) {
      const result = await changePasswordAction({ ok: false, message: "" }, changePasswordForm("WrongCurrent1"));
      expect(result.ok).toBe(false);
      expect(result.message).toBe("Current password is incorrect.");
    }
    const blocked = await changePasswordAction({ ok: false, message: "" }, changePasswordForm("WrongCurrent1"));
    expect(blocked).toEqual({ ok: false, message: "Too many attempts. Try again later." });
  });
});

describe("Phase 9D #8 upload throttle on the Server Action", () => {
  it("blocks the 61st upload in an hour, matching POST /api/admin/media", async () => {
    const user = await makeUser(uniqueEmail("uploader"));
    await createSession(user.id);
    for (let i = 0; i < 60; i++) {
      expect(rateLimit(`media:${user.id}`, 60, 60 * 60 * 1000).ok).toBe(true);
    }
    const fd = new FormData();
    fd.set("files", new File(["x"], "test.png", { type: "image/png" }));
    const result = await uploadMediaAction({ ok: false, message: "" }, fd);
    expect(result).toEqual({ ok: false, message: "Too many uploads. Try again later." });
  });

  it("lets an unthrottled user through to validation", async () => {
    const user = await makeUser(uniqueEmail("uploader2"));
    await createSession(user.id);
    const result = await uploadMediaAction({ ok: false, message: "" }, new FormData());
    expect(result).toEqual({ ok: false, message: "Choose at least one image." });
  });
});

describe("Phase 9D #9 setup TOCTOU race", () => {
  it("two concurrent first-setup requests create exactly one SUPER_ADMIN", async () => {
    const email = uniqueEmail("race");
    setHeaders({ host: "localhost:3000", "x-forwarded-for": uniqueIp() });
    const outcomes = await Promise.allSettled([
      setupAction({ ok: false, message: "" }, setupForm(email)),
      setupAction({ ok: false, message: "" }, setupForm(email)),
    ]);
    const redirects = outcomes.filter(
      (o) => o.status === "rejected" && /^NEXT_REDIRECT:\/admin$/.test((o.reason as Error).message ?? ""),
    );
    const alreadyExists = outcomes.filter(
      (o) => o.status === "fulfilled" && o.value.message.includes("already exists"),
    );
    expect(redirects).toHaveLength(1);
    expect(alreadyExists).toHaveLength(1);
    expect(await prisma.user.count()).toBe(1);
    const created = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(created.role).toBe("SUPER_ADMIN");
  });
});

describe("Phase 9D #10 failed-login and failed-setup audit logging", () => {
  it("logs a failed login with email and IP but never the password", async () => {
    const email = uniqueEmail("audit-login");
    await makeUser(email);
    setHeaders({ host: "localhost:3000", "x-forwarded-for": uniqueIp() });
    await loginAction({ ok: false, message: "" }, loginForm(email, "WrongPass123"));
    const rows = await prisma.activityLog.findMany({ where: { action: "login_failed" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toContain(email);
    expect(rows[0].summary).not.toContain("WrongPass123");
    expect(rows[0].entityType).toBe("session");
  });

  it("logs a failed setup-token attempt without the provided token", async () => {
    const previous = process.env.SETUP_TOKEN;
    process.env.SETUP_TOKEN = "correct-token";
    try {
      setHeaders({ host: "localhost:3000", "x-forwarded-for": uniqueIp() });
      const result = await setupAction(
        { ok: false, message: "" },
        setupForm(uniqueEmail("audit-setup"), "wrong-token-value-xyz"),
      );
      expect(result).toEqual({ ok: false, message: "Setup token is incorrect." });
      const rows = await prisma.activityLog.findMany({ where: { action: "setup_failed" } });
      expect(rows).toHaveLength(1);
      expect(rows[0].summary).not.toContain("wrong-token-value-xyz");
      expect(rows[0].summary).toContain("invalid token");
    } finally {
      if (previous === undefined) delete process.env.SETUP_TOKEN;
      else process.env.SETUP_TOKEN = previous;
    }
  });
});

describe("Phase 9D #11 session lifecycle on login", () => {
  it("revokes pre-existing sessions and the new session works", async () => {
    const email = uniqueEmail("revoke");
    const user = await makeUser(email);
    const oldHashes = ["old-token-1", "old-token-2"].map((token) =>
      createHash("sha256").update(token).digest("hex"),
    );
    for (const tokenHash of oldHashes) {
      await prisma.session.create({
        data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) },
      });
    }
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);

    setHeaders({ host: "localhost:3000", "x-forwarded-for": uniqueIp() });
    expect(
      await redirectTarget(loginAction({ ok: false, message: "" }, loginForm(email, "TestPassw0rd1"))),
    ).toBe("/admin");

    const remaining = await prisma.session.findMany({ where: { userId: user.id } });
    expect(remaining).toHaveLength(1);
    expect(oldHashes).not.toContain(remaining[0].tokenHash);
    const cookieToken = state.cookies.get("ps_session");
    expect(cookieToken).toBeTruthy();
    expect(remaining[0].tokenHash).toBe(createHash("sha256").update(cookieToken as string).digest("hex"));
    expect((await getSessionUser())?.email).toBe(email);
  });
});

describe("Phase 9D #12 session IP from trusted hops", () => {
  it("records the proxy-appended address, not the spoofable left-most XFF entry", async () => {
    const user = await makeUser(uniqueEmail("session-ip"));
    setHeaders({ host: "localhost:3000", "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    await createSession(user.id);
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.ip).toBe("10.0.0.1");
  });

  it("records no IP when no proxy is trusted", async () => {
    const previous = process.env.TRUSTED_PROXY_HOPS;
    process.env.TRUSTED_PROXY_HOPS = "0";
    try {
      const user = await makeUser(uniqueEmail("session-ip0"));
      setHeaders({ host: "localhost:3000", "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
      await createSession(user.id);
      const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
      expect(session.ip).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.TRUSTED_PROXY_HOPS;
      else process.env.TRUSTED_PROXY_HOPS = previous;
    }
  });
});
