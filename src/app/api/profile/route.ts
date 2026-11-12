import { getProfile, getSkills, getSocialLinks } from "@/server/queries/profile";
import { fail, ok, publicCache, resolveLocale } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const locale = resolveLocale(new URL(request.url).searchParams.get("locale"));
  if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

  const [profile, skills, socials] = await Promise.all([getProfile(), getSkills(), getSocialLinks()]);
  if (!profile) return fail("NOT_FOUND", "Profile has not been configured yet.", 404);

  const content = profile.translations.find((item) => item.locale === locale) ?? null;

  return ok(
    {
      id: profile.id,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      availableForWork: profile.availableForWork,
      avatar: profile.avatar,
      resumeUrl: profile.resumeUrl,
      content,
      // Both queries already exclude hidden rows.
      skills,
      socials,
    },
    { locale },
    publicCache,
  );
}
