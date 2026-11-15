import sharp, { type Metadata, type OutputInfo } from "sharp";

/**
 * Image optimization engine (no database, no storage — pure Sharp).
 *
 * Rules (see docs/IMAGE_OPTIMIZATION_REPORT.md):
 * - Resize so the longest edge is at most 1600px; never upscale.
 * - JPEG q82 / WebP q82 / AVIF q60; PNG photos (no alpha) become JPEG q82,
 *   PNGs with transparency stay PNG (compressed); GIFs are left untouched
 *   (an animated GIF must never be flattened into a still image).
 * - EXIF orientation is applied (`rotate()`); all other metadata (including
 *   GPS) is stripped — Sharp drops metadata unless `withMetadata()` is used.
 * - The optimized version is only adopted when it is actually smaller than
 *   the input. Already-optimized files (e.g. the compressed batches) are
 *   returned unchanged, so re-uploading them is idempotent.
 * - A 16px WebP blur placeholder is still generated (legacy: the UI used
 *   `placeholder="blur"` until the skeleton loading frame replaced it);
 *   it never fails the optimization itself.
 */

export const MAX_IMAGE_DIMENSION = 1600;
export const JPEG_QUALITY = 82;
export const WEBP_QUALITY = 82;
export const AVIF_QUALITY = 60;

export class OptimizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptimizeError";
  }
}

export type OptimizedImage = {
  /** Bytes to store (the optimized buffer, or the original when unchanged). */
  buffer: Buffer;
  mimeType: string;
  extension: string;
  width: number | null;
  height: number | null;
  originalBytes: number;
  optimizedBytes: number;
  /** False when the input was kept as-is (already optimal, GIF, or not smaller). */
  changed: boolean;
  /** `data:image/webp;base64,…` 16px placeholder, or null when it could not be made. */
  blurDataUrl: string | null;
};

const MIME_BY_FORMAT: Record<string, { mimeType: string; extension: string }> = {
  jpeg: { mimeType: "image/jpeg", extension: "jpg" },
  png: { mimeType: "image/png", extension: "png" },
  webp: { mimeType: "image/webp", extension: "webp" },
  avif: { mimeType: "image/avif", extension: "avif" },
  // Sharp reports AVIF files as "heif" (AVIF is a HEIF container).
  heif: { mimeType: "image/avif", extension: "avif" },
  gif: { mimeType: "image/gif", extension: "gif" },
};

/** Normalizes Sharp's format name to the format used by the upload allow-list. */
export function normalizeFormat(format: string | undefined): string | undefined {
  return format === "heif" ? "avif" : format;
}

async function makeBlur(input: Buffer): Promise<string | null> {
  try {
    const tiny = await sharp(input)
      .rotate()
      .resize(16, 16, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 40 })
      .toBuffer();
    return `data:image/webp;base64,${tiny.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function optimizeImage(input: Buffer, mimeType: string): Promise<OptimizedImage> {
  const originalBytes = input.byteLength;
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: 100_000_000 }).metadata();
  } catch {
    throw new OptimizeError("File is not a readable image.");
  }

  const format = normalizeFormat(metadata.format);
  const target = format ? MIME_BY_FORMAT[format] : undefined;
  if (!format || !target) {
    throw new OptimizeError(`Unsupported image format: ${format ?? "unknown"}.`);
  }
  // The declared MIME type must match the decoded bytes; a mismatch is
  // rejected upstream by storeImage, but never silently trusted here either.
  if (mimeType && mimeType !== target.mimeType && !(mimeType === "image/jpg" && format === "jpeg")) {
    throw new OptimizeError(`File content (${target.mimeType}) does not match its declared type (${mimeType}).`);
  }

  const unchanged = async (): Promise<OptimizedImage> => {
    // Stored dimensions ignore EXIF orientation, but a 90° rotation swaps
    // them: report the dimensions as displayed, or the gallery aspect ratio
    // (and the admin's "W × H") would be wrong for rotated phone photos.
    const swapsDimensions = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
    const width = metadata.width ?? null;
    const height = metadata.height ?? null;
    return {
      buffer: input,
      mimeType: target.mimeType,
      extension: target.extension,
      width: swapsDimensions ? height : width,
      height: swapsDimensions ? width : height,
      originalBytes,
      optimizedBytes: originalBytes,
      changed: false,
      blurDataUrl: format === "gif" ? null : await makeBlur(input),
    };
  };

  // Animated (or any) GIFs are stored as-is: converting would destroy the
  // animation, and GIFs in this project are tiny UI assets, not artwork.
  if (format === "gif") return unchanged();

  const pipeline = sharp(input, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: "inside", withoutEnlargement: true });

  let output: { mimeType: string; extension: string };
  if (format === "jpeg") {
    pipeline.jpeg({ quality: JPEG_QUALITY, progressive: true });
    output = MIME_BY_FORMAT.jpeg;
  } else if (format === "png") {
    if (metadata.hasAlpha) {
      pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
      output = MIME_BY_FORMAT.png;
    } else {
      // A photo saved as PNG is just a very large JPEG: convert it.
      pipeline.jpeg({ quality: JPEG_QUALITY, progressive: true });
      output = MIME_BY_FORMAT.jpeg;
    }
  } else if (format === "webp") {
    pipeline.webp({ quality: WEBP_QUALITY });
    output = MIME_BY_FORMAT.webp;
  } else {
    // avif
    pipeline.avif({ quality: AVIF_QUALITY });
    output = MIME_BY_FORMAT.avif;
  }

  let optimized: Buffer;
  let info: OutputInfo;
  try {
    ({ data: optimized, info } = await pipeline.toBuffer({ resolveWithObject: true }));
  } catch {
    throw new OptimizeError("File could not be optimized.");
  }

  // Only adopt the optimized version when it is actually smaller. This
  // keeps already-compressed uploads byte-identical (idempotent).
  if (optimized.byteLength >= originalBytes) return unchanged();

  return {
    buffer: optimized,
    mimeType: output.mimeType,
    extension: output.extension,
    width: info.width,
    height: info.height,
    originalBytes,
    optimizedBytes: optimized.byteLength,
    changed: true,
    blurDataUrl: await makeBlur(input),
  };
}
