"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireUser } from "../auth";
import { logActivity } from "../audit";
import { rateLimit } from "@/lib/rate-limit";
import { storeImage, UploadError } from "../media/upload";
import { optimizeImage, OptimizeError } from "../media/optimize";
import { getStorage } from "../storage";
import { getString } from "./helpers";
import type { MediaView } from "../queries/types";
import { randomUUID } from "node:crypto";

export type UploadState = {
  ok: boolean;
  message: string;
  files?: MediaView[];
};

/**
 * Validates and stores uploaded images. MIME type and extension are both
 * checked, size is capped, and metadata (dimensions) is read with sharp.
 */
export async function uploadMediaAction(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = await requireUser();
  // Same 60/hour/user throttle as POST /api/admin/media, so the Server
  // Action cannot be used to bypass the API limit.
  const limit = rateLimit(`media:${user.id}`, 60, 60 * 60 * 1000);
  if (!limit.ok) {
    return { ok: false, message: "Tải lên quá nhiều lần. Vui lòng thử lại sau." };
  }

  const entries = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  const alt = getString(formData, "alt");

  if (entries.length === 0) return { ok: false, message: "Hãy chọn ít nhất một ảnh." };
  if (entries.length > 10) return { ok: false, message: "Mỗi lần tải lên tối đa 10 ảnh." };

  const created: MediaView[] = [];

  for (const file of entries) {
    try {
      created.push(await storeImage(file, alt));
    } catch (error) {
      if (error instanceof UploadError) return { ok: false, message: error.message };
      console.error("[media] upload failed", error);
      return { ok: false, message: "Không lưu được ảnh. Vui lòng thử lại." };
    }
  }

  await logActivity({
    userId: user.id,
    action: "create",
    entityType: "media",
    summary: `Uploaded ${created.length} image${created.length > 1 ? "s" : ""}`,
  });

  revalidatePath("/admin/media");
  return {
    ok: true,
    message: "Tải ảnh lên hoàn tất",
    files: created,
  };
}

export async function updateMediaMetaAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  await prisma.media.update({
    where: { id },
    data: {
      alt: getString(formData, "alt").slice(0, 240) || null,
      title: getString(formData, "title").slice(0, 240) || null,
    },
  });
  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "media",
    entityId: id,
    summary: "Updated media metadata",
  });
  revalidatePath("/admin/media");
  redirect("/admin/media?saved=1");
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) redirect("/admin/media?error=not_found");

  // The in-use guard counts only references from live rows. References from
  // soft-deleted rows (deletedAt set) do not block deletion: covers and
  // thumbnails are cleared by ON DELETE SET NULL and project-image links
  // cascade. The one exception is Artwork.imageMediaId, which is required
  // with ON DELETE RESTRICT, so trashed artworks using this file as their
  // image are purged below (there is no restore path for soft-deleted
  // artworks, and their translations and tags cascade).
  const [
    artworkImages,
    artworkThumbnails,
    projectThumbnails,
    projectImages,
    articleCovers,
    collectionCovers,
    profileAvatars,
  ] = await prisma.$transaction([
    prisma.artwork.count({ where: { imageMediaId: id, deletedAt: null } }),
    prisma.artwork.count({ where: { thumbnailMediaId: id, deletedAt: null } }),
    prisma.project.count({ where: { thumbnailMediaId: id, deletedAt: null } }),
    prisma.projectImage.count({ where: { mediaId: id, project: { deletedAt: null } } }),
    prisma.article.count({ where: { coverMediaId: id, deletedAt: null } }),
    prisma.artworkCollection.count({ where: { coverMediaId: id, deletedAt: null } }),
    prisma.profile.count({ where: { avatarMediaId: id } }),
  ]);

  const inUse =
    artworkImages +
    artworkThumbnails +
    projectThumbnails +
    projectImages +
    articleCovers +
    collectionCovers +
    profileAvatars;
  if (inUse > 0) {
    redirect("/admin/media?error=in_use");
  }

  await prisma.artwork.deleteMany({ where: { imageMediaId: id, deletedAt: { not: null } } });

  await prisma.media.delete({ where: { id } });
  await getStorage().delete(media.storageKey).catch(() => undefined);

  await logActivity({
    userId: user.id,
    action: "delete",
    entityType: "media",
    entityId: id,
    summary: `Deleted media ${media.filename}`,
  });
  revalidatePath("/admin/media");
  redirect("/admin/media?deleted=1");
}

export type OptimizeLegacyFileResult = {
  filename: string;
  status: "optimized" | "already-optimal" | "skipped" | "failed";
  beforeBytes: number;
  afterBytes: number;
  note: string;
};

export type OptimizeLegacyReport = {
  dryRun: boolean;
  scanned: number;
  optimized: number;
  alreadyOptimal: number;
  skipped: number;
  failed: number;
  savedBytes: number;
  /** Candidates still waiting after this run (0 means the library is done). */
  remaining: number;
  files: OptimizeLegacyFileResult[];
};

export type OptimizeLegacyState = {
  ok: boolean;
  message: string;
  report?: OptimizeLegacyReport;
};

