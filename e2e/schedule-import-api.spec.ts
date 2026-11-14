// E2E: integration API (Phase 11, Worker F — D7).
//
// Exercises the REAL route `POST /api/integrations/schedules/import`
// over HTTP against a production build (`next build` + `next start`,
// never dev mode), with REAL Bearer tokens issued by
// `e2e/temp-connection.mjs create` (local scratch DB `portfolio` only)
// and deleted afterwards — no mocked auth, no mocked `next/headers`.
//
// HOW TO RUN:
//   1. Start the local Postgres + engine mirror if down (see phase-11-audit.md §1).
//   2. DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public' \
//        npx prisma migrate deploy   # local scratch DB only, never production
//   3. DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public' \
//        node e2e/temp-admin.mjs create
//      (the Playwright `setup` project logs in once as that admin before
//      ANY spec in the e2e project runs — this spec itself needs no browser
//      session, it only uses the `request` fixture — but setup still runs.)
//   4. DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public' \
//        npm run build && (PORT=3100 npm run start &)
//   5. DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public' \
//        E2E_BASE_URL=http://127.0.0.1:3100 \
//        E2E_ADMIN_EMAIL=e2e-admin@example.com \
//        E2E_ADMIN_PASSWORD_FILE=/home/hatch/.e2e-admin-pw \
//        npx playwright test --config e2e/playwright.config.ts e2e/schedule-import-api.spec.ts
//      (--config is REQUIRED: without it baseURL is unset. If port 3000 is
//      taken, start production on another port and pass E2E_BASE_URL.)
//   6. node e2e/temp-admin.mjs delete   (same DATABASE_URL)
//   7. Connections created in beforeAll are deleted in afterAll via
//      `e2e/temp-connection.mjs delete --name <name>` (which also deletes
//      their schedules + import history); the DB ends as seeded.
//
// RATE-LIMIT ISOLATION (read before touching the auth tests): the route
// rate-limits unauthenticated attempts per hashed client IP (10/min,
// IMPORT_AUTH_LIMIT) and authenticated imports per connection (30/10min,
// IMPORT_API_LIMIT). Over plain localhost every request shares one IP
// bucket ("unknown" when no X-Forwarded-For is sent), so each
// unauthenticated check below sends its own distinct `x-forwarded-for`
// (203.0.113.x, TEST-NET-3 — the same trick as e2e/booking.spec.ts) to
// get a fresh bucket; the rate-limit tests run LAST on their own fresh
// IP / fresh connection so they cannot be tripped early by earlier tests.
import { execFileSync } from "node:child_process";
import path from "node:path";

import { test, expect, type APIRequestContext } from "@playwright/test";
import { db } from "./helpers";

const REPO_ROOT = path.resolve(__dirname, "..");
const RUN = Date.now().toString(36);
const PREFIX = `E2E-API-${RUN}`;
const IMPORT_URL = "/api/integrations/schedules/import";

const CONN_A = `E2E-api-a-${RUN}`;
const CONN_B = `E2E-api-b-${RUN}`;
const CONN_RATE = `E2E-api-ratelimit-${RUN}`;
const CONN_REVOKED = `E2E-api-revoked-${RUN}`;

/** VN calendar date (YYYY-MM-DD) N days from now. */
function vnDatePlusDays(days: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function schedule(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    title: `Lịch E2E API ${id}`,
    date: vnDatePlusDays(7),
    start: "09:00",
    end: "10:00",
    status: "scheduled",
    ...overrides,
  };
}

function envelope(
  schedules: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: "schedule_import",
    version: "1.0",
    source: "external_agent",
    generatedAt: new Date().toISOString(),
    schedules,
    ...overrides,
  };
}

type CreatedConnection = { id: string; token: string };

function createConnection(name: string): CreatedConnection {
  const out = execFileSync("node", ["e2e/temp-connection.mjs", "create", "--name", name], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const id = out.match(/created integration connection (\S+)/)?.[1] ?? "";
  const token = out.match(/token: (imp_[0-9a-f]{32})/)?.[1] ?? "";
  expect(id).not.toBe("");
  expect(token).toMatch(/^imp_[0-9a-f]{32}$/);
  return { id, token };
}

function deleteConnection(name: string): void {
  execFileSync("node", ["e2e/temp-connection.mjs", "delete", "--name", name], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "pipe",
  });
}

type ImportResult = { status: number; json: Record<string, any> };

