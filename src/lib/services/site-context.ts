import "server-only";
import { getSettings, type SiteSettings } from "@/server/queries/settings";
import { getProfile, getSocialLinks, type ProfileView, type SocialLinkView } from "@/server/queries/profile";

/**
 * Data needed to render the public shell (header, footer, SEO, JSON-LD).
 *
 * Classification:
 *  - essential: site settings. Without them there is no site name, contact
 *    address, footer or theme, so the only honest state is "temporarily
 *    unavailable" — never a page that looks live but is missing its identity.
 *  - optional: profile and social links. They enrich the shell and JSON-LD;
 *    a failure is logged and the shell renders without them.
 */
export type SiteContextLoaders = {
  settings: () => Promise<SiteSettings>;
  profile: () => Promise<ProfileView | null>;
  socials: () => Promise<SocialLinkView[]>;
};

export type SiteContext =
  | {
      status: "ok";
      settings: SiteSettings;
      profile: ProfileView | null;
      socials: SocialLinkView[];
      /** Set when an optional query failed so callers can surface a notice. */
      degraded: boolean;
    }
  | { status: "unavailable" };

const defaultLoaders: SiteContextLoaders = {
  settings: getSettings,
  profile: getProfile,
  socials: getSocialLinks,
};

export async function loadSiteContext(loaders: SiteContextLoaders = defaultLoaders): Promise<SiteContext> {
  let settings: SiteSettings;
  try {
    settings = await loaders.settings();
  } catch (error) {
    // Database down or schema mismatch: log the cause and show an explicit
    // unavailable state instead of fabricating defaults that hide the outage.
    console.error("[site-context] essential query failed (settings); public site is unavailable", error);
    return { status: "unavailable" };
  }

  const [profileResult, socialsResult] = await Promise.allSettled([loaders.profile(), loaders.socials()]);

  let degraded = false;
  let profile: ProfileView | null = null;
  if (profileResult.status === "fulfilled") {
    profile = profileResult.value;
  } else {
    degraded = true;
    console.error("[site-context] optional query failed (profile); rendering shell without it", profileResult.reason);
  }

  let socials: SocialLinkView[] = [];
  if (socialsResult.status === "fulfilled") {
    socials = socialsResult.value;
  } else {
    degraded = true;
    console.error("[site-context] optional query failed (socials); rendering shell without them", socialsResult.reason);
  }

  return { status: "ok", settings, profile, socials, degraded };
}
