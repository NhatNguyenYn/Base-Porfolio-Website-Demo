/**
 * Client-side upload validation, mirroring the server rules in
 * `src/server/media/upload.ts` (`storeImage`) and `uploadMediaAction`.
 *
 * Why this exists: the picker dispatches the upload as a Server Action. A
 * file the server would reject still travels to the server first — and a
 * request over the platform body limit never reaches the action at all: the
 * POST is rejected and the dispatch rejects, which React surfaces as a
 * full-page "Application error" instead of an inline message. Checking here
 * first keeps bad files from ever being dispatched.
 *
 * Two caps apply, and the smaller one wins:
 * - Per file: 10 MB, the server cap (`MAX_UPLOAD_MB` env, default 10).
 * - Per request (TOTAL of all files): 4 MB. The site runs on Vercel, whose
 *   serverless functions reject any request body over 4.5 MB (413
 *   FUNCTION_PAYLOAD_TOO_LARGE) at the platform layer, before the action
 *   runs — `bodySizeLimit` in next.config.ts cannot raise it. The browser
 *   pre-compresses large photos first (see `compressImageForUpload` in
 *   ./client-image.ts), so the total check normally passes; it is the
 *   backstop for batches that are still too big.
 *
 * Keep the numbers in sync with the server: MAX_UPLOAD_MB with
 * `MAX_UPLOAD_MB` (default 10) in `storeImage`, MAX_UPLOAD_FILES with the
 * 10-file cap in `uploadMediaAction`.
 */

export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
/** Safe margin under Vercel's 4.5 MB platform cap, including multipart overhead. */
export const MAX_UPLOAD_REQUEST_BYTES = 4 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export type UploadCandidate = {
  name: string;
  size: number;
  type: string;
};

/** Vietnamese error message for the first failing file, or null when all files are fine. */
export function validateUploadFiles(files: UploadCandidate[]): string | null {
  if (files.length === 0) return "Hãy chọn ít nhất một ảnh.";
  if (files.length > MAX_UPLOAD_FILES) return `Mỗi lần tải lên tối đa ${MAX_UPLOAD_FILES} ảnh.`;
  for (const file of files) {
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      return `${file.name}: chỉ chấp nhận JPG, PNG, WebP, AVIF hoặc GIF.`;
    }
    if (file.size === 0) return `${file.name} trống, không có nội dung.`;
    if (file.size > MAX_UPLOAD_BYTES) {
      return `${file.name} lớn hơn ${MAX_UPLOAD_MB} MB. Hãy nén ảnh nhỏ lại rồi tải lên.`;
    }
  }
  // The platform cap counts the whole request body, not each file: a batch
  // of small files can still exceed it. Checked last, on the sizes after
  // browser-side compression, so a single large photo that compressed
  // down is not punished for its original size.
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_UPLOAD_REQUEST_BYTES) {
    return `Tổng dung lượng ảnh là ${(total / (1024 * 1024)).toFixed(1)} MB, vượt quá giới hạn 4 MB mỗi lần tải lên — hãy chia nhỏ ra nhiều lần.`;
  }
  return null;
}
