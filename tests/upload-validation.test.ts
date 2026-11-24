/**
 * Client-side upload validation (collection cover crash fix, 24/11).
 *
 * The picker checks files here before dispatching the Server Action: a file
 * over the action body limit (12 MB) never reaches the action — the POST is
 * rejected and the dispatch rejects, which React shows as a full-page
 * "Application error". These rules mirror the server caps in
 * `src/server/media/upload.ts` (10 MB, JPG/PNG/WebP/AVIF/GIF) and the
 * 10-file cap in `uploadMediaAction`, so a bad file gets a Vietnamese
 * message instead of a crashed page.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  validateUploadFiles,
} from "@/lib/upload-validation";

const good = { name: "anh.jpg", size: 500_000, type: "image/jpeg" };

describe("validateUploadFiles", () => {
  it("accepts a normal image", () => {
    expect(validateUploadFiles([good])).toBeNull();
  });

  it("asks for at least one file", () => {
    expect(validateUploadFiles([])).toBe("Hãy chọn ít nhất một ảnh.");
  });

  it("caps the batch at 10 files", () => {
    const files = Array.from({ length: MAX_UPLOAD_FILES + 1 }, (_, index) => ({
      ...good,
      name: `anh-${index}.jpg`,
    }));
    expect(validateUploadFiles(files)).toBe("Mỗi lần tải lên tối đa 10 ảnh.");
  });

  it("rejects a non-image type", () => {
    const result = validateUploadFiles([{ name: "tai-lieu.pdf", size: 100_000, type: "application/pdf" }]);
    expect(result).toContain("chỉ chấp nhận JPG, PNG, WebP, AVIF hoặc GIF");
  });

  it("rejects an empty file", () => {
    const result = validateUploadFiles([{ ...good, size: 0 }]);
    expect(result).toContain("trống, không có nội dung");
  });

  it("rejects a file over 10 MB before it is dispatched", () => {
    const result = validateUploadFiles([{ ...good, size: MAX_UPLOAD_BYTES + 1 }]);
    expect(result).toContain("lớn hơn 10 MB");
  });

  it("reports the first failing file", () => {
    const result = validateUploadFiles([
      good,
      { name: "anh-to.png", size: MAX_UPLOAD_BYTES + 1, type: "image/png" },
    ]);
    expect(result).toContain("anh-to.png");
  });
});
