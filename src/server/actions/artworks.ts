"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireUser } from "../auth";
import { logActivity } from "../audit";
import { artworkSchema, collectionSchema, zodFieldErrors } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { getBool, getString, parseDateValue, readLocaleBlock, uniqueSlug } from "./helpers";
import type { ActionState } from "@/lib/action-state";

async function syncTags(
  tx: Prisma.TransactionClient,
  artworkId: string,
  raw: string,
): Promise<void> {
  const names = Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  );

  await tx.artworkTag.deleteMany({ where: { artworkId } });

  for (const name of names) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await tx.tag.upsert({
      where: { slug },
      update: {},
      create: { slug, name },
    });
    await tx.artworkTag.create({ data: { artworkId, tagId: tag.id } });
  }
}

export async function saveArtworkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = artworkSchema.safeParse({
    id,
    slug: getString(formData, "slug") || undefined,
    imageMediaId: getString(formData, "imageMediaId"),
    collectionId: getString(formData, "collectionId") || undefined,
    categoryId: getString(formData, "categoryId") || undefined,
    medium: getString(formData, "medium"),
    createdDate: getString(formData, "createdDate") || undefined,
    featured: getBool(formData, "featured"),
    visibility: getString(formData, "visibility") || "public",
    order: getString(formData, "order") || 0,
    tags: getString(formData, "tags"),
    vi: readLocaleBlock(formData, "vi", ["title", "description"]),
    en: readLocaleBlock(formData, "en", ["title", "description"]),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  if (!data.vi.title && !data.en.title) {
    return {
      ok: false,
      message: "Add an artwork title in at least one language.",
      fieldErrors: { "vi.title": ["Title is required"] },
    };
  }

  const exists = async (candidate: string) => {
    const found = await prisma.artwork.findFirst({
      where: { slug: candidate, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  };
  const slug = id
    ? data.slug
      ? await uniqueSlug(slugify(data.slug), exists)
      : (await prisma.artwork.findUnique({ where: { id }, select: { slug: true } }))?.slug ?? slugify(data.vi.title || data.en.title)
    : await uniqueSlug(slugify(data.slug || data.vi.title || data.en.title) || "artwork", exists);

  try {
    const artwork = await prisma.$transaction(async (tx) => {
      const common = {
        slug,
        imageMediaId: data.imageMediaId,
        collectionId: data.collectionId ?? null,
        categoryId: data.categoryId ?? null,
        medium: data.medium || null,
        createdDate: parseDateValue(data.createdDate),
        featured: data.featured,
        visibility: data.visibility,
        order: data.order,
      };

      const record = id
        ? await tx.artwork.update({ where: { id }, data: common })
        : await tx.artwork.create({ data: common });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        if (block.title.trim()) {
          await tx.artworkTranslation.upsert({
            where: { artworkId_locale: { artworkId: record.id, locale } },
            update: { title: block.title, description: block.description },
            create: { artworkId: record.id, locale, title: block.title, description: block.description },
          });
        } else {
          await tx.artworkTranslation.deleteMany({ where: { artworkId: record.id, locale } });
        }
      }

      await syncTags(tx, record.id, data.tags);
      return record;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "artwork",
      entityId: artwork.id,
      summary: `${id ? "Updated" : "Uploaded"} artwork “${data.vi.title || data.en.title}”`,
    });

    revalidatePath("/", "layout");
    redirect(`/admin/art/${artwork.id}?saved=1`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) throw error;
    console.error("[artwork] save failed", error);
    return { ok: false, message: "Could not save the artwork. Please try again." };
  }
}

export async function deleteArtworkAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  const artwork = await prisma.artwork.findUnique({ where: { id }, include: { translations: true } });
  if (!artwork) return;

  await prisma.artwork.update({ where: { id }, data: { deletedAt: new Date() } });
  await logActivity({
    userId: user.id,
    action: "delete",
    entityType: "artwork",
    entityId: id,
    summary: `Deleted artwork “${artwork.translations[0]?.title ?? artwork.slug}” (soft delete)`,
  });

  revalidatePath("/", "layout");
  redirect("/admin/art?deleted=1");
}

export async function toggleArtworkFeaturedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  const artwork = await prisma.artwork.findUnique({ where: { id } });
  if (!artwork) return;

  await prisma.artwork.update({ where: { id }, data: { featured: !artwork.featured } });
  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "artwork",
    entityId: id,
    summary: `Artwork ${artwork.slug} featured set to ${!artwork.featured}`,
  });
  revalidatePath("/", "layout");
}

