/**
 * Client-side upload validation, mirroring the server rules in
 * `src/server/media/upload.ts` (`storeImage`) and `uploadMediaAction`.
 *
 * Why this exists: the picker dispatches the upload as a Server Action. A
 * file the server would reject still travels to the server first — and a
 * file over the action body limit (12 MB, see `serverActions.bodySizeLimit`
 * in next.config.ts) never reaches the action at all: the POST is rejected
 * and the dispatch rejects, which React surfaces as a full-page
 * "Application error" instead of an inline message. Checking here first
 * keeps oversized / wrong-type / empty files from ever being dispatched.
 *
 * Keep the numbers in sync with the server: MAX_UPLOAD_MB with
 * `MAX_UPLOAD_MB` (default 10) in `storeImage`, MAX_UPLOAD_FILES with the
 * 10-file cap in `uploadMediaAction`.
 */

export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

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
  return null;
}
