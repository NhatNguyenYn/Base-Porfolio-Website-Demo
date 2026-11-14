// Integration API: POST /api/integrations/schedules/import (Phase 11, D7).
//
// Machine-to-machine endpoint for an external agent (future Muse) to
// submit schedule JSON. Auth is a dedicated Bearer token
// (`Authorization: Bearer imp_…`), NOT the admin session cookie — so
// `requireSameOrigin` is deliberately NOT applied here: this is not a
// browser form post and there is no ambient cookie credential to protect
// from CSRF; the Bearer token itself is the credential, and it is never
// sent to (or readable by) frontend code.
//
// Order of checks: size (413) → auth (401 unknown / 403 revoked) →
// per-caller rate limit (429) → JSON/schema validation (400) → preview or
// apply. Error responses use the shared `ok`/`fail` envelope via `withApi`
// and never leak tokens or stack traces.

import { headers } from "next/headers";
import { z } from "zod";

import { fail, ok, withApi } from "@/lib/api";
import { clientIp, hashedKey, rateLimit } from "@/lib/rate-limit";
import {
  IMPORT_API_LIMIT,
  IMPORT_AUTH_LIMIT,
  MAX_IMPORT_JSON_BYTES,
} from "@/lib/schedule-import-limits";
import { parseScheduleImportPayload } from "@/lib/schedule-import-schema";
import { zodFieldErrors } from "@/lib/validation";
import { logActivity } from "@/server/audit";
import {
  applyScheduleImport,
  computeScheduleImportPayloadHash,
  ConcurrentImportError,
  ImportIdConflictError,
  IntegrationConnectionNotFoundError,
  previewScheduleImport,
} from "@/server/schedule-import/engine";
import { authenticateIntegrationRequest } from "@/server/schedule-import/connections";

export const dynamic = "force-dynamic";

/** Rate-limit + reject unauthenticated attempts (D7: 10/min per hashed IP). */
async function rejectUnauthenticated(code: "UNAUTHORIZED" | "FORBIDDEN", message: string, status: 401 | 403) {
  const ip = clientIp(await headers());
  const limit = rateLimit(`import-auth:${hashedKey(ip)}`, IMPORT_AUTH_LIMIT.limit, IMPORT_AUTH_LIMIT.windowMs);
  if (!limit.ok) {
    return fail("RATE_LIMITED", "Too many import attempts. Please try again shortly.", 429);
  }
  return fail(code, message, status);
}

export async function POST(request: Request) {
  return withApi(request, async () => {
    // Fast size guard on the declared length (bookings-route pattern).
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_IMPORT_JSON_BYTES) {
      return fail("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
    }

    const auth = await authenticateIntegrationRequest(request);
    if (!auth) {
      return rejectUnauthenticated("UNAUTHORIZED", "Missing or invalid integration token.", 401);
    }
    if (!auth.connection.isActive) {
      return rejectUnauthenticated("FORBIDDEN", "Integration connection is revoked.", 403);
    }

    // Authenticated per-connection limit (D7: 30 per 10 minutes).
    const apiLimit = rateLimit(
      `import:${auth.connection.id}`,
      IMPORT_API_LIMIT.limit,
      IMPORT_API_LIMIT.windowMs,
    );
    if (!apiLimit.ok) {
      return fail("RATE_LIMITED", "Too many import requests. Please try again shortly.", 429);
    }

    // Read the raw body so the size limit also holds when no
    // content-length was sent (chunked transfer): the declared-length
    // check above is only a fast path.
    let raw: string;
    try {
      raw = await request.text();
    } catch {
      return fail("INVALID_JSON", "Request body must be valid JSON.", 400);
    }
    if (Buffer.byteLength(raw, "utf8") > MAX_IMPORT_JSON_BYTES) {
      return fail("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return fail("INVALID_JSON", "Request body must be valid JSON.", 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail("INVALID_JSON", "Request body must be a JSON object.", 400);
    }

    let parsed;
    try {
      parsed = parseScheduleImportPayload(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return fail("VALIDATION_FAILED", "The import payload failed validation.", 400, {
          fieldErrors: zodFieldErrors(error),
        });
      }
      throw error;
    }
    const { envelope, schedules } = parsed;

    if (envelope.preview === true) {
      const summary = await previewScheduleImport({
        connectionId: auth.connection.id,
        source: envelope.source,
        schedules,
      });
      return ok({ preview: true, summary });
    }

    // D6: the payload hash MUST come from the engine's canonical helper —
    // the route never hashes the payload itself, so replay/conflict
    // comparisons agree with the engine.
    const payloadHash = computeScheduleImportPayloadHash(schedules);
    try {
      const { importId, summary } = await applyScheduleImport({
        connectionId: auth.connection.id,
        source: envelope.source,
        schedules,
        importKey: envelope.importId ?? null,
        payloadHash,
        userId: null,
      });
      await logActivity({
        userId: null,
        action: "schedule_import.apply",
        entityType: "ScheduleImport",
        entityId: importId,
        summary: `Imported ${summary.total} schedule(s) via connection "${auth.connection.name}": ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.cancelled} cancelled, ${summary.failed} failed.`,
      });
      return ok({ preview: false, importId, summary });
    } catch (error) {
      if (error instanceof ImportIdConflictError) {
        return fail("IMPORT_ID_CONFLICT", error.message, 409);
      }
      if (error instanceof ConcurrentImportError) {
        return fail("CONCURRENT_IMPORT", "A concurrent import conflicted. Please retry the import.", 409);
      }
      if (error instanceof IntegrationConnectionNotFoundError) {
        return fail("UNAUTHORIZED", "Integration connection no longer exists.", 401);
      }
      throw error;
    }
  });
}
