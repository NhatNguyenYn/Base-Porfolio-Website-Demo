#!/usr/bin/env node
/**
 * Temporary E2E-only integration connection for the local scratch DB
 * (`portfolio`). Mirrors e2e/temp-admin.mjs: used by the Phase 11 API E2E
 * spec (Worker F) to get a throwaway Bearer token without going through
 * the admin UI, then deleted afterwards so the DB ends as seeded.
 *
 * NEVER run against any other database: the script refuses any
 * DATABASE_URL that is not a local Postgres on port 5432.
 *
 *   node e2e/temp-connection.mjs create --name <name>
 *     # creates an active IntegrationConnection, prints its id and its
 *     # plaintext `imp_…` token to stdout (LOCAL USE ONLY — the token is
 *     # shown once and cannot be recovered afterwards)
 *   node e2e/temp-connection.mjs delete --name <name>
 *     # deletes the connection(s) with that name AND their schedules and
 *     # import history (items → imports → schedules → connection)
 *   node e2e/temp-connection.mjs delete --id <connection-id>
 *     # same, by connection id
 *
 * --name defaults to "e2e-test-connection".
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const DEFAULT_NAME = process.env.E2E_CONNECTION_NAME || "e2e-test-connection";
const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public";

function fail(message) {
  console.error(message);
  process.exit(2);
}

// Local-only guard: refuse anything that is not 127.0.0.1/localhost:5432.
let parsedUrl;
try {
  parsedUrl = new URL(DB_URL);
} catch {
  fail("DATABASE_URL could not be parsed — refusing to run");
}
if (
  parsedUrl.protocol !== "postgres:" &&
  parsedUrl.protocol !== "postgresql:"
) {
  fail(`refusing to run: DATABASE_URL protocol ${parsedUrl.protocol} is not postgres`);
}
if (parsedUrl.hostname !== "127.0.0.1" && parsedUrl.hostname !== "localhost") {
  fail(`refusing to run: DATABASE_URL host ${parsedUrl.hostname} is not local`);
}
if (parsedUrl.port !== "5432") {
  fail(`refusing to run: DATABASE_URL port ${parsedUrl.port || "(default)"} is not 5432`);
}

function flagValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
const mode = process.argv[2];

try {
  if (mode === "create") {
    const name = flagValue("--name") ?? DEFAULT_NAME;
    const plainToken = `imp_${crypto.randomBytes(16).toString("hex")}`;
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");
    const connection = await prisma.integrationConnection.create({
      data: { name, tokenHash },
      select: { id: true, name: true },
    });
    console.log(`created integration connection ${connection.id} (${connection.name})`);
    console.log(`token: ${plainToken}`);
  } else if (mode === "delete") {
    const id = flagValue("--id");
    const name = flagValue("--name") ?? DEFAULT_NAME;
    const where = id ? { id } : { name };
    const connections = await prisma.integrationConnection.findMany({
      where,
      select: { id: true, name: true },
    });
    if (connections.length === 0) {
      console.log(`no integration connection found for ${id ? `id ${id}` : `name "${name}"`}`);
    } else {
      const ids = connections.map((c) => c.id);
      // Imports reference the connection with onDelete Restrict, so their
      // items + rows go first; schedules go next (Restrict as well).
      const imports = await prisma.scheduleImport.findMany({
        where: { connectionId: { in: ids } },
        select: { id: true },
      });
      const importIds = imports.map((row) => row.id);
      if (importIds.length > 0) {
        await prisma.scheduleImportItem.deleteMany({ where: { importId: { in: importIds } } });
      }
      const deletedImports = await prisma.scheduleImport.deleteMany({
        where: { connectionId: { in: ids } },
      });
      const deletedSchedules = await prisma.importedSchedule.deleteMany({
        where: { connectionId: { in: ids } },
      });
      const deleted = await prisma.integrationConnection.deleteMany({ where: { id: { in: ids } } });
      for (const c of connections) {
        console.log(`deleted integration connection ${c.id} (${c.name})`);
      }
      console.log(
        `deleted ${deleted.count} connection(s), ${deletedSchedules.count} schedule(s), ${deletedImports.count} import(s)`,
      );
    }
  } else {
    fail("usage: node e2e/temp-connection.mjs create [--name <name>] | delete [--name <name> | --id <id>]");
  }
} finally {
  await prisma.$disconnect();
}
