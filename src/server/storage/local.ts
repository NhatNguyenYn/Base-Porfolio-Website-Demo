import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RetrievedObject, StorageDriver, StoredObject } from "./types";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
};

/** Rejects traversal and keeps keys inside the configured upload root. */
export function assertSafeKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\0")) {
    throw new Error("Invalid storage key");
  }
  if (!/^[a-zA-Z0-9/._-]+$/.test(normalized)) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;
  private readonly root: string;
  private readonly publicBase: string;

  constructor() {
    this.root = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./storage/uploads");
    this.publicBase = (process.env.MEDIA_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  }

  private filePath(key: string): string {
    const safe = assertSafeKey(key);
    const full = path.resolve(this.root, safe);
    if (!full.startsWith(this.root)) throw new Error("Invalid storage path");
    return full;
  }

  urlFor(key: string): string {
    const encoded = assertSafeKey(key)
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `${this.publicBase}/media/${encoded}`;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<StoredObject> {
    const target = this.filePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return { key, url: this.urlFor(key), bytes: body.byteLength };
  }

  async get(key: string): Promise<RetrievedObject | null> {
    try {
      const target = this.filePath(key);
      const body = await readFile(target);
      const extension = path.extname(target).slice(1).toLowerCase();
      return { body, contentType: MIME_BY_EXTENSION[extension] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  /** Fails when the upload volume is missing, not a directory or not writable. */
  async healthCheck(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await access(this.root, 2 /* W_OK */);
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.filePath(key));
    } catch {
      // Already gone: deletion is idempotent.
    }
  }
}
