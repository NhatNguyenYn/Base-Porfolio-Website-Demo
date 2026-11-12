"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireUser } from "../auth";
import { logActivity } from "../audit";
import {
  educationSchema,
  experienceSchema,
  profileSchema,
  skillSchema,
  socialLinkSchema,
  zodFieldErrors,
} from "@/lib/validation";
import { getBool, getString, parseDateValue, readLocaleBlock } from "./helpers";
import type { ActionState } from "@/lib/action-state";

const PROFILE_FIELDS = [
  "fullName",
  "title",
  "shortBio",
  "longBio",
  "interests",
  "philosophy",
  "futureGoals",
  "seoTitle",
  "seoDescription",
];

export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    location: getString(formData, "location"),
    resumeUrl: getString(formData, "resumeUrl") || undefined,
    availableForWork: getBool(formData, "availableForWork"),
    avatarMediaId: getString(formData, "avatarMediaId") || undefined,
    vi: readLocaleBlock(formData, "vi", PROFILE_FIELDS),
    en: readLocaleBlock(formData, "en", PROFILE_FIELDS),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const data = parsed.data;

  try {
    const profile = await prisma.$transaction(async (tx) => {
      const existing = await tx.profile.findFirst({ orderBy: { createdAt: "asc" } });
      const common = {
        email: data.email,
        phone: data.phone || null,
        location: data.location || null,
        resumeUrl: data.resumeUrl ?? null,
        availableForWork: data.availableForWork,
        avatarMediaId: data.avatarMediaId ?? null,
      };

      const record = existing
        ? await tx.profile.update({ where: { id: existing.id }, data: common })
        : await tx.profile.create({ data: common });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        if (block.fullName.trim()) {
          await tx.profileTranslation.upsert({
            where: { profileId_locale: { profileId: record.id, locale } },
            update: {
              fullName: block.fullName,
              title: block.title || block.fullName,
              shortBio: block.shortBio,
              longBio: block.longBio,
              interests: block.interests,
              philosophy: block.philosophy,
              futureGoals: block.futureGoals,
              seoTitle: block.seoTitle || null,
              seoDescription: block.seoDescription || null,
            },
            create: {
              profileId: record.id,
              locale,
              fullName: block.fullName,
              title: block.title || block.fullName,
              shortBio: block.shortBio,
              longBio: block.longBio,
              interests: block.interests,
              philosophy: block.philosophy,
              futureGoals: block.futureGoals,
              seoTitle: block.seoTitle || null,
              seoDescription: block.seoDescription || null,
            },
          });
        } else {
          await tx.profileTranslation.deleteMany({ where: { profileId: record.id, locale } });
        }
      }

      return record;
    });

    await logActivity({
      userId: user.id,
      action: "update",
      entityType: "profile",
      entityId: profile.id,
      summary: "Updated profile",
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved." };
  } catch (error) {
    console.error("[profile] save failed", error);
    return { ok: false, message: "Could not save the profile." };
  }
}

