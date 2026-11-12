import "server-only";
import { cache } from "react";
import { prisma } from "../db";
import { toMediaView } from "./media";
import type { MediaView } from "./types";

export type SiteSettings = {
  siteName: string;
  siteTagline: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  footerText: string;
  footerTextEn: string;
  contactEmail: string;
  contactPhone: string;
  contactLocation: string;
  logoMediaId: string;
  faviconMediaId: string;
  logo: MediaView | null;
  favicon: MediaView | null;
  postsPerPage: number;
  defaultTheme: "light" | "dark" | "system";
  showDemoBadge: boolean;
};

export const DEFAULT_SETTINGS: Omit<SiteSettings, "logo" | "favicon"> = {
  siteName: "Portfolio Studio",
  siteTagline: "Product design, engineering and digital art",
  seoTitle: "Portfolio Studio — Product designer & software engineer",
  seoDescription:
    "Personal portfolio with selected technology work, a digital art gallery and essays on design and engineering.",
  seoKeywords: "portfolio, product design, software engineering, digital art, writing",
  footerText: "Designed and built with care. Sample content for demonstration.",
  footerTextEn: "Designed and built with care. Sample content for demonstration.",
  contactEmail: "hello@example.com",
  contactPhone: "",
  contactLocation: "Ho Chi Minh City, Vietnam",
  logoMediaId: "",
  faviconMediaId: "",
  postsPerPage: 9,
  defaultTheme: "light",
  showDemoBadge: true,
};

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await prisma.siteSetting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const mediaIds = [map.get("logoMediaId"), map.get("faviconMediaId")].filter(
    (id): id is string => Boolean(id),
  );
  const media = mediaIds.length
    ? await prisma.media.findMany({ where: { id: { in: mediaIds } } })
    : [];
  const mediaById = new Map(media.map((item) => [item.id, item]));

  const perPage = Number.parseInt(map.get("postsPerPage") ?? "", 10);

  return {
    siteName: map.get("siteName") || DEFAULT_SETTINGS.siteName,
    siteTagline: map.get("siteTagline") || DEFAULT_SETTINGS.siteTagline,
    seoTitle: map.get("seoTitle") || DEFAULT_SETTINGS.seoTitle,
    seoDescription: map.get("seoDescription") || DEFAULT_SETTINGS.seoDescription,
    seoKeywords: map.get("seoKeywords") || DEFAULT_SETTINGS.seoKeywords,
    footerText: map.get("footerText") || DEFAULT_SETTINGS.footerText,
    footerTextEn: map.get("footerTextEn") ?? "",
    contactEmail: map.get("contactEmail") || DEFAULT_SETTINGS.contactEmail,
    contactPhone: map.get("contactPhone") || "",
    contactLocation: map.get("contactLocation") || DEFAULT_SETTINGS.contactLocation,
    logoMediaId: map.get("logoMediaId") || "",
    faviconMediaId: map.get("faviconMediaId") || "",
    logo: toMediaView(mediaById.get(map.get("logoMediaId") ?? "")),
    favicon: toMediaView(mediaById.get(map.get("faviconMediaId") ?? "")),
    postsPerPage: Number.isFinite(perPage) && perPage >= 3 && perPage <= 48 ? perPage : DEFAULT_SETTINGS.postsPerPage,
    defaultTheme: (map.get("defaultTheme") as SiteSettings["defaultTheme"]) || "light",
    showDemoBadge: map.get("showDemoBadge") !== "false",
  };
});

export async function getSettingValue(key: string): Promise<string | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function upsertSettings(entries: Record<string, string>, group = "general"): Promise<void> {
  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.siteSetting.upsert({
        where: { key },
        update: { value, group },
        create: { key, value, group },
      }),
    ),
  );
}
