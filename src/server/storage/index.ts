import "server-only";
import { LocalStorageDriver } from "./local";
import { S3StorageDriver } from "./s3";
import type { StorageDriver } from "./types";

const globalStore = globalThis as unknown as { __storage?: StorageDriver };

export function getStorage(): StorageDriver {
  if (globalStore.__storage) return globalStore.__storage;

  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  const storage: StorageDriver = driver === "s3" ? new S3StorageDriver() : new LocalStorageDriver();
  globalStore.__storage = storage;
  return storage;
}

/**
 * Readiness probe for the configured driver: the local driver verifies that the
 * upload directory is writable, the S3 driver checks the bucket (HeadBucket).
 * Errors stay internal; `/api/ready` only reports a coarse status.
 */
export async function storageHealth(): Promise<void> {
  await getStorage().healthCheck();
}

export type { StorageDriver };
export { assertSafeKey } from "./local";
