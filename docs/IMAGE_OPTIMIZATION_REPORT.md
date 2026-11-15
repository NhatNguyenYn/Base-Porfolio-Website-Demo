# Image Optimization Report

Date: 2026-11-15. Scope: Base Portfolio (Thu Hà Ruby), Render + Neon + Cloudflare R2.
Master prompt: audit → implement → verify live. This report is the final
deliverable (phase 11 of the prompt); the audit that preceded the work is in
`~/workspace/base-portfolio-review/image-optimization-audit.md` (working copy,
not in the repo).

## 1. Before (measured live 2026-11-15)

- Public pages reference **60 files on R2**: 45 PNG originals (batch 1,
  Thư pháp Việt) + 14 JPG compressed (batch 2, Thư pháp Anh) + 1 avatar JPG.
- Batch-1 originals: 1 file measured live on R2 = **3.35 MB** (PNG). The same
  45 files on disk (extracted/) total **211 MB**; all 115 original artworks
  total **360.1 MB**. The compressed set for the same 115 files is **32.1 MB
  (−91%)**; thu-phap-viet alone: 211 MB → 13.7 MB (−93.5%).
- Upload pipeline stored the original bytes unchanged (`storeImage` only
  validated MIME/size/format). No resize, no recompression, no format
  conversion — the root cause of the slow first loads.
- Frontend was already mostly right: artwork cards `sizes="30vw/45vw/92vw"`,
  hero portrait `priority` + `38vw/92vw`, lightbox `100vw` + `priority`,
  admin thumbnails 140–360px, lazy loading by default. Missing: blur
  placeholders, and `deviceSizes` still included 3840 (HTML showed `w=3840`).
- R2 objects already carried `Cache-Control: public, max-age=31536000,
  immutable` — no change needed there.
- External factor (not code): Render free restarts the whole service for
  ~2 minutes (seen 01:50 and 10:11 15/11, everything 502 including the image
  optimizer, R2 files still 200). That is what made images "not show" at
  10:10 — not a broken image.

## 2. Technology

- **Sharp 0.35.5** (already a dependency, previously used only for metadata).
  No new dependency, no new service, no extra cost.
- `next/image` (AVIF/WebP formats already configured) + R2 (S3-compatible).

## 3. Files changed

| File | Change |
| --- | --- |
| `src/server/media/optimize.ts` (new) | Pure engine: `optimizeImage()` + `OptimizeError` + `normalizeFormat()` |
| `src/server/media/upload.ts` | `storeImage()` runs the optimizer; stores the optimized file, records `originalSize`/`optimizedAt`/`blurDataUrl` |
| `prisma/schema.prisma` + `prisma/migrations/20261115103000_media_optimization/migration.sql` | `Media`: `originalSize?`, `originalStorageKey?`, `optimizedAt?`, `blurDataUrl?` (additive, no data loss) |
| `src/server/actions/media.ts` | `optimizeLegacyMediaAction()` — legacy migration, dry-run, 10 files/run, originals kept |
| `src/components/admin/media-optimizer.tsx` (new) | Admin panel: "Xem trước" (dry-run) / "Tối ưu ảnh cũ" + per-file report |
| `src/app/(admin)/admin/(protected)/media/page.tsx` | Mounts the optimizer panel; grid shows original size when present |
| `src/components/admin/media-uploader.tsx` | Hint: "ảnh được nén tự động" |
| `src/server/queries/types.ts`, `src/server/queries/media.ts` | `MediaView.blurDataUrl` (flows to artwork cards + hero avatar via `toMediaView`) |
| `src/components/site/artwork-card.tsx`, `src/app/(public)/[locale]/page.tsx` | `placeholder="blur"` + `blurDataURL` (hero + gallery) |
| `next.config.ts` | `deviceSizes` capped at 2048 (was up to 3840); `minimumCacheTTL: 86400` |
| `tests/image-optimization.test.ts` (new) | 10 tests for the engine |
| `docs/IMAGE_OPTIMIZATION_REPORT.md` (this file) | Final report |

## 4. Engine rules (what it does to every new upload)