export async function saveEducationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = educationSchema.safeParse({
    id,
    institution: getString(formData, "institution"),
    location: getString(formData, "location"),
    startYear: getString(formData, "startYear") || 0,
    endYear: getString(formData, "endYear"),
    isCurrent: getBool(formData, "isCurrent"),
    order: getString(formData, "order") || 0,
    visible: getBool(formData, "visible"),
    vi: readLocaleBlock(formData, "vi", ["degree", "field", "description"]),
    en: readLocaleBlock(formData, "en", ["degree", "field", "description"]),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the education fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const endYear = data.isCurrent ? null : Number.parseInt(data.endYear, 10) || null;

  try {
    const record = await prisma.$transaction(async (tx) => {
      const common = {
        institution: data.institution,
        location: data.location || null,
        startYear: data.startYear,
        endYear,
        isCurrent: data.isCurrent,
        order: data.order,
        visible: data.visible,
      };
      const entry = id
        ? await tx.education.update({ where: { id }, data: common })
        : await tx.education.create({ data: common });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        if (block.degree.trim() || block.field.trim()) {
          await tx.educationTranslation.upsert({
            where: { educationId_locale: { educationId: entry.id, locale } },
            update: { degree: block.degree, field: block.field, description: block.description },
            create: { educationId: entry.id, locale, degree: block.degree, field: block.field, description: block.description },
          });
        } else {
          await tx.educationTranslation.deleteMany({ where: { educationId: entry.id, locale } });
        }
      }
      return entry;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "education",
      entityId: record.id,
      summary: `${id ? "Updated" : "Added"} education ${data.institution}`,
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Education saved." };
  } catch (error) {
    console.error("[education] save failed", error);
    return { ok: false, message: "Could not save the education entry." };
  }
}

export async function deleteEducationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;
  await prisma.education.delete({ where: { id } });
  await logActivity({ userId: user.id, action: "delete", entityType: "education", entityId: id, summary: "Deleted education entry" });
  revalidatePath("/", "layout");
}

export async function saveExperienceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = experienceSchema.safeParse({
    id,
    company: getString(formData, "company"),
    location: getString(formData, "location"),
    startDate: getString(formData, "startDate"),
    endDate: getString(formData, "endDate") || undefined,
    isCurrent: getBool(formData, "isCurrent"),
    order: getString(formData, "order") || 0,
    visible: getBool(formData, "visible"),
    vi: readLocaleBlock(formData, "vi", ["role", "summary", "achievements"]),
    en: readLocaleBlock(formData, "en", ["role", "summary", "achievements"]),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the experience fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const startDate = parseDateValue(data.startDate);
  if (!startDate) {
    return { ok: false, message: "Start date is invalid.", fieldErrors: { startDate: ["Enter a valid start date"] } };
  }

  try {
    const record = await prisma.$transaction(async (tx) => {
      const common = {
        company: data.company,
        location: data.location || null,
        startDate,
        endDate: data.isCurrent ? null : parseDateValue(data.endDate),
        isCurrent: data.isCurrent,
        order: data.order,
        visible: data.visible,
      };
      const entry = id
        ? await tx.experience.update({ where: { id }, data: common })
        : await tx.experience.create({ data: common });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        if (block.role.trim()) {
          await tx.experienceTranslation.upsert({
            where: { experienceId_locale: { experienceId: entry.id, locale } },
            update: { role: block.role, summary: block.summary, achievements: block.achievements },
            create: { experienceId: entry.id, locale, role: block.role, summary: block.summary, achievements: block.achievements },
          });
        } else {
          await tx.experienceTranslation.deleteMany({ where: { experienceId: entry.id, locale } });
        }
      }
      return entry;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "experience",
      entityId: record.id,
      summary: `${id ? "Updated" : "Added"} experience at ${data.company}`,
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Experience saved." };
  } catch (error) {
    console.error("[experience] save failed", error);
    return { ok: false, message: "Could not save the experience entry." };
  }
}

export async function deleteExperienceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;
  await prisma.experience.delete({ where: { id } });
  await logActivity({ userId: user.id, action: "delete", entityType: "experience", entityId: id, summary: "Deleted experience entry" });
  revalidatePath("/", "layout");
}

export async function saveSkillAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = skillSchema.safeParse({
    id,
    name: getString(formData, "name"),
    category: getString(formData, "category") || "engineering",
    level: getString(formData, "level") || 3,
    order: getString(formData, "order") || 0,
    visible: getBool(formData, "visible"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the skill fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const record = id
    ? await prisma.skill.update({ where: { id }, data })
    : await prisma.skill.create({ data });

  await logActivity({
    userId: user.id,
    action: id ? "update" : "create",
    entityType: "skill",
    entityId: record.id,
    summary: `${id ? "Updated" : "Added"} skill ${data.name}`,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Skill saved." };
}

export async function deleteSkillAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;
  await prisma.skill.delete({ where: { id } });
  await logActivity({ userId: user.id, action: "delete", entityType: "skill", entityId: id, summary: "Deleted skill" });
  revalidatePath("/", "layout");
}

export async function saveSocialLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = socialLinkSchema.safeParse({
    id,
    platform: getString(formData, "platform") || "other",
    url: getString(formData, "url"),
    label: getString(formData, "label"),
    order: getString(formData, "order") || 0,
    visible: getBool(formData, "visible"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the social link fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const record = id
    ? await prisma.socialLink.update({ where: { id }, data: { ...data, label: data.label || null } })
    : await prisma.socialLink.create({ data: { ...data, label: data.label || null } });

  await logActivity({
    userId: user.id,
    action: id ? "update" : "create",
    entityType: "socialLink",
    entityId: record.id,
    summary: `${id ? "Updated" : "Added"} social link ${data.platform}`,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Social link saved." };
}

export async function deleteSocialLinkAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;
  await prisma.socialLink.delete({ where: { id } });
  await logActivity({ userId: user.id, action: "delete", entityType: "socialLink", entityId: id, summary: "Deleted social link" });
  revalidatePath("/", "layout");
}
