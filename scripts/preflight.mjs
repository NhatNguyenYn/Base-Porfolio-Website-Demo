#!/usr/bin/env node
/**
 * Production environment preflight.
 *
 * Reads only `process.env` (never `.env`) and never prints a value, so it can be
 * run on a server without leaking credentials into logs. Exits 1 when any
 * error-level check fails; warnings do not block the deploy but should be read.
 *
 *   NODE_ENV=production node scripts/preflight.mjs
 *
 * Run it after loading the production environment but before `next build`.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_SEED_PASSWORD = "ChangeMe!2026";
const PLACEHOLDER = /replace|change|example|placeholder|your[-_]/i;

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isHttpsUrl(value) {
  const url = parseUrl(value);
  return Boolean(url && url.protocol === "https:");
}

function parsePositiveInt(value) {
  if (!/^\d+$/.test(String(value ?? ""))) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ errors: string[]; warnings: string[]; notes: string[] }}
 */
export function validateEnv(env) {
  const errors = [];
  const warnings = [];
  const notes = [];

  if (env.NODE_ENV !== "production") {
    errors.push("NODE_ENV must be production for a production preflight.");
  }

  // ---------------------------------------------------------------- app URL
  if (!env.APP_URL) {
    errors.push("APP_URL is missing.");
  } else if (!parseUrl(env.APP_URL)) {
    errors.push("APP_URL is not a valid absolute URL.");
  } else if (!isHttpsUrl(env.APP_URL)) {
    errors.push("APP_URL must use https:// in production (cookies are Secure).");
  } else if (env.APP_URL.endsWith("/")) {
    warnings.push("APP_URL has a trailing slash; canonical URLs will contain a double slash.");
  }

  // --------------------------------------------------------------- database
  if (!env.DATABASE_URL) {
    errors.push("DATABASE_URL is missing.");
  } else if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    errors.push("DATABASE_URL must be a PostgreSQL connection string.");
  } else {
    const url = parseUrl(env.DATABASE_URL.replace(/^postgresql:\/\//, "postgres://"));
    const host = url?.hostname ?? "";
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!isLocal && url && !url.searchParams.get("sslmode")) {
      warnings.push("DATABASE_URL points to a remote host without sslmode; use sslmode=require when the database supports TLS.");
    }
    if (url && !url.searchParams.get("connection_limit")) {
      notes.push("DATABASE_URL has no connection_limit; set it to match the database plan (for example 5-10).");
    }
  }

  // ----------------------------------------------------------------- secret
  if (!env.AUTH_SECRET) {
    errors.push("AUTH_SECRET is missing.");
  } else if (env.AUTH_SECRET.length < 32) {
    errors.push("AUTH_SECRET must be at least 32 characters.");
  } else if (PLACEHOLDER.test(env.AUTH_SECRET)) {
    errors.push("AUTH_SECRET still looks like a placeholder value.");
  }

  // ----------------------------------------------------------- proxy trust
  if (env.TRUSTED_PROXY_HOPS === undefined || env.TRUSTED_PROXY_HOPS === "") {
    errors.push("TRUSTED_PROXY_HOPS is missing; set it to the number of proxies you operate.");
  } else if (!/^\d+$/.test(env.TRUSTED_PROXY_HOPS) || Number(env.TRUSTED_PROXY_HOPS) > 10) {
    errors.push("TRUSTED_PROXY_HOPS must be an integer between 0 and 10.");
  } else if (env.TRUSTED_PROXY_HOPS === "0") {
    warnings.push("TRUSTED_PROXY_HOPS=0 means X-Forwarded-For/X-Real-IP are ignored and every visitor shares one rate-limit bucket.");
  }

  if (env.HSTS_INCLUDE_SUBDOMAINS !== undefined && !/^(true|false)$/.test(env.HSTS_INCLUDE_SUBDOMAINS)) {
    errors.push("HSTS_INCLUDE_SUBDOMAINS must be true or false.");
  } else if (env.HSTS_INCLUDE_SUBDOMAINS === "true") {
    warnings.push("HSTS includeSubDomains is on: confirm every subdomain is HTTPS-only before deploying.");
  }

  // ---------------------------------------------------------------- storage
  const driver = (env.STORAGE_DRIVER ?? "").toLowerCase();
  if (driver !== "local" && driver !== "s3") {
    errors.push('STORAGE_DRIVER must be "local" or "s3".');
  } else if (driver === "local") {
    if (!env.UPLOAD_DIR) {
      errors.push("UPLOAD_DIR is required when STORAGE_DRIVER=local.");
    } else if (!path.isAbsolute(env.UPLOAD_DIR)) {
      errors.push("UPLOAD_DIR must be an absolute path on a persistent volume (not inside the release directory).");
    }
  } else {
    for (const key of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_BASE_URL"]) {
      if (!env[key]) errors.push(`${key} is required when STORAGE_DRIVER=s3.`);
    }
    if (env.S3_PUBLIC_BASE_URL && !isHttpsUrl(env.S3_PUBLIC_BASE_URL)) {
      errors.push("S3_PUBLIC_BASE_URL must use https:// so media is not mixed content.");
    }
  }

  if (env.MAX_UPLOAD_MB !== undefined && !parsePositiveInt(env.MAX_UPLOAD_MB)) {
    errors.push("MAX_UPLOAD_MB must be a positive integer.");
  }

  // ------------------------------------------------------- one-time values
  if (env.SETUP_TOKEN) {
    warnings.push("SETUP_TOKEN is set; remove it from the environment after the first admin account exists.");
  }

  if (env.SEED_ADMIN_PASSWORD) {
    if (env.SEED_ADMIN_PASSWORD === DEFAULT_SEED_PASSWORD) {
      warnings.push("SEED_ADMIN_PASSWORD is still the repository default; rotate the admin password before go-live.");
    }
    warnings.push("SEED_ADMIN_PASSWORD is set; remove it after seeding (seed never overwrites an existing password).");
  }

  if (!env.APP_URL) {
    notes.push("Without APP_URL, canonical links, sitemap and cookies cannot be verified.");
  }

  return { errors, warnings, notes };
}

function run() {
  const { errors, warnings, notes } = validateEnv(process.env);
  for (const message of errors) console.error(`[error] ${message}`);
  for (const message of warnings) console.warn(`[warn]  ${message}`);
  for (const message of notes) console.log(`[note]  ${message}`);

  if (errors.length > 0) {
    console.error(`\npreflight failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
    process.exit(1);
  }
  console.log(`\npreflight passed: 0 errors, ${warnings.length} warning(s)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
