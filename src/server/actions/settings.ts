"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "../auth";
import { logActivity } from "../audit";
import { upsertSettings } from "../queries/settings";
import { settingsSchema, zodFieldErrors } from "@/lib/validation";
import { getBool, getString } from "./helpers";
import type { ActionState } from "@/lib/action-state";

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireSuperAdmin();

  const parsed = settingsSchema.safeParse({
    siteName: getString(formData, "siteName"),
    siteTagline: getString(formData, "siteTagline"),
    seoTitle: getString(formData, "seoTitle"),
    seoDescription: getString(formData, "seoDescription"),
    seoKeywords: getString(formData, "seoKeywords"),
    footerText: getString(formData, "footerText"),
    footerTextEn: getString(formData, "footerTextEn"),
    contactEmail: getString(formData, "contactEmail"),
    contactPhone: getString(formData, "contactPhone"),
    contactLocation: getString(formData, "contactLocation"),
    logoMediaId: getString(formData, "logoMediaId") || undefined,
    faviconMediaId: getString(formData, "faviconMediaId") || undefined,
    postsPerPage: getString(formData, "postsPerPage") || 9,
    defaultTheme: getString(formData, "defaultTheme") || "light",
    showDemoBadge: getBool(formData, "showDemoBadge"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  await upsertSettings({
    siteName: data.siteName,
    siteTagline: data.siteTagline,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    seoKeywords: data.seoKeywords,
    footerText: data.footerText,
    footerTextEn: data.footerTextEn,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    contactLocation: data.contactLocation,
    logoMediaId: data.logoMediaId ?? "",
    faviconMediaId: data.faviconMediaId ?? "",
    postsPerPage: String(data.postsPerPage),
    defaultTheme: data.defaultTheme,
    showDemoBadge: data.showDemoBadge ? "true" : "false",
  });

  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "settings",
    summary: "Updated website settings",
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}
