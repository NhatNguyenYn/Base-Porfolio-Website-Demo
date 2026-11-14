// Phase 11 — integration API tests (Worker B, D7).
//
// The REAL route handler (POST /api/integrations/schedules/import) is
// invoked with `next/headers` mocked per file (same pattern as
// tests/booking-flow.test.ts). The mock returns a fresh X-Forwarded-For
// identity per call so the unauthenticated rate limit never bleeds between
// tests — except when a test pins `ipState.fixed` to exercise that limit.
// Authenticated requests are limited per connection, so each test's fresh
// connection gets a fresh bucket.
//
// DB-backed integration tests against `portfolio_test` only.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ipState = vi.hoisted(() => ({ fixed: null as string | null, counter: 400 }));
vi.mock("next/headers", () => ({
  headers: async () =>
    ({
      get: (name: string) => {
        if (name.toLowerCase() === "x-forwarded-for") {
          if (ipState.fixed) return ipState.fixed;
          ipState.counter += 1;
          return `203.0.113.${ipState.counter}`;
        }
        return null;
      },
    }) as unknown as Headers,
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

import { createHash } from "node:crypto";

import { POST as importSchedules } from "@/app/api/integrations/schedules/import/route";
import { IMPORT_API_LIMIT, IMPORT_AUTH_LIMIT } from "@/lib/schedule-import-limits";
import { prisma } from "@/server/db";
import {
  createIntegrationConnection,
  hashIntegrationToken,
  rotateIntegrationConnection,
  revokeIntegrationConnection,
} from "@/server/schedule-import/connections";
import {
  makeTestConnection,
  uid,
  wipeScheduleImportTables,
} from "./helpers/phase11";

type ApiResult = { status: number; json: Record<string, any> };

const URL = "http://localhost:3000/api/integrations/schedules/import";

async function postRaw(
  rawBody: string,
  opts: { token?: string; authorization?: string } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.authorization !== undefined) headers.authorization = opts.authorization;
  else if (opts.token !== undefined) headers.authorization = `Bearer ${opts.token}`;
  const res = await importSchedules(
    new Request(URL, { method: "POST", headers, body: rawBody }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}

async function postJson(body: unknown, opts: { token?: string; authorization?: string } = {}): Promise<ApiResult> {
  return postRaw(JSON.stringify(body), opts);
}

function validEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "schedule_import",
    version: "1.0",
    source: "external_agent",
    generatedAt: "2026-11-14T10:30:00+07:00",
    schedules: [
      {
        id: `EXT-${uid()}`,
        title: "Customer Consultation",
        date: "2026-11-20",
        start: "09:00",
        end: "10:00",
        description: "Customer consultation",
        status: "confirmed",
        location: "Room A",
        note: "",
      },
    ],
    ...overrides,
  };
}

function scheduleWith(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: `EXT-${uid()}`,
    title: "Lịch kiểm thử",
    date: "2026-11-20",
    start: "09:00",
    end: "10:00",
    ...overrides,
  };
}

let actorUserId: string;

beforeAll(async () => {
  const actor = await prisma.user.create({
    data: {
      email: `api-actor-${uid()}@test.local`,
      name: "API Test Actor",
      passwordHash: "not-a-real-hash",
      role: "SUPER_ADMIN",
    },
  });
  actorUserId = actor.id;
});

beforeEach(async () => {
  ipState.fixed = null;
  await wipeScheduleImportTables();
  // Phase 11 audit rows are per-test assertions (e.g. preview must write
  // no apply audit), so they are wiped with the tables above.
  await prisma.activityLog.deleteMany({
    where: {
      action: {
        in: [
          "schedule_import.apply",
          "integration_connection.create",
          "integration_connection.rotate",
          "integration_connection.revoke",
        ],
      },
    },
  });
});

afterAll(async () => {
  await prisma.activityLog.deleteMany({ where: { userId: actorUserId } });
  await prisma.user.deleteMany({ where: { id: actorUserId } });
  await prisma.$disconnect();
});

describe("integration connections", () => {
  it("creates a connection: imp_ + 32 hex chars, only the SHA-256 is stored", async () => {
    const { connection, plainToken } = await createIntegrationConnection(`conn-${uid()}`, actorUserId);
    expect(plainToken).toMatch(/^imp_[0-9a-f]{32}$/);
    expect(connection.name).toContain("conn-");
    expect(connection.isActive).toBe(true);

    const stored = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } });
    expect(stored.tokenHash).toBe(createHash("sha256").update(plainToken).digest("hex"));
    expect(stored.tokenHash).not.toContain(plainToken);
    expect(hashIntegrationToken(plainToken)).toBe(stored.tokenHash);

    const audit = await prisma.activityLog.findFirst({
      where: { action: "integration_connection.create", entityId: connection.id },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(actorUserId);
    expect(JSON.stringify(audit)).not.toContain(plainToken);
  });

  it("rejects an empty connection name", async () => {
    await expect(createIntegrationConnection("   ", actorUserId)).rejects.toThrow("name is required");
  });

  it("rotates: the new token works and the old token stops working immediately", async () => {
    const { connection, plainToken: oldToken } = await createIntegrationConnection(`conn-${uid()}`, actorUserId);
    const { plainToken: newToken } = await rotateIntegrationConnection(connection.id, actorUserId);
    expect(newToken).toMatch(/^imp_[0-9a-f]{32}$/);
    expect(newToken).not.toBe(oldToken);

    const stored = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } });
    expect(stored.tokenHash).toBe(hashIntegrationToken(newToken));

    const oldCall = await postJson(validEnvelope(), { token: oldToken });
    expect(oldCall.status).toBe(401);
    expect(oldCall.json.error.code).toBe("UNAUTHORIZED");

    const newCall = await postJson(validEnvelope(), { token: newToken });
    expect(newCall.status).toBe(200);
    expect(newCall.json.success).toBe(true);

    const audit = await prisma.activityLog.findFirst({
      where: { action: "integration_connection.rotate", entityId: connection.id },
    });
    expect(audit).not.toBeNull();
  });

  it("revokes: the token is answered 403 and the connection's schedules are kept", async () => {
    const { connection, plainToken } = await createIntegrationConnection(`conn-${uid()}`, actorUserId);
    const applied = await postJson(validEnvelope(), { token: plainToken });
    expect(applied.status).toBe(200);
    const scheduleId = (applied.json.data.summary.items as { externalId: string }[])[0].externalId;

    await revokeIntegrationConnection(connection.id, actorUserId);
    const stored = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } });
    expect(stored.isActive).toBe(false);

    const revoked = await postJson(validEnvelope(), { token: plainToken });
    expect(revoked.status).toBe(403);
    expect(revoked.json.error.code).toBe("FORBIDDEN");
    // History is kept, never deleted by revocation.
    expect(await prisma.importedSchedule.count({ where: { connectionId: connection.id } })).toBe(1);
    expect(
      (await prisma.importedSchedule.findFirst({ where: { externalId: scheduleId } }))?.connectionId,
    ).toBe(connection.id);

    const audit = await prisma.activityLog.findFirst({
      where: { action: "integration_connection.revoke", entityId: connection.id },
    });
    expect(audit).not.toBeNull();
  });

  it("rotate/revoke of an unknown connection throws", async () => {
    await expect(rotateIntegrationConnection("nonexistent-id", actorUserId)).rejects.toThrow("not found");
    await expect(revokeIntegrationConnection("nonexistent-id", actorUserId)).rejects.toThrow("not found");
  });
});

