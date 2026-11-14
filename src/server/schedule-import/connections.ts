// Integration connections (Phase 11, D7/D10).
//
// A connection is one machine-to-machine credential for the schedule-import
// API: an opaque token `imp_` + 32 hex chars, generated server-side and
// shown in plaintext exactly once (at creation / rotation). Only the
// SHA-256 hash is ever persisted (`IntegrationConnection.tokenHash`, same
// approach as `Session.tokenHash` in src/server/auth.ts); the plaintext
// token is never stored and never logged.
//
// Auth distinction (D7): a missing/unknown token is 401 UNAUTHORIZED, a
// known-but-revoked (inactive) connection is 403 FORBIDDEN. To let the
// route make that distinction, `authenticateIntegrationRequest` returns
// `null` ONLY for a missing/unknown token and still returns an inactive
// connection (with `isActive: false`) so the caller can answer 403.
// `lastUsedAt` is updated only on successful auth of an active connection.

import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { IntegrationConnection } from "@prisma/client";

import { prisma } from "@/server/db";
import { logActivity } from "@/server/audit";

/** Everything about a connection except its token hash (never exposed). */
export type IntegrationConnectionPublic = Omit<IntegrationConnection, "tokenHash">;

const CONNECTION_SELECT = {
  id: true,
  name: true,
  autoApply: true,
  isActive: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** SHA-256 hex of an integration token — the only form ever persisted. */
export function hashIntegrationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateIntegrationToken(): string {
  return `imp_${randomBytes(16).toString("hex")}`;
}

function validateConnectionName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("Integration connection name is required");
  }
  if (trimmed.length > 200) {
    throw new Error("Integration connection name must be at most 200 characters");
  }
  return trimmed;
}

export class IntegrationConnectionNotFoundError extends Error {
  readonly connectionId: string;

  constructor(connectionId: string) {
    super(`Integration connection not found: ${connectionId}`);
    this.name = "IntegrationConnectionNotFoundError";
    this.connectionId = connectionId;
  }
}

/**
 * Creates a connection and returns it with the plaintext token. The caller
 * must show `plainToken` to the operator exactly once and never store it
 * anywhere else — it cannot be recovered afterwards.
 */
export async function createIntegrationConnection(
  name: string,
  actorUserId: string,
): Promise<{ connection: IntegrationConnectionPublic; plainToken: string }> {
  const plainToken = generateIntegrationToken();
  const connection = await prisma.integrationConnection.create({
    data: {
      name: validateConnectionName(name),
      tokenHash: hashIntegrationToken(plainToken),
    },
    select: CONNECTION_SELECT,
  });
  await logActivity({
    userId: actorUserId,
    action: "integration_connection.create",
    entityType: "IntegrationConnection",
    entityId: connection.id,
    summary: `Created integration connection "${connection.name}".`,
  });
  return { connection, plainToken };
}

/**
 * Replaces a connection's token. The old token stops working immediately
 * (its hash is overwritten); the new plaintext token is returned once.
 */
export async function rotateIntegrationConnection(
  id: string,
  actorUserId: string,
): Promise<{ plainToken: string }> {
  const existing = await prisma.integrationConnection.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) throw new IntegrationConnectionNotFoundError(id);

  const plainToken = generateIntegrationToken();
  await prisma.integrationConnection.update({
    where: { id },
    data: { tokenHash: hashIntegrationToken(plainToken) },
  });
  await logActivity({
    userId: actorUserId,
    action: "integration_connection.rotate",
    entityType: "IntegrationConnection",
    entityId: id,
    summary: `Rotated token for integration connection "${existing.name}".`,
  });
  return { plainToken };
}

/**
 * Revokes a connection (`isActive = false`). Its schedules and import
 * history are kept — revocation never deletes history (D1, onDelete
 * Restrict). There is no delete/unrevoke in v1.
 */
export async function revokeIntegrationConnection(id: string, actorUserId: string): Promise<void> {
  const existing = await prisma.integrationConnection.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) throw new IntegrationConnectionNotFoundError(id);

  await prisma.integrationConnection.update({
    where: { id },
    data: { isActive: false },
  });
  await logActivity({
    userId: actorUserId,
    action: "integration_connection.revoke",
    entityType: "IntegrationConnection",
    entityId: id,
    summary: `Revoked integration connection "${existing.name}".`,
  });
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Authenticates a machine-to-machine request via `Authorization: Bearer
 * imp_…`. Returns `null` for a missing/malformed/unknown token (the route
 * answers 401 UNAUTHORIZED). A known but inactive connection is returned
 * with `isActive: false` so the route can answer 403 FORBIDDEN instead.
 * On successful auth of an active connection, `lastUsedAt` is updated
 * (best-effort: a failure to write it must not reject a valid import).
 */
export async function authenticateIntegrationRequest(
  request: Request,
): Promise<{ connection: IntegrationConnectionPublic } | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const connection = await prisma.integrationConnection.findUnique({
    where: { tokenHash: hashIntegrationToken(token) },
    select: CONNECTION_SELECT,
  });
  if (!connection) return null;

  if (connection.isActive) {
    await prisma.integrationConnection
      .update({ where: { id: connection.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }
  return { connection };
}