/**
 * Legacy-image migration: optimizes media uploaded before the automatic
 * optimizer existed (the batch-1 originals are the bulk of it).
 *
 * Safety rules (Master Prompt phase 4):
 * - Dry-run first: same scan and optimization in memory, nothing written.
 * - The original file is NEVER deleted from storage; its key is recorded on
 *   the media row (`originalStorageKey`) so any file can be rolled back by
 *   pointing the row back at the old key.
 * - References never change by hand: artwork/project/article rows point at
 *   the media id, and only the media row's own url/key is updated.
 * - 10 files per run, largest first, so a run stays well inside request
 *   timeouts on the free tier; run again until `remaining` is 0.
 * - Files that are already optimal are marked (originalSize + optimizedAt)
 *   so they are not scanned again.
 */
const LEGACY_BATCH_SIZE = 10;
const LEGACY_MIN_BYTES = 300_000;
const LEGACY_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function optimizeLegacyMediaAction(
  _prev: OptimizeLegacyState,
  formData: FormData,
): Promise<OptimizeLegacyState> {
  const user = await requireUser();
  const dryRun = getString(formData, "dryRun") === "1";

  const candidates = await prisma.media.findMany({
    where: {
      originalSize: null,
      mimeType: { in: LEGACY_MIME_TYPES },
      size: { gt: LEGACY_MIN_BYTES },
    },
    orderBy: { size: "desc" },
    take: LEGACY_BATCH_SIZE,
  });

  const report: OptimizeLegacyReport = {
    dryRun,
    scanned: candidates.length,
    optimized: 0,
    alreadyOptimal: 0,
    skipped: 0,
    failed: 0,
    savedBytes: 0,
    remaining: 0,
    files: [],
  };

  for (const media of candidates) {
    const beforeBytes = media.size;
    try {
      const stored = await getStorage().get(media.storageKey);
      if (!stored) {
        report.skipped += 1;
        report.files.push({
          filename: media.filename,
          status: "skipped",
          beforeBytes,
          afterBytes: beforeBytes,
          note: "File missing in storage; row left untouched.",
        });
        continue;
      }

      const optimized = await optimizeImage(stored.body, media.mimeType);
      if (!optimized.changed) {
        if (!dryRun) {
          await prisma.media.update({
            where: { id: media.id },
            data: { originalSize: beforeBytes, optimizedAt: new Date(), blurDataUrl: optimized.blurDataUrl },
          });
        }
        report.alreadyOptimal += 1;
        report.files.push({
          filename: media.filename,
          status: "already-optimal",
          beforeBytes,
          afterBytes: beforeBytes,
          note: "Already optimal; marked so it is not scanned again.",
        });
        continue;
      }

      if (!dryRun) {
        const prefix = media.storageKey.split("/").slice(0, -1).join("/") || "uploads";
        const key = `${prefix}/${randomUUID()}.${optimized.extension}`;
        const saved = await getStorage().put(key, optimized.buffer, optimized.mimeType);
        await prisma.media.update({
          where: { id: media.id },
          data: {
            storageKey: saved.key,
            url: saved.url,
            mimeType: optimized.mimeType,
            size: optimized.optimizedBytes,
            width: optimized.width,
            height: optimized.height,
            originalSize: beforeBytes,
            originalStorageKey: media.storageKey,
            optimizedAt: new Date(),
            blurDataUrl: optimized.blurDataUrl,
          },
        });
      }
      report.optimized += 1;
      report.savedBytes += beforeBytes - optimized.optimizedBytes;
      report.files.push({
        filename: media.filename,
        status: "optimized",
        beforeBytes,
        afterBytes: optimized.optimizedBytes,
        note: dryRun ? "Would optimize (dry run, nothing written)." : "Optimized; original file kept in storage.",
      });
    } catch (error) {
      if (error instanceof OptimizeError) {
        report.failed += 1;
        report.files.push({
          filename: media.filename,
          status: "failed",
          beforeBytes,
          afterBytes: beforeBytes,
          note: `Could not optimize: ${error.message}`,
        });
        continue;
      }
      console.error("[media] legacy optimization failed", media.id, error);
      report.failed += 1;
      report.files.push({
        filename: media.filename,
        status: "failed",
        beforeBytes,
        afterBytes: beforeBytes,
        note: "Unexpected error; row left untouched.",
      });
    }
  }

  report.remaining = await prisma.media.count({
    where: {
      originalSize: null,
      mimeType: { in: LEGACY_MIME_TYPES },
      size: { gt: LEGACY_MIN_BYTES },
    },
  });

  if (!dryRun) {
    await logActivity({
      userId: user.id,
      action: "update",
      entityType: "media",
      summary: `Optimized ${report.optimized} legacy images (dry run: no), ${report.alreadyOptimal} already optimal, ${report.failed} failed, saved ${report.savedBytes} bytes`,
    });
    revalidatePath("/admin/media");
  }

  return {
    ok: true,
    message: dryRun
      ? `Dry run: ${report.optimized} files would be optimized, saving ${report.savedBytes} bytes. Nothing was changed.`
      : `${report.optimized} optimized, ${report.alreadyOptimal} already optimal, ${report.skipped} skipped, ${report.failed} failed. Saved ${report.savedBytes} bytes. ${report.remaining} files remaining.`,
    report,
  };
}
