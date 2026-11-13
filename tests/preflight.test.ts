import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "portfolio-preflight-"));
afterAll(() => rmSync(tempRoot, { recursive: true, force: true }));

function runPreflight(overrides: Record<string, string | undefined>): { status: number; output: string } {
  const env: NodeJS.ProcessEnv = {
    SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
    PATH: process.env.PATH ?? "",
    NODE_ENV: "production",
    APP_URL: "https://portfolio.example",
    AUTH_SECRET: "a".repeat(48),
    DATABASE_URL: "postgresql://portfolio_app:secret@db.internal:5432/portfolio?schema=public&sslmode=require&connection_limit=5",
    TRUSTED_PROXY_HOPS: "1",
    STORAGE_DRIVER: "local",
    UPLOAD_DIR: path.join(tempRoot, "uploads"),
    MAX_UPLOAD_MB: "10",
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  const result = spawnSync(process.execPath, ["scripts/preflight.mjs"], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

describe("production preflight", () => {
  it("passes a complete production environment", () => {
    const result = runPreflight({});
    expect(result.output).toContain("preflight passed");
    expect(result.status).toBe(0);
  });

  it("rejects an https-less APP_URL", () => {
    const result = runPreflight({ APP_URL: "http://portfolio.example" });
    expect(result.status).toBe(1);
    expect(result.output).toContain("APP_URL must use https://");
  });

  it("rejects an S3 driver without credentials", () => {
    const result = runPreflight({ STORAGE_DRIVER: "s3", UPLOAD_DIR: undefined });
    expect(result.status).toBe(1);
    expect(result.output).toContain("S3_BUCKET is required");
    expect(result.output).toContain("S3_ACCESS_KEY_ID is required");
  });

  it("rejects a relative upload directory", () => {
    const result = runPreflight({ UPLOAD_DIR: "./storage/uploads" });
    expect(result.status).toBe(1);
    expect(result.output).toContain("absolute path");
  });

  it("warns without failing on the default seed password", () => {
    const result = runPreflight({ SEED_ADMIN_PASSWORD: "ChangeMe!2026" });
    expect(result.status).toBe(0);
    expect(result.output).toContain("repository default");
  });

  it("never echoes a secret value", () => {
    const secret = "s3cr3t-value-that-must-not-appear";
    const result = runPreflight({ AUTH_SECRET: secret });
    expect(result.output).not.toContain(secret);
  });

  it("checks the local upload path in readiness", async () => {
    const { LocalStorageDriver } = await import("@/server/storage/local");
    const previous = process.env.UPLOAD_DIR;
    try {
      process.env.UPLOAD_DIR = path.join(tempRoot, "ready-uploads");
      const driver = new LocalStorageDriver();
      await expect(driver.healthCheck()).resolves.toBeUndefined();

      const file = path.join(tempRoot, "not-a-directory");
      writeFileSync(file, "x");
      process.env.UPLOAD_DIR = file;
      await expect(new LocalStorageDriver().healthCheck()).rejects.toBeTruthy();
    } finally {
      if (previous === undefined) delete process.env.UPLOAD_DIR;
      else process.env.UPLOAD_DIR = previous;
    }
  });

  it("requires S3 configuration before the driver can be built", async () => {
    const { S3StorageDriver } = await import("@/server/storage/s3");
    const previous = { ...process.env };
    try {
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;
      expect(() => new S3StorageDriver()).toThrow(/missing/);
    } finally {
      process.env = previous;
    }
  });
});
