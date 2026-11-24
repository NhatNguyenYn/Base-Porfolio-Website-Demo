/**
 * EXIF orientation parsing (browser upload compression, 24/11).
 *
 * The browser compresses large photos before dispatch (Vercel rejects any
 * request body over 4.5 MB), and canvas output strips EXIF — so the
 * orientation must be read from the JPEG bytes and applied as a canvas
 * transform, or a rotated phone photo would be stored sideways. The parser
 * itself is pure bytes, so it is tested here in Node; the canvas half is
 * covered by the live browser check (upload a 1600×1600 PNG → success).
 */
import { describe, expect, it } from "vitest";
import { readJpegOrientation } from "@/lib/client-image";

/** Minimal JPEG: SOI + APP1 Exif (one orientation entry) + SOS. */
function jpegWithOrientation(orientation: number | null, littleEndian = true): ArrayBuffer {
  const bytes: number[] = [0xff, 0xd8];
  if (orientation !== null) {
    const exif: number[] = [];
    const push16 = (value: number) => {
      if (littleEndian) exif.push(value & 0xff, (value >> 8) & 0xff);
      else exif.push((value >> 8) & 0xff, value & 0xff);
    };
    const push32 = (value: number) => {
      if (littleEndian) exif.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
      else exif.push((value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
    };
    exif.push(0x45, 0x78, 0x69, 0x66, 0x00, 0x00); // "Exif\0\0"
    exif.push(...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d])); // "II" / "MM"
    push16(42);
    push32(8);
    push16(1); // one IFD entry
    push16(0x0112); // orientation tag
    push16(3); // SHORT
    push32(1); // count
    push16(orientation);
    push16(0);
    push32(0); // next IFD offset
    const size = exif.length + 2;
    bytes.push(0xff, 0xe1, (size >> 8) & 0xff, size & 0xff, ...exif);
  }
  bytes.push(0xff, 0xda, 0x00, 0x08); // SOS
  return new Uint8Array(bytes).buffer;
}

describe("readJpegOrientation", () => {
  it("reads orientation 6 (little-endian)", () => {
    expect(readJpegOrientation(jpegWithOrientation(6))).toBe(6);
  });

  it("reads orientation 3 (big-endian)", () => {
    expect(readJpegOrientation(jpegWithOrientation(3, false))).toBe(3);
  });

  it("returns 1 when there is no Exif segment", () => {
    expect(readJpegOrientation(jpegWithOrientation(null))).toBe(1);
  });

  it("returns 1 for non-JPEG bytes", () => {
    expect(readJpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBe(1);
  });

  it("returns 1 for an out-of-range orientation value", () => {
    expect(readJpegOrientation(jpegWithOrientation(9))).toBe(1);
  });
});