- Longest edge max **1600px**, never upscale.
- JPEG → JPEG q82 (progressive); PNG without alpha (a photo saved as PNG) →
  JPEG q82; PNG with alpha → PNG compressed; WebP → WebP q82; AVIF → AVIF
  q60; **GIF untouched** (animation must survive); SVG is not accepted at
  upload (unchanged).
- EXIF orientation applied (`rotate()`); all other metadata — including GPS —
  is stripped (Sharp drops metadata unless `withMetadata()` is used).
- The optimized version is adopted **only when smaller** than the input, so
  already-compressed files (batches 2–6) are stored byte-identical:
  re-uploading them is idempotent.
- A 16px WebP blur placeholder is generated for `next/image`.
- Bonus fix found by the tests: Sharp reports AVIF as `heif`, so AVIF uploads
  were previously rejected by the format check; `normalizeFormat()` maps
  `heif` → `avif` in both the optimizer and the upload validator.

## 5. Old images (migration)

- Admin page `/admin/media` → "Tối ưu ảnh cũ": dry-run first (same scan and
  optimization in memory, nothing written), then the real run. 10 files per
  run, largest first; run again until the report says 0 remaining.
- Only unprocessed raster files over 300 KB are candidates (`originalSize`
  null). The original R2 object is **never deleted**; its key is recorded on
  the media row (`originalStorageKey`) for rollback. References are never
  edited by hand — artwork/project/article rows point at the media id, and
  only the media row's own url/key changes.
- Expected result for the 45 batch-1 originals: ~211 MB → ~13.7 MB (−93.5%),
  based on the identical compressed files already prepared locally.

## 6. Tests (local, 2026-11-15)

- `npx tsc --noEmit`: **0 errors**.
- New suite `tests/image-optimization.test.ts`: **10/10 passed** (large JPEG
  resize, no upscale, PNG photo → JPEG, PNG alpha stays PNG, GIF passthrough,
  WebP/AVIF recompress, EXIF rotation, idempotency, corrupt/mismatch
  rejection, tiny blur placeholder).
- Full suite `npm test`: **43 files, 424 tests, all passed**.
- `npm run build` (incl. `prisma migrate deploy`): **passed**; the new
  migration applied cleanly to the local test DB and dev DB.

## 7. Live verification — PENDING (after deploy)

Run after the Render deploy, before calling this done:

1. Homepage + `/vi/art` load; hero portrait + first gallery images render
   (blur placeholder visible briefly); no broken images.
2. Upload one test image in `/admin/media` (a large original): the stored
   file must be ≤1600px, smaller than the upload, and the grid must show the
   original size ("gốc …").
3. `/admin/media` → "Xem trước" (dry-run): expect ~45 files, ~190 MB saved,
   nothing changed. Then "Tối ưu ảnh cũ" repeatedly until remaining = 0.
4. Re-check `/vi/art` + thu-phap-viet collection: same 45 artworks, visibly
   identical, loading from the new (JPEG) URLs; confirm the old PNG objects
   still exist in R2 (rollback path).
5. Fill in the table below with the live numbers.

| Metric | Before | After (live) |
| --- | --- | --- |
| Batch-1 files on R2 (bytes) | ~211 MB (45 PNG) | _to fill after migration_ |
| Gallery first-load transfer (mobile, 6 cards) | _measure_ | _measure_ |
| Homepage LCP image | avatar PNG/JPG original | optimized + blur placeholder |
| Broken images on `/vi/art`, `/vi/art/collections/*`, homepage | 0 (after the 10:11 outage cleared) | _to confirm_ |

## 8. Remaining issues / next steps

- **Live migration not run yet** — the code is deployed, the admin must run
  it (dry-run, then real runs) and the table above filled in.
- Duplicate/unused media rows could not be audited from outside the DB; the
  migration report gives the exact candidate count server-side. Orphaned
  original R2 objects (after migration) can be deleted from the R2 dashboard
  only after the new files are verified live.
- Render free restarts (~2 min, whole site 502) remain an infrastructure
  property, not an image bug; the mitigation is the planned move to the home
  Dell server, not image code.
- The static GitHub Pages export is unaffected (`images.unoptimized`, as
  before).