/** Swaps display order with the adjacent artwork. */
export async function moveArtworkAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  const direction = getString(formData, "direction") === "up" ? "up" : "down";
  if (!id) return;

  const current = await prisma.artwork.findUnique({ where: { id } });
  if (!current) return;

  const neighbour = await prisma.artwork.findFirst({
    where: direction === "up" ? { order: { lt: current.order } } : { order: { gt: current.order } },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });

  if (!neighbour) return;

  await prisma.$transaction([
    prisma.artwork.update({ where: { id: current.id }, data: { order: neighbour.order } }),
    prisma.artwork.update({ where: { id: neighbour.id }, data: { order: current.order } }),
  ]);

  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "artwork",
    entityId: id,
    summary: `Reordered artwork ${current.slug} ${direction}`,
  });
  revalidatePath("/", "layout");
}

export async function saveCollectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = collectionSchema.safeParse({
    id,
    slug: getString(formData, "slug") || undefined,
    coverMediaId: getString(formData, "coverMediaId") || undefined,
    featured: getBool(formData, "featured"),
    visibility: getString(formData, "visibility") || "public",
    order: getString(formData, "order") || 0,
    vi: readLocaleBlock(formData, "vi", ["name", "description"]),
    en: readLocaleBlock(formData, "en", ["name", "description"]),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  if (!data.vi.name && !data.en.name) {
    return {
      ok: false,
      message: "Add a collection name in at least one language.",
      fieldErrors: { "vi.name": ["Name is required"] },
    };
  }

  const exists = async (candidate: string) => {
    const found = await prisma.artworkCollection.findFirst({
      where: { slug: candidate, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  };
  const slug = await uniqueSlug(slugify(data.slug || data.vi.name || data.en.name) || "collection", exists);

  try {
    const collection = await prisma.$transaction(async (tx) => {
      const common = {
        slug,
        coverMediaId: data.coverMediaId ?? null,
        featured: data.featured,
        visibility: data.visibility,
        order: data.order,
      };
      const record = id
        ? await tx.artworkCollection.update({ where: { id }, data: common })
        : await tx.artworkCollection.create({ data: common });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        if (block.name.trim()) {
          await tx.collectionTranslation.upsert({
            where: { collectionId_locale: { collectionId: record.id, locale } },
            update: { name: block.name, description: block.description },
            create: { collectionId: record.id, locale, name: block.name, description: block.description },
          });
        } else {
          await tx.collectionTranslation.deleteMany({ where: { collectionId: record.id, locale } });
        }
      }
      return record;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "collection",
      entityId: collection.id,
      summary: `${id ? "Updated" : "Created"} collection “${data.vi.name || data.en.name}”`,
    });
    revalidatePath("/", "layout");
    redirect("/admin/art/collections?saved=1");
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) throw error;
    console.error("[collection] save failed", error);
    return { ok: false, message: "Could not save the collection." };
  }
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  await prisma.artworkCollection.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.artwork.updateMany({ where: { collectionId: id }, data: { collectionId: null } });
  await logActivity({
    userId: user.id,
    action: "delete",
    entityType: "collection",
    entityId: id,
    summary: "Deleted artwork collection (soft delete); artworks kept",
  });
  revalidatePath("/", "layout");
  redirect("/admin/art/collections?deleted=1");
}
