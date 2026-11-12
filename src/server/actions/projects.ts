"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireUser } from "../auth";
import { logActivity } from "../audit";
import { projectSchema, zodFieldErrors } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { getBool, getString, parseDateValue, readLocaleBlock, uniqueSlug } from "./helpers";
import type { ActionState } from "@/lib/action-state";

const TRANSLATION_FIELDS = ["name", "shortDescription", "fullDescription", "role"];

export async function saveProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = projectSchema.safeParse({
    id,
    slug: getString(formData, "slug") || undefined,
    status: getString(formData, "status") || "completed",
    visibility: getString(formData, "visibility") || "public",
    featured: getBool(formData, "featured"),
    order: getString(formData, "order") || 0,
    startDate: getString(formData, "startDate") || undefined,
    completionDate: getString(formData, "completionDate") || undefined,
    githubUrl: getString(formData, "githubUrl") || undefined,
    demoUrl: getString(formData, "demoUrl") || undefined,
    thumbnailMediaId: getString(formData, "thumbnailMediaId") || undefined,
    technologies: getString(formData, "technologies"),
    gallery: getString(formData, "gallery"),
    vi: readLocaleBlock(formData, "vi", TRANSLATION_FIELDS),
    en: readLocaleBlock(formData, "en", TRANSLATION_FIELDS),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  if (!data.vi.name && !data.en.name) {
    return {
      ok: false,
      message: "Add a project name in at least one language.",
      fieldErrors: { "vi.name": ["Project name is required"] },
    };
  }

  const baseSlug = slugify(data.slug || data.vi.name || data.en.name);
  const exists = async (candidate: string) => {
    const found = await prisma.project.findFirst({
      where: { slug: candidate, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  };
  const slug = id
    ? data.slug
      ? await uniqueSlug(slugify(data.slug), exists)
      : (await prisma.project.findUnique({ where: { id }, select: { slug: true } }))?.slug ?? baseSlug
    : await uniqueSlug(baseSlug, exists);

  const technologies = Array.from(
    new Set(
      data.technologies
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
  const galleryIds = Array.from(
    new Set(
      data.gallery
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  try {
    const project = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const common = {
        slug,
        status: data.status,
        visibility: data.visibility,
        featured: data.featured,
        order: data.order,
        startDate: parseDateValue(data.startDate),
        completionDate: parseDateValue(data.completionDate),
        githubUrl: data.githubUrl ?? null,
        demoUrl: data.demoUrl ?? null,
        thumbnailMediaId: data.thumbnailMediaId ?? null,
      };

      const record = id
        ? await tx.project.update({
            where: { id },
            data: {
              ...common,
              publishedAt: (await tx.project.findUnique({ where: { id }, select: { publishedAt: true } }))?.publishedAt ?? new Date(),
            },
          })
        : await tx.project.create({ data: { ...common, publishedAt: new Date() } });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        if (block.name.trim()) {
          await tx.projectTranslation.upsert({
            where: { projectId_locale: { projectId: record.id, locale } },
            update: {
              name: block.name,
              shortDescription: block.shortDescription,
              fullDescription: block.fullDescription,
              role: block.role,
            },
            create: {
              projectId: record.id,
              locale,
              name: block.name,
              shortDescription: block.shortDescription,
              fullDescription: block.fullDescription,
              role: block.role,
            },
          });
        } else {
          await tx.projectTranslation.deleteMany({ where: { projectId: record.id, locale } });
        }
      }

      await tx.projectTechnology.deleteMany({ where: { projectId: record.id } });
      if (technologies.length) {
        await tx.projectTechnology.createMany({
          data: technologies.map((name, index) => ({ projectId: record.id, name, order: index })),
        });
      }

      await tx.projectImage.deleteMany({ where: { projectId: record.id } });
      if (galleryIds.length) {
        await tx.projectImage.createMany({
          data: galleryIds.map((mediaId, index) => ({ projectId: record.id, mediaId, order: index })),
        });
      }

      return record;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "project",
      entityId: project.id,
      summary: `${id ? "Updated" : "Created"} project “${data.vi.name || data.en.name}”`,
    });

    revalidatePath("/", "layout");
    redirect(`/admin/projects/${project.id}?saved=1`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    if (typeof error === "object" && error !== null && "digest" in error) throw error;
    console.error("[project] save failed", error);
    return { ok: false, message: "Could not save the project. Please review the form and try again." };
  }
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  const project = await prisma.project.findFirst({ where: { id }, include: { translations: true } });
  if (!project) return;

  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  await logActivity({
    userId: user.id,
    action: "delete",
    entityType: "project",
    entityId: id,
    summary: `Deleted project “${project.translations[0]?.name ?? project.slug}” (soft delete)`,
  });

  revalidatePath("/", "layout");
  redirect("/admin/projects?deleted=1");
}

export async function toggleProjectFeaturedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return;

  await prisma.project.update({ where: { id }, data: { featured: !project.featured } });
  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "project",
    entityId: id,
    summary: `${project.featured ? "Removed" : "Added"} project ${project.slug} ${project.featured ? "from" : "to"} featured`,
  });
  revalidatePath("/", "layout");
}
