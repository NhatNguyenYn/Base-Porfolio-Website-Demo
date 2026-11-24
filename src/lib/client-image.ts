/**
 * Browser-side image preparation before an upload dispatch.
 *
 * Why this exists: the site runs on Vercel, whose serverless functions
 * reject any request body over 4.5 MB (413 FUNCTION_PAYLOAD_TOO_LARGE) at
 * the platform layer — before the Server Action ever runs. A 1600×1600 PNG
 * photo (often 6+ MB) therefore fails every time, and the dispatch rejection
 * surfaces as a crashed picker instead of a friendly message. The server
 * pipeline (src/server/media/optimize.ts) already converts photo PNGs to
 * JPEG q82 at max 1600px; doing the same step in the browser first keeps
 * the POST under the platform cap, and the server re-optimizes idempotently.
 *
 * Only files over the request cap are touched; small files go through
 * byte-identical. GIFs (animation) and AVIF (inconsistent canvas support)
 * are never recompressed here — the server handles or rejects them.
 */

import { MAX_UPLOAD_REQUEST_BYTES } from "./upload-validation";

export const MAX_IMAGE_DIMENSION = 1600;
export const JPEG_QUALITY = 0.82;

const COMPRESSIBLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * EXIF orientation of a JPEG (1–8, 1 = upright), or 1 when unreadable.
 * Pure function over bytes — no DOM — so it is unit-testable in Node.
 * JPEGs store orientation in the APP1 (Exif) segment's TIFF header.
 */
export function readJpegOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return 1;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1 && size >= 8) {
      // "Exif\0\0" then a TIFF header: byte order, 42, IFD offset.
      if (view.getUint32(offset + 4) !== 0x45786966) return 1;
      const tiff = offset + 10;
      if (tiff + 8 > view.byteLength) return 1;
      const little = view.getUint16(tiff) === 0x4949;
      if (view.getUint16(tiff + 2, little) !== 42) return 1;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i += 1) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > view.byteLength) break;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          if (value >= 1 && value <= 8) return value;
        }
      }
      return 1;
    }
    if (marker === 0xda) return 1; // start of scan: no more metadata
    offset += 2 + size;
  }
  return 1;
}

/** Output dimensions for an EXIF orientation (90° rotations swap sides). */
function applyOrientationDimensions(
  orientation: number,
  width: number,
  height: number,
): { width: number; height: number } {
  const swap = [5, 6, 7, 8].includes(orientation);
  return { width: swap ? height : width, height: swap ? width : height };
}

/** Canvas transform for an EXIF orientation (mirrors Sharp's rotate()). */
function applyOrientation(
  context: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number,
): void {
  const { width: outWidth, height: outHeight } = applyOrientationDimensions(orientation, width, height);
  switch (orientation) {
    case 2:
      context.translate(outWidth, 0);
      context.scale(-1, 1);
      break;
    case 3:
      context.translate(outWidth, outHeight);
      context.rotate(Math.PI);
      break;
    case 4:
      context.translate(0, outHeight);
      context.scale(1, -1);
      break;
    case 5:
      context.rotate(0.5 * Math.PI);
      context.scale(1, -1);
      break;
    case 6:
      context.translate(outWidth, 0);
      context.rotate(0.5 * Math.PI);
      break;
    case 7:
      context.translate(outWidth, outHeight);
      context.rotate(0.5 * Math.PI);
      context.scale(-1, 1);
      break;
    case 8:
      context.translate(0, outHeight);
      context.rotate(-0.5 * Math.PI);
      break;
    default:
      break;
  }
}

function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      createImageBitmap(image).then(resolve, reject);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode image"));
    }, type, quality);
  });
}

function hasAlpha(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  // Sample every 16th pixel: transparency in artwork PNGs is never a
  // single-pixel effect, and a full 1600×1600 scan is 10 MB of pixels.
  const data = context.getImageData(0, 0, width, height).data;
  for (let i = 3; i < data.length; i += 64) {
    if (data[i] < 255) return true;
  }
  return false;
}

/**
 * Returns the file ready to dispatch: the original when it already fits the
 * request cap, otherwise a browser-compressed copy (max 1600px, JPEG q82 —
 * same as the server pipeline; PNGs with transparency stay PNG). Never
 * throws: on any failure the original file is returned and the server
 * validates/rejects it with a friendly message instead.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!COMPRESSIBLE_TYPES.includes(file.type) || file.size <= MAX_UPLOAD_REQUEST_BYTES) {
    return file;
  }
  try {
    const orientation = file.type === "image/jpeg" ? readJpegOrientation(await file.arrayBuffer()) : 1;
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const drawWidth = Math.max(1, Math.round(bitmap.width * scale));
    const drawHeight = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    const { width, height } = applyOrientationDimensions(orientation, drawWidth, drawHeight);
    // Setting width/height resets the context, so size first, then transform.
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    applyOrientation(context, orientation, drawWidth, drawHeight);
    context.drawImage(bitmap, 0, 0, drawWidth, drawHeight);
    bitmap.close();
    const keepPng = file.type === "image/png" && hasAlpha(context, width, height);
    const blob = await toBlob(canvas, keepPng ? "image/png" : "image/jpeg", keepPng ? undefined : JPEG_QUALITY);
    if (blob.size >= file.size) return file;
    return new File([blob], file.name, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
