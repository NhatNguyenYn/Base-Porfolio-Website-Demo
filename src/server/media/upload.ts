import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../db";
import { getStorage } from "../storage";
import type { MediaView } from "../queries/types";

/** SVG is deliberately not accepted: it can execute script when served inline. */
const ALLOWED_TYPES: Record<string, { extension: string; format: string }> = {
  "image/jpeg": { extension: "jpg", format: "jpeg" },
  "image/png": { extension: "png", format: "png" },
  "image/webp": { extension: "webp", format: "webp" },
  "image/avif": { extension: "avif", format: "avif" },
  "image/gif": { extension: "gif", format: "gif" },
};

export class UploadError extends Error {
  readonly code: "TYPE" | "SIZE" | "EMPTY" | "CORRUPT";

  constructor(code: UploadError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export function maxUploadBytes(): number {
  const megabytes = Number.parseInt(process.env.MAX_UPLOAD_MB ?? "10", 10) || 10;
  return megabytes * 1024 * 1024;
}

/**
 * Validates an uploaded image and stores it: declared MIME type, real decoded
 * format (sharp), size cap, random storage key and an immutable original.
 */
export async function storeImage(file: File, alt: string): Promise<MediaView> {
  const declared = ALLOWED_TYPES[file.type];
  if (!declared) {
    throw new UploadError("TYPE", `${file.name}: only JPG, PNG, WebP, AVIF or GIF are accepted.`);
  }
  if (file.size === 0) throw new UploadError("EMPTY", `${file.name} is empty.`);
  if (file.size > maxUploadBytes()) {
    throw new UploadError("SIZE", `${file.name} is larger than ${Math.round(maxUploadBytes() / (1024 * 1024))} MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let width: number | null = null;
  let height: number | null = null;
  try {
    const metadata = await sharp(buffer).metadata();
    // The bytes must actually decode to the declared format; a .png full of
    // HTML is rejected here rather than stored and served.
    if (metadata.format !== declared.format) {
      throw new UploadError("TYPE", `${file.name}: file content does not match its declared type.`);
    }
    width = metadata.width ?? null;
    height = metadata.height ?? null;
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("CORRUPT", `${file.name} is not a readable image.`);
  }

  const now = new Date();
  const prefix = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Client filenames are never used for storage keys.
  const key = `${prefix}/${randomUUID()}.${declared.extension}`;
  const stored = await getStorage().put(key, buffer, file.type);

  const title = file.name.replace(/\.[^.]+$/, "").slice(0, 200);
  const media = await prisma.media.create({
    data: {
      storageKey: stored.key,
      url: stored.url,
      filename: file.name.slice(0, 200),
      mimeType: file.type,
      size: file.size,
      width,
      height,
      alt: alt || title,
      title,
    },
  });

  return {
    id: media.id,
    url: media.url,
    width: media.width,
    height: media.height,
    alt: media.alt ?? "",
    title: media.title ?? "",
  };
}
