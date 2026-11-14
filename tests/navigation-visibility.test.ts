import { describe, expect, it } from "vitest";
import { localeHref } from "@/i18n/config";
import {
  matchesNav,
  navPaths,
  navVisibility,
  siteNav,
  visibleNavKeys,
  type NavVisibility,
} from "@/data/navigation";

const labels = {
  home: "Home",
  about: "About",
  projects: "Work",
  art: "Art",
  blog: "Blog",
  booking: "Booking",
  contact: "Contact",
};

describe("navigation visibility", () => {
  it("hides Projects by default and keeps every other entry", () => {
    expect(navVisibility.projects).toBe(false);
    expect(navVisibility.booking).toBe(true);
    expect(visibleNavKeys()).toEqual(["home", "about", "art", "blog", "booking", "contact"]);
  });

  it("omits Projects from both locales without changing other entries", () => {
    for (const locale of ["vi", "en"] as const) {
      const items = siteNav(locale, labels);
      expect(items.map((item) => item.key)).toEqual(["home", "about", "art", "blog", "booking", "contact"]);
      expect(items.some((item) => item.key === "projects")).toBe(false);
      expect(items.map((item) => item.href)).toEqual([
        localeHref(locale, ""),
        localeHref(locale, "/about"),
        localeHref(locale, "/art"),
        localeHref(locale, "/blog"),
        localeHref(locale, "/dat-lich-khao-sat"),
        localeHref(locale, "/contact"),
      ]);
    }
  });

  it("uses the dictionary label for the active locale", () => {
    const vi = siteNav("vi", { ...labels, projects: "Dự án" });
    const en = siteNav("en", { ...labels, projects: "Work" });
    expect(vi.find((item) => item.key === "about")?.label).toBe("About");
    expect(en.find((item) => item.key === "art")?.label).toBe("Art");
  });

  it("can show a hidden entry again by flipping only the config", () => {
    const visible: NavVisibility = { ...navVisibility, projects: true };
    const keys = siteNav("vi", labels, visible).map((item) => item.key);
    expect(keys).toEqual(["home", "about", "projects", "art", "blog", "booking", "contact"]);
    expect(siteNav("vi", labels, visible)[2].href).toBe("/vi/projects");
  });

  it("supports hiding any other entry without code changes", () => {
    const withoutBlogAndContact: NavVisibility = {
      ...navVisibility,
      blog: false,
      contact: false,
    };
    expect(visibleNavKeys(withoutBlogAndContact)).toEqual(["home", "about", "art", "booking"]);
    expect(siteNav("en", labels, withoutBlogAndContact)).toHaveLength(4);
  });

  it("keeps routing untouched for a hidden page", () => {
    expect(navPaths.projects).toBe("/projects");
    expect(matchesNav("projects", "/projects")).toBe(true);
    expect(matchesNav("projects", "/projects/aurora-design-system")).toBe(true);
  });

  it("marks booking pages active under the booking entry", () => {
    expect(navPaths.booking).toBe("/dat-lich-khao-sat");
    expect(matchesNav("booking", "/dat-lich-khao-sat")).toBe(true);
    expect(matchesNav("booking", "/dat-lich-khao-sat/tra-cuu")).toBe(true);
  });
});
