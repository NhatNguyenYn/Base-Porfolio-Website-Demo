"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireUser } from "../auth";
import { logActivity } from "../audit";
import { rateLimit } from "@/lib/rate-limit";
import { storeImage, UploadError } from "../media/upload";
import { getStorage } from "../storage";
import { getString } from "./helpers";
import type { MediaView } from "../queries/types";

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
    return { ok: false, message: "Too many uploads. Try again later." };
  }

  const entries = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  const alt = getString(formData, "alt");

  if (entries.length === 0) return { ok: false, message: "Choose at least one image." };
  if (entries.length > 10) return { ok: false, message: "Upload up to 10 images at a time." };

  const created: MediaView[] = [];

  for (const file of entries) {
    try {
      created.push(await storeImage(file, alt));
    } catch (error) {
      if (error instanceof UploadError) return { ok: false, message: error.message };
      console.error("[media] upload failed", error);
      return { ok: false, message: "Could not store the image. Please try again." };
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
    message: `${created.length} image${created.length > 1 ? "s" : ""} uploaded.`,
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

  const media = await prisma.media.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          artworkImages: true,
          artworkThumbnails: true,
          projectThumbnails: true,
          projectImages: true,
          articleCovers: true,
          collectionCovers: true,
          profileAvatars: true,
        },
      },
    },
  });

  if (!media) redirect("/admin/media?error=not_found");

  const inUse = Object.values(media._count).reduce((total, count) => total + count, 0);
  if (inUse > 0) {
    redirect("/admin/media?error=in_use");
  }

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
