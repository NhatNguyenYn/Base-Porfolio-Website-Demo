import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Admin account used by the E2E suite.
 *
 * Default: the seeded account admin@example.com with the default seed
 * literal from scripts/preflight.mjs:16.
 *
 * E2E FINDING (2026-11-14): the password stored for admin@example.com in
 * the local `portfolio` DB matches NEITHER the preflight default literal
 * NOR the SEED_ADMIN_PASSWORD recorded in the baseline seed command
 * (both verified with bcrypt.compare against the stored hash), so login
 * as the seeded account is blocked until the password is re-issued.
 * The admin suite therefore runs against a temporary E2E-only SUPER_ADMIN
 * (E2E_ADMIN_EMAIL, created in the local scratch DB by scripts/e2e-admin
 * and deleted after the run). Override with env:
 *   E2E_ADMIN_EMAIL — admin email (default admin@example.com)
 *   E2E_ADMIN_PASSWORD_FILE — file holding the password (never logged)
 */
export const ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL || "admin@example.com";

/** Default seed literal from scripts/preflight.mjs:16 (read at runtime). */
export function readSeedPassword(): string {
  const src = fs.readFileSync(
    path.resolve(__dirname, "..", "scripts", "preflight.mjs"),
    "utf8",
  );
  const m = src.match(/DEFAULT_SEED_PASSWORD\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("DEFAULT_SEED_PASSWORD literal not found in scripts/preflight.mjs");
  return m[1];
}

/** Password for ADMIN_EMAIL: temp-account file when set, else the seed literal. */
export function readAdminPassword(): string {
  const file = process.env.E2E_ADMIN_PASSWORD_FILE;
  if (file) return fs.readFileSync(file, "utf8").trim();
  return readSeedPassword();
}

let prisma: PrismaClient | null = null;
export function db(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.DATABASE_URL ||
            "postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public",
        },
      },
    });
  }
  return prisma;
}

/** Slugs of seeded public content (verified against the local DB). */
export const SEED = {
  project: "aurora-design-system",
  artwork: "after-the-rain",
  collection: "noise-and-light",
  articleDefault: "design-systems-start-before-components",
  article2: "a-day-of-deep-work",
  category: "technology",
} as const;
