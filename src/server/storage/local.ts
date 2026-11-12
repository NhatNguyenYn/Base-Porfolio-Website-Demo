import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver, StoredObject, StoredResult } from "./index";

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
  txt: "text/plain",
  pdf: "application/pdf",
  json: "application/json",
  mp4: "video/mp4",
  webm: "video/webm",
};

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Validates a storage key and returns it without leading slashes.
 * Rejects path traversal (`..`), empty segments, backslashes and any
 * character outside `[A-Za-z0-9._/-]`. A leading slash is stripped, so
 * `/etc/passwd` becomes the harmless relative key `etc/passwd`.
 */
export function assertSafeKey(key: string): string {
  const cleaned = key.replace(/^\/+/, "");
  if (!cleaned || !SAFE_KEY.test(cleaned)) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  if (cleaned.split("/").some((part) => part === ".." || part === "." || part === "")) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return cleaned;
}

/**
 * Stores objects as files under UPLOAD_DIR (default `./storage/uploads`).
 * Keys are validated with assertSafeKey, so a key can never escape the
 * upload directory. Files are served back by `/media/[...key]`.
 */
export class LocalStorageDriver implements StorageDriver {
  private readonly dir: string;
  private readonly publicBaseUrl: string;

  constructor(
    uploadDir = process.env.UPLOAD_DIR || "./storage/uploads",
    publicBaseUrl = process.env.MEDIA_PUBLIC_BASE_URL || "",
  ) {
    this.dir = path.resolve(uploadDir);
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, "");
  }

  urlFor(key: string): string {
    const safe = assertSafeKey(key);
    return this.publicBaseUrl ? `${this.publicBaseUrl}/${safe}` : `/media/${safe}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredResult> {
    const safe = assertSafeKey(key);
    const filePath = path.join(this.dir, ...safe.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return { key: safe, url: this.urlFor(safe), bytes: body.byteLength, contentType };
  }

  async get(key: string): Promise<StoredObject | null> {
    const safe = assertSafeKey(key);
    try {
      const body = await readFile(path.join(this.dir, ...safe.split("/")));
      return { body, contentType: contentTypeFor(safe) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const safe = assertSafeKey(key);
    await unlink(path.join(this.dir, ...safe.split("/"))).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
