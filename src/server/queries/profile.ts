import "server-only";
import { cache } from "react";
import type { Locale } from "@/i18n/config";
import { prisma } from "../db";
import { toMediaView } from "./media";
import { pickTranslation, type MediaView } from "./types";

export type ProfileTranslationView = {
  locale: string;
  fullName: string;
  title: string;
  shortBio: string;
  longBio: string;
  interests: string;
  philosophy: string;
  futureGoals: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ProfileView = {
  id: string;
  email: string;
  phone: string;
  location: string;
  resumeUrl: string;
  availableForWork: boolean;
  avatar: MediaView | null;
  translations: ProfileTranslationView[];
};

export type ProfileContent = {
  profile: ProfileView;
  content: ProfileTranslationView | null;
  missing: boolean;
};

export const getProfile = cache(async (): Promise<ProfileView | null> => {
  const profile = await prisma.profile.findFirst({
    include: { avatarMedia: true, translations: true },
    orderBy: { createdAt: "asc" },
  });
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    phone: profile.phone ?? "",
    location: profile.location ?? "",
    resumeUrl: profile.resumeUrl ?? "",
    availableForWork: profile.availableForWork,
    avatar: toMediaView(profile.avatarMedia),
    translations: profile.translations.map((item) => ({
      locale: item.locale,
      fullName: item.fullName,
      title: item.title,
      shortBio: item.shortBio,
      longBio: item.longBio,
      interests: item.interests,
      philosophy: item.philosophy,
      futureGoals: item.futureGoals,
      seoTitle: item.seoTitle,
      seoDescription: item.seoDescription,
    })),
  };
});

export function profileContent(profile: ProfileView | null, locale: Locale): ProfileContent | null {
  if (!profile) return null;
  const { row, missing } = pickTranslation(profile.translations, locale);
  return { profile, content: row, missing };
}

export type EducationView = {
  id: string;
  institution: string;
  location: string;
  startYear: number;
  endYear: number | null;
  isCurrent: boolean;
  degree: string;
  field: string;
  description: string;
};

export async function getEducation(locale: Locale): Promise<EducationView[]> {
  const rows = await prisma.education.findMany({
    where: { visible: true },
    orderBy: [{ order: "asc" }, { startYear: "desc" }],
    include: { translations: { where: { locale } } },
  });

  return rows.map((row) => {
    const translation = row.translations[0];
    return {
      id: row.id,
      institution: row.institution,
      location: row.location ?? "",
      startYear: row.startYear,
      endYear: row.endYear,
      isCurrent: row.isCurrent,
      degree: translation?.degree ?? "",
      field: translation?.field ?? "",
      description: translation?.description ?? "",
    };
  });
}

export type ExperienceView = {
  id: string;
  company: string;
  location: string;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  role: string;
  summary: string;
  achievements: string;
};

export async function getExperience(locale: Locale): Promise<ExperienceView[]> {
  const rows = await prisma.experience.findMany({
    where: { visible: true },
    orderBy: [{ order: "asc" }, { startDate: "desc" }],
    include: { translations: { where: { locale } } },
  });

  return rows.map((row) => {
    const translation = row.translations[0];
    return {
      id: row.id,
      company: row.company,
      location: row.location ?? "",
      startDate: row.startDate,
      endDate: row.endDate,
      isCurrent: row.isCurrent,
      role: translation?.role ?? "",
      summary: translation?.summary ?? "",
      achievements: translation?.achievements ?? "",
    };
  });
}

export type SkillView = {
  id: string;
  name: string;
  category: string;
  level: number;
};

export const getSkills = cache(async (): Promise<SkillView[]> => {
  const rows = await prisma.skill.findMany({
    where: { visible: true },
    orderBy: [{ category: "asc" }, { order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, level: true },
  });
  return rows;
});

export type SocialLinkView = {
  id: string;
  platform: string;
  url: string;
  label: string;
};

export const getSocialLinks = cache(async (): Promise<SocialLinkView[]> => {
  const rows = await prisma.socialLink.findMany({
    where: { visible: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, platform: true, url: true, label: true },
  });
  return rows.map((row) => ({ ...row, label: row.label ?? row.platform }));
});

/** Admin variants: include hidden rows. */
export async function getProfileForAdmin() {
  return prisma.profile.findFirst({
    include: { avatarMedia: true, translations: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getEducationForAdmin() {
  return prisma.education.findMany({
    orderBy: [{ order: "asc" }, { startYear: "desc" }],
    include: { translations: true },
  });
}

export async function getExperienceForAdmin() {
  return prisma.experience.findMany({
    orderBy: [{ order: "asc" }, { startDate: "desc" }],
    include: { translations: true },
  });
}

export async function getSkillsForAdmin() {
  return prisma.skill.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
}

export async function getSocialLinksForAdmin() {
  return prisma.socialLink.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
}
