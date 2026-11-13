"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireUser } from "../auth";
import { logActivity } from "../audit";
import { articleSchema, categorySchema, zodFieldErrors } from "@/lib/validation";
import { normalizeArticleTemplate } from "@/lib/article-template";
import { readingMinutes, slugify } from "@/lib/utils";
import { getBool, getString, parseDateValue, readLocaleBlock, uniqueSlug } from "./helpers";
import type { ActionState } from "@/lib/action-state";

const TRANSLATION_FIELDS = ["title", "subtitle", "excerpt", "content", "seoTitle", "seoDescription"];

async function syncArticleTags(tx: Prisma.TransactionClient, articleId: string, raw: string): Promise<void> {
  const names = Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  );

  await tx.articleTag.deleteMany({ where: { articleId } });

  for (const name of names) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await tx.tag.upsert({ where: { slug }, update: {}, create: { slug, name } });
    await tx.articleTag.create({ data: { articleId, tagId: tag.id } });
  }
}

export async function saveArticleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = articleSchema.safeParse({
    id,
    slug: getString(formData, "slug") || undefined,
    categoryId: getString(formData, "categoryId") || undefined,
    coverMediaId: getString(formData, "coverMediaId") || undefined,
    status: getString(formData, "status") || "draft",
    template: normalizeArticleTemplate(getString(formData, "template")),
    visibility: getString(formData, "visibility") || "public",
    featured: getBool(formData, "featured"),
    scheduledFor: getString(formData, "scheduledFor") || undefined,
    tags: getString(formData, "tags"),
    vi: readLocaleBlock(formData, "vi", TRANSLATION_FIELDS),
    en: readLocaleBlock(formData, "en", TRANSLATION_FIELDS),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  if (!data.vi.title && !data.en.title) {
    return {
      ok: false,
      message: "Add a title in at least one language.",
      fieldErrors: { "vi.title": ["Title is required"] },
    };
  }

  const exists = async (candidate: string) => {
    const found = await prisma.article.findFirst({
      where: { slug: candidate, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  };
  const slug = id
    ? data.slug
      ? await uniqueSlug(slugify(data.slug), exists)
      : (await prisma.article.findUnique({ where: { id }, select: { slug: true } }))?.slug ?? slugify(data.vi.title || data.en.title)
    : await uniqueSlug(slugify(data.slug || data.vi.title || data.en.title) || "article", exists);

  const scheduledFor = parseDateValue(data.scheduledFor);
  const minutes = Math.max(readingMinutes(data.vi.content), readingMinutes(data.en.content), 1);

  try {
    const article = await prisma.$transaction(async (tx) => {
      const existing = id
        ? await tx.article.findUnique({ where: { id }, select: { publishedAt: true } })
        : null;

      const publishedAt =
        data.status === "published"
          ? scheduledFor ?? existing?.publishedAt ?? new Date()
          : existing?.publishedAt ?? (data.status === "draft" ? null : new Date());

      const common = {
        slug,
        categoryId: data.categoryId ?? null,
        coverMediaId: data.coverMediaId ?? null,
        status: data.status,
        template: data.template,
        visibility: data.visibility,
        featured: data.featured,
        scheduledFor,
        publishedAt,
        readingMinutes: minutes,
      };

      const record = id
        ? await tx.article.update({ where: { id }, data: common })
        : await tx.article.create({ data: { ...common, authorId: user.id } });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        if (block.title.trim()) {
          await tx.articleTranslation.upsert({
            where: { articleId_locale: { articleId: record.id, locale } },
            update: {
              title: block.title,
              subtitle: block.subtitle || null,
              excerpt: block.excerpt,
              content: block.content,
              seoTitle: block.seoTitle || null,
              seoDescription: block.seoDescription || null,
            },
            create: {
              articleId: record.id,
              locale,
              title: block.title,
              subtitle: block.subtitle || null,
              excerpt: block.excerpt,
              content: block.content,
              seoTitle: block.seoTitle || null,
              seoDescription: block.seoDescription || null,
            },
          });
        } else {
          await tx.articleTranslation.deleteMany({ where: { articleId: record.id, locale } });
        }
      }

      await syncArticleTags(tx, record.id, data.tags);
      return record;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "article",
      entityId: article.id,
      summary: `${id ? "Updated" : "Created"} article “${data.vi.title || data.en.title}” (${data.status})`,
    });

    revalidatePath("/", "layout");
    redirect(`/admin/blog/${article.id}?saved=1`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) throw error;
    console.error("[article] save failed", error);
    return { ok: false, message: "Could not save the article. Please try again." };
  }
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  const article = await prisma.article.findUnique({ where: { id }, include: { translations: true } });
  if (!article) return;

  await prisma.article.update({ where: { id }, data: { deletedAt: new Date() } });
  await logActivity({
    userId: user.id,
    action: "delete",
    entityType: "article",
    entityId: id,
    summary: `Deleted article “${article.translations[0]?.title ?? article.slug}” (soft delete)`,
  });
  revalidatePath("/", "layout");
  redirect("/admin/blog?deleted=1");
}

export async function toggleArticleFeaturedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return;

  await prisma.article.update({ where: { id }, data: { featured: !article.featured } });
  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "article",
    entityId: id,
    summary: `Article ${article.slug} featured set to ${!article.featured}`,
  });
  revalidatePath("/", "layout");
}

export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = categorySchema.safeParse({
    id,
    slug: getString(formData, "slug") || undefined,
    kind: getString(formData, "kind") || "article",
    vi: readLocaleBlock(formData, "vi", ["name", "description"]),
    en: readLocaleBlock(formData, "en", ["name", "description"]),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const exists = async (candidate: string) => {
    const found = await prisma.category.findFirst({
      where: { slug: candidate, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  };
  const slug = await uniqueSlug(slugify(data.slug || data.vi.name || data.en.name) || "category", exists);

  try {
    const category = await prisma.$transaction(async (tx) => {
      const record = id
        ? await tx.category.update({ where: { id }, data: { slug, kind: data.kind } })
        : await tx.category.create({ data: { slug, kind: data.kind } });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        if (block.name.trim()) {
          await tx.categoryTranslation.upsert({
            where: { categoryId_locale: { categoryId: record.id, locale } },
            update: { name: block.name, description: block.description },
            create: { categoryId: record.id, locale, name: block.name, description: block.description },
          });
        } else {
          await tx.categoryTranslation.deleteMany({ where: { categoryId: record.id, locale } });
        }
      }
      return record;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "category",
      entityId: category.id,
      summary: `${id ? "Updated" : "Created"} category “${data.vi.name || data.en.name}”`,
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Category saved." };
  } catch (error) {
    console.error("[category] save failed", error);
    return { ok: false, message: "Could not save the category." };
  }
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  await prisma.category.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    action: "delete",
    entityType: "category",
    entityId: id,
    summary: "Deleted category (articles keep their content, category cleared)",
  });
  revalidatePath("/", "layout");
  redirect("/admin/taxonomy?deleted=1");
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  await prisma.tag.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    action: "delete",
    entityType: "tag",
    entityId: id,
    summary: "Deleted tag",
  });
  revalidatePath("/", "layout");
  redirect("/admin/taxonomy?deleted=1");
}
