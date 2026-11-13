import { getSettings } from "@/server/queries/settings";
import { ok, publicCache, withApi } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Public subset of site settings — no internal media ids or admin-only values. */
export async function GET() {
  return withApi(undefined, async () => {
    const settings = await getSettings();

    return ok(
      {
        siteName: settings.siteName,
        siteTagline: settings.siteTagline,
        seoTitle: settings.seoTitle,
        seoDescription: settings.seoDescription,
        seoKeywords: settings.seoKeywords,
        footerText: settings.footerText,
        footerTextEn: settings.footerTextEn,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        contactLocation: settings.contactLocation,
        logo: settings.logo,
        favicon: settings.favicon,
        defaultTheme: settings.defaultTheme,
        showDemoBadge: settings.showDemoBadge,
        defaultLocale: "vi",
        locales: ["vi", "en"],
      },
      {},
      publicCache,
    );
  });
}
