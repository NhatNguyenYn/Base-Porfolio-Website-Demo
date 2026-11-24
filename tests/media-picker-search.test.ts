/**
 * Media picker search (picker limit fix, 24/11).
 *
 * The picker dialog used to show only the 120 newest library images with no
 * way to reach an older one — "Logo 1" sat at position 139 and could not be
 * picked as favicon, logo or cover. The dialog now loads up to 500 images
 * and filters them by title/alt here, accents ignored, so "thu ha" finds
 * "Thu Hà". The filter itself is pure, so it is tested in Node; the dialog
 * half is covered by the live browser check (open the Favicon picker, type
 * "Logo 1", the original appears).
 */
import { describe, expect, it } from "vitest";
import { filterMediaItems, normalizeSearchText } from "@/lib/media-search";
import type { MediaView } from "@/server/queries/types";

function item(title: string, alt = ""): MediaView {
  return { id: title, url: `/media/${title}`, width: 500, height: 500, alt, title, blurDataUrl: null };
}

const LIBRARY = [
  item("Logo 1"),
  item("Thu Hà Ruby — avatar", "Ảnh đại diện"),
  item("Là Chính Mình 1"),
  item("Đạo Phật"),
  item("THIEN SU THICH NHAT HANH 11", "Thiền sư Thích Nhất Hạnh"),
];

describe("normalizeSearchText", () => {
  it("lowercases and strips Vietnamese accents", () => {
    expect(normalizeSearchText("Thu Hà")).toBe("thu ha");
    expect(normalizeSearchText("Là Chính Mình")).toBe("la chinh minh");
  });

  it("folds đ into d", () => {
    expect(normalizeSearchText("Đạo Phật")).toBe("dao phat");
  });
});

describe("filterMediaItems", () => {
  it("returns everything, in order, for an empty or blank query", () => {
    expect(filterMediaItems(LIBRARY, "")).toEqual(LIBRARY);
    expect(filterMediaItems(LIBRARY, "   ")).toEqual(LIBRARY);
  });

  it("matches by title, case-insensitive", () => {
    expect(filterMediaItems(LIBRARY, "logo")).toEqual([LIBRARY[0]]);
    expect(filterMediaItems(LIBRARY, "LOGO 1")).toEqual([LIBRARY[0]]);
  });

  it("matches by alt text when the title does not contain it", () => {
    expect(filterMediaItems(LIBRARY, "đại diện")).toEqual([LIBRARY[1]]);
    expect(filterMediaItems(LIBRARY, "thich nhat hanh")).toEqual([LIBRARY[4]]);
  });

  it("matches without accents", () => {
    expect(filterMediaItems(LIBRARY, "thu ha")).toEqual([LIBRARY[1]]);
    expect(filterMediaItems(LIBRARY, "la chinh minh")).toEqual([LIBRARY[2]]);
    expect(filterMediaItems(LIBRARY, "dao phat")).toEqual([LIBRARY[3]]);
  });

  it("matches a substring and returns every hit", () => {
    expect(filterMediaItems(LIBRARY, "1")).toEqual([LIBRARY[0], LIBRARY[2], LIBRARY[4]]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterMediaItems(LIBRARY, "không có ảnh này")).toEqual([]);
  });
});
