import "server-only";
import { LocalStorageDriver } from "./local";
import { S3StorageDriver } from "./s3";

export type StoredObject = {
  body: Buffer;
  contentType: string;
};

export type StoredResult = {
  key: string;
  url: string;
  bytes: number;
  contentType: string;
};

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<StoredResult>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  urlFor(key: string): string;
}

let cached: StorageDriver | null = null;

/**
 * Returns the configured storage driver: local disk by default
 * (STORAGE_DRIVER="local", files under UPLOAD_DIR, served at /media/*),
 * or S3-compatible storage when STORAGE_DRIVER="s3".
 */
export function getStorage(): StorageDriver {
  if (cached) return cached;
  cached =
    (process.env.STORAGE_DRIVER || "local").toLowerCase() === "s3"
      ? new S3StorageDriver()
      : new LocalStorageDriver();
  return cached;
}
