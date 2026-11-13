import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSiteContext, type SiteContextLoaders } from "@/lib/services/site-context";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/server/queries/settings";
import type { ProfileView, SocialLinkView } from "@/server/queries/profile";

const settings = { ...DEFAULT_SETTINGS, logo: null, favicon: null } as SiteSettings;

const profile = {
  id: "profile-1",
  email: "hello@test.local",
  phone: "",
  location: "Test City",
  resumeUrl: "",
  availableForWork: true,
  avatar: null,
  translations: [],
} as ProfileView;

const socials: SocialLinkView[] = [{ id: "s1", platform: "github", url: "https://example.com", label: "GitHub" }];

function loaders(overrides: Partial<SiteContextLoaders> = {}): SiteContextLoaders {
  return {
    settings: async () => settings,
    profile: async () => profile,
    socials: async () => socials,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("site context", () => {
  it("loads the shell when every query succeeds", async () => {
    const context = await loadSiteContext(loaders());

    expect(context.status).toBe("ok");
    if (context.status !== "ok") return;
    expect(context.settings.siteName).toBe(settings.siteName);
    expect(context.profile?.email).toBe("hello@test.local");
    expect(context.socials).toHaveLength(1);
    expect(context.degraded).toBe(false);
  });

  it("reports unavailable and logs when the essential query fails (database outage)", async () => {
    const error = new Error("Can't reach database server at localhost:5433");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingSettings = loaders({
      settings: async () => {
        throw error;
      },
    });

    const context = await loadSiteContext(failingSettings);

    expect(context.status).toBe("unavailable");
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain("essential query failed");
    expect(log.mock.calls[0][1]).toBe(error);
  });

  it("does not treat an empty profile as an outage (not-found vs database error)", async () => {
    const context = await loadSiteContext(loaders({ profile: async () => null }));

    expect(context.status).toBe("ok");
    if (context.status !== "ok") return;
    expect(context.profile).toBeNull();
    expect(context.degraded).toBe(false);
  });

  it("keeps the site up when an optional query fails and logs it", async () => {
    const error = new Error("socialLink query timeout");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const context = await loadSiteContext(
      loaders({
        socials: async () => {
          throw error;
        },
      }),
    );

    expect(context.status).toBe("ok");
    if (context.status !== "ok") return;
    expect(context.socials).toEqual([]);
    expect(context.degraded).toBe(true);
    expect(String(log.mock.calls[0][0])).toContain("optional query failed (socials)");
  });

  it("keeps the site up when the optional profile query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const context = await loadSiteContext(
      loaders({
        profile: async () => {
          throw new Error("profile query failed");
        },
      }),
    );

    expect(context.status).toBe("ok");
    if (context.status !== "ok") return;
    expect(context.profile).toBeNull();
    expect(context.socials).toHaveLength(1);
    expect(context.degraded).toBe(true);
  });

  it("recovers once the database answers again (no sticky outage state)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let databaseUp = false;
    const flaky = loaders({
      settings: async () => {
        if (!databaseUp) throw new Error("ECONNREFUSED");
        return settings;
      },
    });

    expect((await loadSiteContext(flaky)).status).toBe("unavailable");

    databaseUp = true;
    const recovered = await loadSiteContext(flaky);
    expect(recovered.status).toBe("ok");
    if (recovered.status !== "ok") return;
    expect(recovered.settings.siteName).toBe(settings.siteName);
  });
});
