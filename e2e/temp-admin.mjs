#!/usr/bin/env node
/**
 * Temporary E2E-only admin account for the local scratch DB (`portfolio`).
 *
 * Why this exists: the password stored for the seeded admin@example.com
 * matches NEITHER the default seed literal in scripts/preflight.mjs:16 NOR
 * the SEED_ADMIN_PASSWORD recorded in the baseline seed command (both
 * verified with bcrypt.compare), so the seeded account cannot be logged
 * into. Instead of leaving the whole admin section untested, the suite
 * runs against this throwaway SUPER_ADMIN and deletes it afterwards —
 * the DB ends exactly as seeded. NEVER run against any other database.
 *
 *   node e2e/temp-admin.mjs create   # creates e2e-admin@example.com, writes
 *                                    # a random password to $E2E_ADMIN_PASSWORD_FILE
 *                                    # (default /home/hatch/.e2e-admin-pw, mode 600)
 *   node e2e/temp-admin.mjs delete   # deletes the user (+ sessions via cascade)
 *                                    # and removes the password file
 */
import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-admin@example.com";
const PW_FILE = process.env.E2E_ADMIN_PASSWORD_FILE || "/home/hatch/.e2e-admin-pw";
const URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public";

const prisma = new PrismaClient({ datasources: { db: { url: URL } } });
const mode = process.argv[2];

if (mode === "create") {
  const password = crypto.randomBytes(24).toString("base64url");
  fs.writeFileSync(PW_FILE, password, { mode: 0o600 });
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`user ${EMAIL} already exists — password file (re)written, password unchanged`);
  } else {
    await prisma.user.create({
      data: {
        email: EMAIL,
        name: "E2E Smoke Test",
        passwordHash: await bcrypt.hash(password, 12),
        role: "SUPER_ADMIN",
      },
    });
    console.log(`created temporary admin ${EMAIL} (password in ${PW_FILE})`);
  }
} else if (mode === "delete") {
  const { count } = await prisma.user.deleteMany({ where: { email: EMAIL } });
  console.log(`deleted ${count} temporary admin user(s) ${EMAIL}`);
  if (fs.existsSync(PW_FILE)) fs.unlinkSync(PW_FILE);
  console.log(`removed ${PW_FILE}`);
} else {
  console.error("usage: node e2e/temp-admin.mjs create|delete");
  process.exit(2);
}
await prisma.$disconnect();
