// Unit tests for the flower code-name catalog (Phase 10, Agent G).
// Pure helpers only — no database. The catalog lives in src/lib/flowers.ts:
// 30 flowers, stable URL-safe codes, VI + EN names.
import { describe, expect, it } from "vitest";
import { FLOWER_CODES, FLOWERS, flowerNameFor } from "@/lib/flowers";
import { freeFlowerCodes } from "./helpers/phase10";

describe("FLOWERS catalog", () => {
  it("has exactly 30 flowers", () => {
    expect(FLOWERS).toHaveLength(30);
  });

  it("has 30 unique codes", () => {
    const codes = FLOWERS.map((flower) => flower.code);
    expect(new Set(codes).size).toBe(30);
    expect(FLOWER_CODES.size).toBe(30);
  });

  it("uses URL-safe slug codes (lowercase ASCII, hyphens only)", () => {
    for (const flower of FLOWERS) {
      expect(flower.code).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("has a non-empty VI and EN name for every flower", () => {
    for (const flower of FLOWERS) {
      expect(flower.vi.trim().length).toBeGreaterThan(0);
      expect(flower.en.trim().length).toBeGreaterThan(0);
    }
  });

  it("has distinct VI names and distinct EN names (no two flowers share a display name)", () => {
    expect(new Set(FLOWERS.map((flower) => flower.vi)).size).toBe(30);
    expect(new Set(FLOWERS.map((flower) => flower.en)).size).toBe(30);
  });

  it("contains the flowers named in the brief", () => {
    const codes = new Set(FLOWERS.map((flower) => flower.code));
    for (const expected of [
      "tulip",
      "hong",
      "lan",
      "cuc",
      "sen",
      "mai",
      "dao",
      "huong-duong",
      "lavender",
      "cam-chuong",
    ]) {
      expect(codes.has(expected)).toBe(true);
    }
  });

  it("FLOWER_CODES matches the catalog exactly", () => {
    expect([...FLOWER_CODES].sort()).toEqual(FLOWERS.map((flower) => flower.code).sort());
  });
});

describe("flowerNameFor", () => {
  it("returns the Vietnamese name for locale vi", () => {
    expect(flowerNameFor("tulip", "vi")).toBe("Tulip");
    expect(flowerNameFor("hong", "vi")).toBe("Hồng");
    expect(flowerNameFor("huong-duong", "vi")).toBe("Hướng dương");
    expect(flowerNameFor("anh-dao", "vi")).toBe("Anh đào");
  });

  it("returns the English name for locale en", () => {
    expect(flowerNameFor("hong", "en")).toBe("Rose");
    expect(flowerNameFor("sen", "en")).toBe("Lotus");
    expect(flowerNameFor("huong-duong", "en")).toBe("Sunflower");
    expect(flowerNameFor("anh-dao", "en")).toBe("Cherry blossom");
  });

  it("falls back to the raw code for an unknown/stale code instead of crashing", () => {
    expect(flowerNameFor("hoa-khong-ton-tai", "vi")).toBe("hoa-khong-ton-tai");
    expect(flowerNameFor("hoa-khong-ton-tai", "en")).toBe("hoa-khong-ton-tai");
    expect(flowerNameFor("", "vi")).toBe("");
  });
});

describe("free-list computation", () => {
  it("returns all 30 codes when nothing is used", () => {
    expect(freeFlowerCodes(new Set())).toHaveLength(30);
  });

  it("excludes used codes and only used codes", () => {
    const used = new Set(["tulip", "hong", "sen"]);
    const free = freeFlowerCodes(used);
    expect(free).toHaveLength(27);
    expect(free).not.toContain("tulip");
    expect(free).not.toContain("hong");
    expect(free).not.toContain("sen");
    expect(free).toContain("lan");
  });

  it("is empty when all 30 flowers are in use (pool exhaustion)", () => {
    const used = new Set(FLOWERS.map((flower) => flower.code));
    expect(freeFlowerCodes(used)).toEqual([]);
  });

  it("ignores unknown codes in the used set", () => {
    expect(freeFlowerCodes(new Set(["not-a-flower"]))).toHaveLength(30);
  });
});