describe("POST /api/integrations/schedules/import — auth", () => {
  it("missing token → 401 UNAUTHORIZED and nothing is written", async () => {
    const before = await prisma.importedSchedule.count();
    const { status, json } = await postJson(validEnvelope());
    expect(status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(await prisma.importedSchedule.count()).toBe(before);
    expect(await prisma.scheduleImport.count()).toBe(0);
  });

  it("malformed Authorization header → 401", async () => {
    for (const authorization of ["Bearer", "Basic abc123", "imp_0123456789abcdef0123456789abcdef"]) {
      const { status, json } = await postJson(validEnvelope(), { authorization });
      expect(status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("unknown but well-formed token → 401", async () => {
    const { status, json } = await postJson(validEnvelope(), { token: `imp_${"ab".repeat(16)}` });
    expect(status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("successful auth updates lastUsedAt", async () => {
    const { connection, plainToken } = await makeTestConnection();
    const before = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } });
    expect(before.lastUsedAt).toBeNull();
    const { status } = await postJson(validEnvelope(), { token: plainToken });
    expect(status).toBe(200);
    const after = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } });
    expect(after.lastUsedAt).not.toBeNull();
  });
});

describe("POST /api/integrations/schedules/import — validation", () => {
  it("malformed JSON → 400 INVALID_JSON", async () => {
    const { plainToken } = await makeTestConnection();
    const { status, json } = await postRaw("{not json", { token: plainToken });
    expect(status).toBe(400);
    expect(json.error.code).toBe("INVALID_JSON");
    expect(await prisma.scheduleImport.count()).toBe(0);
  });

  it("non-object JSON → 400 INVALID_JSON", async () => {
    const { plainToken } = await makeTestConnection();
    const { status, json } = await postRaw("[1, 2, 3]", { token: plainToken });
    expect(status).toBe(400);
    expect(json.error.code).toBe("INVALID_JSON");
  });

  it("missing title → 400 VALIDATION_FAILED with field errors", async () => {
    const { plainToken } = await makeTestConnection();
    const body = validEnvelope({
      schedules: [scheduleWith({ title: undefined })],
    });
    delete (body.schedules as Record<string, unknown>[])[0].title;
    const { status, json } = await postJson(body, { token: plainToken });
    expect(status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_FAILED");
    expect(json.error.details.fieldErrors).toBeDefined();
    expect(await prisma.importedSchedule.count()).toBe(0);
  });

  it("wrong type/version → 400 VALIDATION_FAILED", async () => {
    const { plainToken } = await makeTestConnection();
    const wrongType = await postJson(validEnvelope({ type: "other" }), { token: plainToken });
    expect(wrongType.status).toBe(400);
    expect(wrongType.json.error.code).toBe("VALIDATION_FAILED");
    const wrongVersion = await postJson(validEnvelope({ version: "2.0" }), { token: plainToken });
    expect(wrongVersion.status).toBe(400);
    expect(wrongVersion.json.error.code).toBe("VALIDATION_FAILED");
  });

  it("invalid date (2026-02-30) → 400 VALIDATION_FAILED, nothing written", async () => {
    const { plainToken } = await makeTestConnection();
    const { status, json } = await postJson(
      validEnvelope({ schedules: [scheduleWith({ date: "2026-02-30" })] }),
      { token: plainToken },
    );
    expect(status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_FAILED");
    expect(await prisma.importedSchedule.count()).toBe(0);
    expect(await prisma.scheduleImport.count()).toBe(0);
  });

  it("end <= start → 400 VALIDATION_FAILED (no overnight schedules in v1)", async () => {
    const { plainToken } = await makeTestConnection();
    const { status, json } = await postJson(
      validEnvelope({ schedules: [scheduleWith({ start: "10:00", end: "09:00" })] }),
      { token: plainToken },
    );
    expect(status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_FAILED");
    expect(await prisma.importedSchedule.count()).toBe(0);
  });

  it("duplicate ids in one payload → 400 VALIDATION_FAILED naming the ids", async () => {
    const { plainToken } = await makeTestConnection();
    const dupId = `EXT-DUP-${uid()}`;
    const { status, json } = await postJson(
      validEnvelope({
        schedules: [scheduleWith({ id: dupId }), scheduleWith({ id: dupId, title: "Khác" })],
      }),
      { token: plainToken },
    );
    expect(status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_FAILED");
    expect(JSON.stringify(json.error.details)).toContain(dupId);
    expect(await prisma.importedSchedule.count()).toBe(0);
  });

  it("generatedAt with +07:00 offset is accepted (spec example form)", async () => {
    const { plainToken } = await makeTestConnection();
    const { status } = await postJson(
      validEnvelope({ generatedAt: "2026-11-14T10:30:00+07:00" }),
      { token: plainToken },
    );
    expect(status).toBe(200);
  });
});

describe("POST /api/integrations/schedules/import — preview & apply", () => {
  it("preview writes nothing: no schedules, no import row, no apply audit", async () => {
    const { connection, plainToken } = await makeTestConnection();
    const { status, json } = await postJson(validEnvelope({ preview: true }), { token: plainToken });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.preview).toBe(true);
    expect(json.data.summary).toMatchObject({ total: 1, created: 1 });
    expect(await prisma.importedSchedule.count({ where: { connectionId: connection.id } })).toBe(0);
    expect(await prisma.scheduleImport.count({ where: { connectionId: connection.id } })).toBe(0);
    expect(
      await prisma.activityLog.count({ where: { action: "schedule_import.apply" } }),
    ).toBe(0);
  });

  it("apply creates the schedule (09:00 VN = 02:00 UTC), the import row and an audit entry", async () => {
    const { connection, plainToken } = await makeTestConnection();
    const externalId = `EXT-${uid()}`;
    const { status, json } = await postJson(
      validEnvelope({ schedules: [scheduleWith({ id: externalId })] }),
      { token: plainToken },
    );
    expect(status).toBe(200);
    expect(json.data.preview).toBe(false);
    expect(json.data.importId).toBeTruthy();
    expect(json.data.summary).toMatchObject({ total: 1, created: 1, failed: 0 });
    // The plaintext token never leaks into any API response.
    expect(JSON.stringify(json)).not.toContain(plainToken);

    const row = await prisma.importedSchedule.findFirstOrThrow({ where: { externalId } });
    expect(row.connectionId).toBe(connection.id);
    expect(row.title).toBe("Lịch kiểm thử");
    expect(row.status).toBe("scheduled");
    expect(row.startsAt.toISOString()).toBe("2026-11-20T02:00:00.000Z");
    expect(row.endsAt.toISOString()).toBe("2026-11-20T03:00:00.000Z");

    const record = await prisma.scheduleImport.findUniqueOrThrow({ where: { id: json.data.importId } });
    expect(record.connectionId).toBe(connection.id);
    expect(record.source).toBe("external_agent");
    expect(record.status).toBe("completed");
    expect(record.totalRecords).toBe(1);
    expect(record.createdCount).toBe(1);
    expect(record.createdByUserId).toBeNull();

    const audit = await prisma.activityLog.findFirst({
      where: { action: "schedule_import.apply", entityId: json.data.importId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBeNull();
    expect(audit?.summary).toContain(connection.name);
    expect(audit?.summary).toContain("1 created");
  });

  it("apply updates a changed schedule and reports unchanged on a repeat without importId", async () => {
    const { plainToken } = await makeTestConnection();
    const externalId = `EXT-${uid()}`;
    const first = await postJson(validEnvelope({ schedules: [scheduleWith({ id: externalId })] }), {
      token: plainToken,
    });
    expect(first.status).toBe(200);

    const updated = await postJson(
      validEnvelope({ schedules: [scheduleWith({ id: externalId, title: "Tiêu đề mới" })] }),
      { token: plainToken },
    );
    expect(updated.status).toBe(200);
    expect(updated.json.data.summary).toMatchObject({ total: 1, updated: 1 });
    expect((await prisma.importedSchedule.findFirstOrThrow({ where: { externalId } })).title).toBe(
      "Tiêu đề mới",
    );

    const repeated = await postJson(
      validEnvelope({ schedules: [scheduleWith({ id: externalId, title: "Tiêu đề mới" })] }),
      { token: plainToken },
    );
    expect(repeated.status).toBe(200);
    expect(repeated.json.data.summary).toMatchObject({ total: 1, unchanged: 1 });
    // Without an importId every apply writes its own import row.
    expect(repeated.json.data.importId).not.toBe(updated.json.data.importId);
  });

  it("cancelled: existing row → cancelled count; new id with cancelled → created as cancelled", async () => {
    const { plainToken } = await makeTestConnection();
    const existingId = `EXT-${uid()}`;
    const newId = `EXT-${uid()}`;
    await postJson(validEnvelope({ schedules: [scheduleWith({ id: existingId })] }), { token: plainToken });

    const { status, json } = await postJson(
      validEnvelope({
        schedules: [
          scheduleWith({ id: existingId, status: "cancelled" }),
          scheduleWith({ id: newId, status: "cancelled" }),
        ],
      }),
      { token: plainToken },
    );
    expect(status).toBe(200);
    expect(json.data.summary).toMatchObject({ total: 2, cancelled: 1, created: 1 });
    expect((await prisma.importedSchedule.findFirstOrThrow({ where: { externalId: existingId } })).status).toBe(
      "cancelled",
    );
    const created = await prisma.importedSchedule.findFirstOrThrow({ where: { externalId: newId } });
    expect(created.status).toBe("cancelled");
  });

  it("cross-connection: an id owned by another connection fails, the rest still apply", async () => {
    const a = await makeTestConnection();
    const b = await makeTestConnection();
    const ownedId = `EXT-${uid()}`;
    const freeId = `EXT-${uid()}`;
    await postJson(validEnvelope({ schedules: [scheduleWith({ id: ownedId })] }), { token: a.plainToken });

    const { status, json } = await postJson(
      validEnvelope({
        schedules: [scheduleWith({ id: ownedId }), scheduleWith({ id: freeId })],
      }),
      { token: b.plainToken },
    );
    expect(status).toBe(200);
    expect(json.data.summary).toMatchObject({ total: 2, created: 1, failed: 1 });
    const failedItem = (json.data.summary.items as { externalId: string; action: string; error?: string }[]).find(
      (item) => item.externalId === ownedId,
    );
    expect(failedItem?.action).toBe("failed");
    expect(failedItem?.error).toContain("already owned by another connection");
    const record = await prisma.scheduleImport.findUniqueOrThrow({ where: { id: json.data.importId } });
    expect(record.status).toBe("completed_with_errors");
    expect(record.failedCount).toBe(1);
    // A's row is untouched; B's new row exists.
    expect((await prisma.importedSchedule.findFirstOrThrow({ where: { externalId: ownedId } })).connectionId).toBe(
      a.connection.id,
    );
    expect(await prisma.importedSchedule.findFirst({ where: { externalId: freeId } })).not.toBeNull();
  });
});

describe("POST /api/integrations/schedules/import — idempotency (D6)", () => {
  it("replay with the same importId + same payload returns the stored summary without re-applying", async () => {
    const { connection, plainToken } = await makeTestConnection();
    const externalId = `EXT-${uid()}`;
    const importId = `imp-key-${uid()}`;
    const body = validEnvelope({ importId, schedules: [scheduleWith({ id: externalId })] });

    const first = await postJson(body, { token: plainToken });
    expect(first.status).toBe(200);
    expect(first.json.data.summary).toMatchObject({ total: 1, created: 1 });

    const replay = await postJson(body, { token: plainToken });
    expect(replay.status).toBe(200);
    expect(replay.json.data.importId).toBe(first.json.data.importId);
    expect(replay.json.data.summary).toEqual(first.json.data.summary);
    expect(await prisma.importedSchedule.count({ where: { connectionId: connection.id } })).toBe(1);
    expect(await prisma.scheduleImport.count({ where: { connectionId: connection.id } })).toBe(1);
  });

  it("same importId with different content → 409 IMPORT_ID_CONFLICT and nothing new is written", async () => {
    const { connection, plainToken } = await makeTestConnection();
    const externalId = `EXT-${uid()}`;
    const importId = `imp-key-${uid()}`;
    const first = await postJson(
      validEnvelope({ importId, schedules: [scheduleWith({ id: externalId })] }),
      { token: plainToken },
    );
    expect(first.status).toBe(200);

    const conflict = await postJson(
      validEnvelope({
        importId,
        schedules: [scheduleWith({ id: externalId, title: "Nội dung khác" })],
      }),
      { token: plainToken },
    );
    expect(conflict.status).toBe(409);
    expect(conflict.json.error.code).toBe("IMPORT_ID_CONFLICT");
    expect(await prisma.scheduleImport.count({ where: { connectionId: connection.id } })).toBe(1);
    expect((await prisma.importedSchedule.findFirstOrThrow({ where: { externalId } })).title).toBe(
      "Lịch kiểm thử",
    );
  });
});

describe("POST /api/integrations/schedules/import — size & rate limits", () => {
  it("body over MAX_IMPORT_JSON_BYTES → 413 PAYLOAD_TOO_LARGE", async () => {
    const { plainToken } = await makeTestConnection();
    const big = validEnvelope({ padding: "x".repeat(300_000) });
    const { status, json } = await postJson(big, { token: plainToken });
    expect(status).toBe(413);
    expect(json.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(await prisma.scheduleImport.count()).toBe(0);
  });

  it(`unauthenticated attempts are limited to ${IMPORT_AUTH_LIMIT.limit}/min per IP`, async () => {
    ipState.fixed = "203.0.113.99";
    try {
      for (let i = 0; i < IMPORT_AUTH_LIMIT.limit; i++) {
        const { status, json } = await postJson(validEnvelope());
        expect(status).toBe(401);
        expect(json.error.code).toBe("UNAUTHORIZED");
      }
      const limited = await postJson(validEnvelope());
      expect(limited.status).toBe(429);
      expect(limited.json.error.code).toBe("RATE_LIMITED");
    } finally {
      ipState.fixed = null;
    }
  });

  it(`authenticated imports are limited to ${IMPORT_API_LIMIT.limit} per 10 minutes per connection`, async () => {
    const { plainToken } = await makeTestConnection();
    const previewBody = validEnvelope({ preview: true });
    for (let i = 0; i < IMPORT_API_LIMIT.limit; i++) {
      const { status } = await postJson(previewBody, { token: plainToken });
      expect(status).toBe(200);
    }
    const limited = await postJson(previewBody, { token: plainToken });
    expect(limited.status).toBe(429);
    expect(limited.json.error.code).toBe("RATE_LIMITED");
  });
});
