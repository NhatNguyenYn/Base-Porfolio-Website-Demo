import { afterAll, describe, expect, it } from "vitest";
import { readingMinutes, safeInternalPath, slugify, truncate } from "@/lib/utils";
import { LocalStorageDriver, assertSafeKey } from "@/server/storage/local";

describe("slugify", () => {
  it("handles Vietnamese diacritics", () => {
    expect(slugify("Tên Của Bạn")).toBe("ten-cua-ban");
    expect(slugify("Đài quan sát — 2026")).toBe("dai-quan-sat-2026");
    expect(slugify("  Multiple   spaces  ")).toBe("multiple-spaces");
  });
});

describe("readingMinutes", () => {
  it("returns at least one minute", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("một hai ba")).toBe(1);
  });

  it("scales with length", () => {
    const long = Array.from({ length: 900 }, () => "word").join(" ");
    expect(readingMinutes(long)).toBeGreaterThan(1);
  });
});

describe("safeInternalPath", () => {
  it("blocks open redirects", () => {
    expect(safeInternalPath("https://evil.example", "/admin")).toBe("/admin");
    expect(safeInternalPath("//evil.example", "/admin")).toBe("/admin");
    expect(safeInternalPath("/admin/projects", "/admin")).toBe("/admin/projects");
  });
});

describe("truncate", () => {
  it("adds an ellipsis only when needed", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("a very long sentence", 8)).toContain("…");
  });
});

describe("local storage driver", () => {
  const driver = new LocalStorageDriver();
  const key = `tests/${Date.now()}-fixture.txt`;
  const body = Buffer.from("portfolio media fixture");

  it("stores, reads and deletes an object", async () => {
    const stored = await driver.put(key, body, "text/plain");
    expect(stored.bytes).toBe(body.byteLength);

    const read = await driver.get(key);
    expect(read?.body.toString()).toBe("portfolio media fixture");

    await driver.delete(key);
    expect(await driver.get(key)).toBeNull();
  });

  it("refuses path traversal", () => {
    expect(() => assertSafeKey("../secrets.txt")).toThrow();
    expect(() => assertSafeKey("/etc/passwd")).not.toThrow(); // leading slash is stripped
    expect(() => assertSafeKey("nested/ok-name.png")).not.toThrow();
    expect(() => assertSafeKey("bad key.png")).toThrow();
  });

  it("builds public URLs from the key", () => {
    expect(driver.urlFor("art/cover-01.png")).toBe("/media/art/cover-01.png");
    // Keys are validated before they ever reach the URL builder.
    expect(() => driver.urlFor("../escape.png")).toThrow();
  });

  afterAll(async () => {
    await driver.delete(key);
  });
});
