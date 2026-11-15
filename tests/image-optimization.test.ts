// Image optimization engine tests — pure Sharp, no database.
// Covers the Master Prompt's quality rules: resize cap, format handling,
// idempotency for already-optimized files, GIF passthrough, EXIF rotation
// and corrupt-input rejection.
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  MAX_IMAGE_DIMENSION,
  OptimizeError,
  optimizeImage,
} from "@/server/media/optimize";

async function makeJpeg(width: number, height: number, quality = 95): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 60, b: 200 } },
  })
    .jpeg({ quality })
    .toBuffer();
}

async function makePng(width: number, height: number, alpha: boolean): Promise<Buffer> {
  const channels = alpha ? 4 : 3;
  return sharp({
    create: { width, height, channels, background: { r: 30, g: 140, b: 90, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
}

describe("optimizeImage", () => {
  it("resizes a large JPEG to 1600px and shrinks it", async () => {
    const input = await makeJpeg(2400, 1800, 95);
    const out = await optimizeImage(input, "image/jpeg");
    expect(out.changed).toBe(true);
    expect(out.width).toBe(MAX_IMAGE_DIMENSION);
    expect(out.height).toBe(1200);
    expect(out.mimeType).toBe("image/jpeg");
    expect(out.extension).toBe("jpg");
    expect(out.optimizedBytes).toBeLessThan(out.originalBytes);
    expect(out.blurDataUrl?.startsWith("data:image/webp;base64,")).toBe(true);
  });

  it("never upscales a small image", async () => {
    const input = await makeJpeg(400, 300, 90);
    const out = await optimizeImage(input, "image/jpeg");
    expect(out.width).toBe(400);
    expect(out.height).toBe(300);
    expect(out.optimizedBytes).toBeLessThanOrEqual(out.originalBytes);
  });

  it("converts a PNG photo without alpha to JPEG", async () => {
    const input = await makePng(2000, 1200, false);
    const out = await optimizeImage(input, "image/png");
    expect(out.changed).toBe(true);
    expect(out.mimeType).toBe("image/jpeg");
    expect(out.extension).toBe("jpg");
    expect(out.optimizedBytes).toBeLessThan(out.originalBytes);
  });

  it("keeps PNGs with transparency as PNG", async () => {
    const input = await makePng(1200, 900, true);
    const out = await optimizeImage(input, "image/png");
    expect(out.mimeType).toBe("image/png");
    expect(out.extension).toBe("png");
    expect(out.optimizedBytes).toBeLessThanOrEqual(out.originalBytes);
  });

  it("leaves GIFs untouched (animation must survive)", async () => {
    const input = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 200, b: 0 } },
    })
      .gif()
      .toBuffer();
    const out = await optimizeImage(input, "image/gif");
    expect(out.changed).toBe(false);
    expect(out.mimeType).toBe("image/gif");
    expect(out.buffer.equals(input)).toBe(true);
  });

  it("recompresses WebP and AVIF", async () => {
    const webp = await sharp({
      create: { width: 1800, height: 1200, channels: 3, background: { r: 10, g: 90, b: 160 } },
    })
      .webp({ quality: 95 })
      .toBuffer();
    const webpOut = await optimizeImage(webp, "image/webp");
    expect(webpOut.mimeType).toBe("image/webp");
    expect(webpOut.optimizedBytes).toBeLessThanOrEqual(webpOut.originalBytes);

    const avif = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 40, b: 80 } },
    })
      .avif({ quality: 90 })
      .toBuffer();
    const avifOut = await optimizeImage(avif, "image/avif");
    expect(avifOut.mimeType).toBe("image/avif");
    expect(avifOut.optimizedBytes).toBeLessThanOrEqual(avifOut.originalBytes);
  });

  it("applies EXIF orientation so dimensions are correct", async () => {
    const input = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg({ quality: 90 })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await optimizeImage(input, "image/jpeg");
    // Orientation 6 means "rotate 90° clockwise": 1200×800 becomes 800×1200.
    expect(out.width).toBe(800);
    expect(out.height).toBe(1200);
  });

  it("returns an already-optimized file unchanged (idempotent)", async () => {
    const once = await optimizeImage(await makeJpeg(1600, 1200, 82), "image/jpeg");
    const input = once.changed ? once.buffer : await makeJpeg(1600, 1200, 82);
    const twice = await optimizeImage(input, "image/jpeg");
    expect(twice.optimizedBytes).toBeLessThanOrEqual(twice.originalBytes);
    // A second pass must not grow the file or change its dimensions.
    expect(twice.width).toBe(1600);
    expect(twice.height).toBe(1200);
  });

  it("rejects corrupt input and declared-type mismatches", async () => {
    await expect(optimizeImage(Buffer.from("not an image at all"), "image/jpeg")).rejects.toBeInstanceOf(
      OptimizeError,
    );
    const jpeg = await makeJpeg(100, 100, 90);
    await expect(optimizeImage(jpeg, "image/png")).rejects.toBeInstanceOf(OptimizeError);
  });

  it("keeps the blur placeholder tiny", async () => {
    const out = await optimizeImage(await makeJpeg(1600, 1200, 90), "image/jpeg");
    expect(out.blurDataUrl).toBeTruthy();
    expect(out.blurDataUrl!.length).toBeLessThan(3000);
  });
});
