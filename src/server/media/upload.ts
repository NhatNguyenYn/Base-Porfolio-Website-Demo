import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../db";
import { getStorage } from "../storage";
import type { MediaView } from "../queries/types";
import { optimizeImage, OptimizeError, normalizeFormat } from "./optimize";

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
 * Validates an uploaded image, optimizes it (resize + recompress, see
 * ./optimize.ts) and stores the optimized version: declared MIME type, real
 * decoded format (sharp), size cap, random storage key and an immutable
 * optimized file. The original upload bytes are never stored; the original
 * size is recorded on the media row for the compression audit trail.
 */
export async function storeImage(file: File, alt: string): Promise<MediaView> {
  const declared = ALLOWED_TYPES[file.type];
  if (!declared) {
    throw new UploadError("TYPE", `${file.name}: chỉ chấp nhận JPG, PNG, WebP, AVIF hoặc GIF.`);
  }
  if (file.size === 0) throw new UploadError("EMPTY", `${file.name} trống, không có nội dung.`);
  if (file.size > maxUploadBytes()) {
    throw new UploadError("SIZE", `${file.name} lớn hơn ${Math.round(maxUploadBytes() / (1024 * 1024))} MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const originalBytes = buffer.byteLength;

  let width: number | null = null;
  let height: number | null = null;
  try {
    // Cap decoded pixels so a small file cannot expand into a huge bitmap
    // (decompression bomb) during metadata reads and later variant generation.
    const metadata = await sharp(buffer, { limitInputPixels: 100_000_000 }).metadata();
    // The bytes must actually decode to the declared format; a .png full of
    // HTML is rejected here rather than stored and served. (Sharp reports
    // AVIF as "heif"; normalizeFormat maps it back to "avif".)
    if (normalizeFormat(metadata.format) !== declared.format) {
      throw new UploadError("TYPE", `${file.name}: nội dung file không khớp với định dạng đã khai báo.`);
    }
    width = metadata.width ?? null;
    height = metadata.height ?? null;
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("CORRUPT", `${file.name} không phải là ảnh đọc được.`);
  }

  // Optimize: resize to at most 1600px on the longest edge and recompress.
  // Already-optimized files come back unchanged (idempotent), so re-uploads
  // and the compressed batches are stored byte-identical.
  let optimized;
  try {
    optimized = await optimizeImage(buffer, file.type);
  } catch (error) {
    if (error instanceof OptimizeError) {
      throw new UploadError("CORRUPT", `${file.name} không phải là ảnh đọc được.`);
    }
    throw error;
  }

  const now = new Date();
  const prefix = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Client filenames are never used for storage keys.
  const key = `${prefix}/${randomUUID()}.${optimized.extension}`;
  const stored = await getStorage().put(key, optimized.buffer, optimized.mimeType);

  const title = file.name.replace(/\.[^.]+$/, "").slice(0, 200);
  const media = await prisma.media.create({
    data: {
      storageKey: stored.key,
      url: stored.url,
      filename: file.name.slice(0, 200),
      mimeType: optimized.mimeType,
      size: optimized.optimizedBytes,
      width: optimized.width ?? width,
      height: optimized.height ?? height,
      alt: alt || title,
      title,
      originalSize: originalBytes,
      optimizedAt: now,
      blurDataUrl: optimized.blurDataUrl,
    },
  });

  return {
    id: media.id,
    url: media.url,
    width: media.width,
    height: media.height,
    alt: media.alt ?? "",
    title: media.title ?? "",
    blurDataUrl: media.blurDataUrl ?? null,
  };
}