async function postImport(
  request: APIRequestContext,
  body: unknown,
  opts: { token?: string; authorization?: string; xff?: string } = {},
): Promise<ImportResult> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.authorization !== undefined) headers.authorization = opts.authorization;
  else if (opts.token !== undefined) headers.authorization = `Bearer ${opts.token}`;
  if (opts.xff !== undefined) headers["x-forwarded-for"] = opts.xff;
  const data = typeof body === "string" ? body : JSON.stringify(body);
  const res = await request.post(IMPORT_URL, { headers, data });
  return { status: res.status(), json: (await res.json()) as Record<string, any> };
}

/** Distinct TEST-NET-3 source IPs so unauthenticated buckets never bleed. */
let xffCounter = 0;
function freshXff(): string {
  xffCounter += 1;
  return `203.0.113.${200 + xffCounter}`;
}

const connections = new Map<string, CreatedConnection>();

test.describe.serial("integration API (token auth, preview/apply, idempotency, rate limit)", () => {
  test.beforeAll(async () => {
    for (const name of [CONN_A, CONN_B, CONN_RATE, CONN_REVOKED]) {
      connections.set(name, createConnection(name));
    }
  });

  test.afterAll(async () => {
    for (const name of [CONN_A, CONN_B, CONN_RATE, CONN_REVOKED]) {
      try {
        deleteConnection(name);
      } catch {
        // Best-effort: a leftover connection is reported by the final DB
        // check in the runner, not hidden by a failing afterAll.
      }
    }
    // Belt and braces: nothing with this run's prefix may survive.
    await db().importedSchedule.deleteMany({ where: { externalId: { startsWith: PREFIX } } });
    await db().$disconnect();
  });

  test("(a) valid import → 200, correct summary counts, rows in DB (09:00 VN = 02:00 UTC)", async ({
    request,
  }) => {
    const token = connections.get(CONN_A)!.token;
    const date = vnDatePlusDays(7);
    const { status, json } = await postImport(
      request,
      envelope([schedule(`${PREFIX}-001`, { date }), schedule(`${PREFIX}-002`, { date, start: "14:00", end: "14:30", status: "confirmed" })]),
      { token },
    );
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.preview).toBe(false);
    expect(json.data.importId).toBeTruthy();
    expect(json.data.summary).toMatchObject({ total: 2, created: 2, updated: 0, unchanged: 0, cancelled: 0, failed: 0 });

    const row1 = await db().importedSchedule.findFirstOrThrow({ where: { externalId: `${PREFIX}-001` } });
    expect(row1.connectionId).toBe(connections.get(CONN_A)!.id);
    expect(row1.title).toBe(`Lịch E2E API ${PREFIX}-001`);
    expect(row1.status).toBe("scheduled");
    expect(row1.startsAt.toISOString()).toBe(`${date}T02:00:00.000Z`);
    expect(row1.endsAt.toISOString()).toBe(`${date}T03:00:00.000Z`);
    const row2 = await db().importedSchedule.findFirstOrThrow({ where: { externalId: `${PREFIX}-002` } });
    expect(row2.status).toBe("confirmed");
    expect(row2.startsAt.toISOString()).toBe(`${date}T07:00:00.000Z`);

    const record = await db().scheduleImport.findUniqueOrThrow({ where: { id: json.data.importId } });
    expect(record.status).toBe("completed");
    expect(record.source).toBe("external_agent");
    expect(record.totalRecords).toBe(2);
    expect(record.createdCount).toBe(2);
    expect(record.connectionId).toBe(connections.get(CONN_A)!.id);
  });

  test("(b) preview=true → 200, correct counts (1 updated + 1 created), writes NOTHING", async ({
    request,
  }) => {
    const token = connections.get(CONN_A)!.token;
    const importsBefore = await db().scheduleImport.count();
    const schedulesBefore = await db().importedSchedule.count({ where: { externalId: { startsWith: PREFIX } } });
    const { status, json } = await postImport(
      request,
      envelope(
        [
          schedule(`${PREFIX}-001`, { title: "Tiêu đề xem trước (không được ghi)" }),
          schedule(`${PREFIX}-003`),
        ],
        { preview: true },
      ),
      { token },
    );
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.preview).toBe(true);
    expect(json.data.importId).toBeUndefined();
    expect(json.data.summary).toMatchObject({ total: 2, created: 1, updated: 1, failed: 0 });

    expect(await db().scheduleImport.count()).toBe(importsBefore);
    expect(await db().importedSchedule.count({ where: { externalId: { startsWith: PREFIX } } })).toBe(
      schedulesBefore,
    );
    expect(await db().importedSchedule.findFirst({ where: { externalId: `${PREFIX}-003` } })).toBeNull();
    expect(
      (await db().importedSchedule.findFirstOrThrow({ where: { externalId: `${PREFIX}-001` } })).title,
    ).toBe(`Lịch E2E API ${PREFIX}-001`);
  });

  test("(c) missing token → 401, unknown token → 401, revoked token → 403 (schedules kept)", async ({
    request,
  }) => {
    const missing = await postImport(request, envelope([schedule(`${PREFIX}-401`)]), { xff: freshXff() });
    expect(missing.status).toBe(401);
    expect(missing.json.error.code).toBe("UNAUTHORIZED");

    const unknown = await postImport(request, envelope([schedule(`${PREFIX}-401`)]), {
      token: `imp_${"ab".repeat(16)}`,
      xff: freshXff(),
    });
    expect(unknown.status).toBe(401);
    expect(unknown.json.error.code).toBe("UNAUTHORIZED");

    const malformed = await postImport(request, envelope([schedule(`${PREFIX}-401`)]), {
      authorization: "Basic abc123",
      xff: freshXff(),
    });
    expect(malformed.status).toBe(401);
    expect(malformed.json.error.code).toBe("UNAUTHORIZED");

    // Revoked: the token is valid but the connection is inactive → 403.
    const revoked = connections.get(CONN_REVOKED)!;
    const applied = await postImport(request, envelope([schedule(`${PREFIX}-REV-001`)]), {
      token: revoked.token,
    });
    expect(applied.status).toBe(200);
    await db().integrationConnection.update({
      where: { id: revoked.id },
      data: { isActive: false },
    });
    const afterRevoke = await postImport(request, envelope([schedule(`${PREFIX}-REV-002`)]), {
      token: revoked.token,
      xff: freshXff(),
    });
    expect(afterRevoke.status).toBe(403);
    expect(afterRevoke.json.error.code).toBe("FORBIDDEN");
    // Revocation never deletes history.
    expect(
      await db().importedSchedule.count({ where: { connectionId: revoked.id } }),
    ).toBe(1);
    expect(await db().importedSchedule.findFirst({ where: { externalId: `${PREFIX}-REV-002` } })).toBeNull();
  });

  test("(d) malformed JSON → 400 INVALID_JSON; bad fields/dates/dup ids → 400 VALIDATION_FAILED, nothing written", async ({
    request,
  }) => {
    const token = connections.get(CONN_A)!.token;

    const badJson = await postImport(request, "{not json", { token });
    expect(badJson.status).toBe(400);
    expect(badJson.json.error.code).toBe("INVALID_JSON");

    const missingTitle = await postImport(
      request,
      envelope([{ id: `${PREFIX}-BAD-1`, date: vnDatePlusDays(7), start: "09:00", end: "10:00" }]),
      { token },
    );
    expect(missingTitle.status).toBe(400);
    expect(missingTitle.json.error.code).toBe("VALIDATION_FAILED");

    const badDate = await postImport(
      request,
      envelope([schedule(`${PREFIX}-BAD-2`, { date: "2026-02-30" })]),
      { token },
    );
    expect(badDate.status).toBe(400);
    expect(badDate.json.error.code).toBe("VALIDATION_FAILED");

    const endBeforeStart = await postImport(
      request,
      envelope([schedule(`${PREFIX}-BAD-3`, { start: "10:00", end: "09:00" })]),
      { token },
    );
    expect(endBeforeStart.status).toBe(400);
    expect(endBeforeStart.json.error.code).toBe("VALIDATION_FAILED");

    const dupId = `${PREFIX}-DUP`;
    const duplicateIds = await postImport(
      request,
      envelope([schedule(dupId), schedule(dupId, { title: "Trùng id" })]),
      { token },
    );
    expect(duplicateIds.status).toBe(400);
    expect(duplicateIds.json.error.code).toBe("VALIDATION_FAILED");
    expect(JSON.stringify(duplicateIds.json.error.details)).toContain(dupId);

    for (const badId of [`${PREFIX}-BAD-1`, `${PREFIX}-BAD-2`, `${PREFIX}-BAD-3`, dupId]) {
      expect(await db().importedSchedule.findFirst({ where: { externalId: badId } })).toBeNull();
    }
  });

  test("(e) idempotency replay: same importId + same payload → stored summary, no new rows", async ({
    request,
  }) => {
    const token = connections.get(CONN_A)!.token;
    const importId = `e2e-api-imp-${RUN}`;
    // Schedules in externalId-ascending order so the replayed summary
    // (items stored ordered by externalId) deep-equals the first one.
    const body = envelope(
      [schedule(`${PREFIX}-IDEM-001`), schedule(`${PREFIX}-IDEM-002`, { start: "14:00", end: "14:30" })],
      { importId },
    );
    const first = await postImport(request, body, { token });
    expect(first.status).toBe(200);
    expect(first.json.data.summary).toMatchObject({ total: 2, created: 2 });

    const replay = await postImport(request, body, { token });
    expect(replay.status).toBe(200);
    expect(replay.json.data.importId).toBe(first.json.data.importId);
    expect(replay.json.data.summary).toEqual(first.json.data.summary);
    expect(await db().importedSchedule.count({ where: { externalId: { startsWith: `${PREFIX}-IDEM` } } })).toBe(2);
    expect(
      await db().scheduleImport.count({
        where: { connectionId: connections.get(CONN_A)!.id, importKey: importId },
      }),
    ).toBe(1);
  });

  test("(f) same importId + different payload → 409 IMPORT_ID_CONFLICT, nothing new written", async ({
    request,
  }) => {
    const token = connections.get(CONN_A)!.token;
    const importId = `e2e-api-imp-${RUN}`;
    const importsBefore = await db().scheduleImport.count({
      where: { connectionId: connections.get(CONN_A)!.id },
    });
    const conflict = await postImport(
      request,
      envelope([schedule(`${PREFIX}-IDEM-001`, { title: "Nội dung khác" })], { importId }),
      { token },
    );
    expect(conflict.status).toBe(409);
    expect(conflict.json.error.code).toBe("IMPORT_ID_CONFLICT");
    expect(await db().scheduleImport.count({ where: { connectionId: connections.get(CONN_A)!.id } })).toBe(
      importsBefore,
    );
    expect(
      (await db().importedSchedule.findFirstOrThrow({ where: { externalId: `${PREFIX}-IDEM-001` } })).title,
    ).toBe(`Lịch E2E API ${PREFIX}-IDEM-001`);
  });

  test("(g) cross-connection: B sending A's id fails that item only; the rest apply", async ({
    request,
  }) => {
    const tokenA = connections.get(CONN_A)!.token;
    const tokenB = connections.get(CONN_B)!.token;
    const ownedId = `${PREFIX}-X-001`;
    const freeId = `${PREFIX}-X-002`;
    const owned = await postImport(request, envelope([schedule(ownedId)]), { token: tokenA });
    expect(owned.status).toBe(200);

    const { status, json } = await postImport(
      request,
      envelope([schedule(ownedId), schedule(freeId)]),
      { token: tokenB },
    );
    expect(status).toBe(200);
    expect(json.data.summary).toMatchObject({ total: 2, created: 1, failed: 1 });
    const failedItem = (json.data.summary.items as { externalId: string; action: string; error?: string }[]).find(
      (item) => item.externalId === ownedId,
    );
    expect(failedItem?.action).toBe("failed");
    expect(failedItem?.error).toContain("already owned by another connection");

    const record = await db().scheduleImport.findUniqueOrThrow({ where: { id: json.data.importId } });
    expect(record.status).toBe("completed_with_errors");
    expect(record.failedCount).toBe(1);
    expect((await db().importedSchedule.findFirstOrThrow({ where: { externalId: ownedId } })).connectionId).toBe(
      connections.get(CONN_A)!.id,
    );
    expect(
      (await db().importedSchedule.findFirstOrThrow({ where: { externalId: freeId } })).connectionId,
    ).toBe(connections.get(CONN_B)!.id);
  });

  test("(h1) unauthenticated rate limit: 10 attempts per minute per IP, 11th → 429", async ({
    request,
  }) => {
    const xff = freshXff();
    for (let i = 0; i < 10; i++) {
      const res = await postImport(request, envelope([schedule(`${PREFIX}-RL`)]), { xff });
      expect(res.status).toBe(401);
      expect(res.json.error.code).toBe("UNAUTHORIZED");
    }
    const limited = await postImport(request, envelope([schedule(`${PREFIX}-RL`)]), { xff });
    expect(limited.status).toBe(429);
    expect(limited.json.error.code).toBe("RATE_LIMITED");
  });

  test("(h2) authenticated rate limit: 30 imports per 10 min per connection, 31st → 429", async ({
    request,
  }) => {
    const token = connections.get(CONN_RATE)!.token;
    const previewBody = envelope([schedule(`${PREFIX}-RL-PREVIEW`)], { preview: true });
    for (let i = 0; i < 30; i++) {
      const res = await postImport(request, previewBody, { token });
      expect(res.status).toBe(200);
    }
    const limited = await postImport(request, previewBody, { token });
    expect(limited.status).toBe(429);
    expect(limited.json.error.code).toBe("RATE_LIMITED");
    // Previews write nothing even at the limit.
    expect(await db().importedSchedule.findFirst({ where: { externalId: `${PREFIX}-RL-PREVIEW` } })).toBeNull();
  });
});
