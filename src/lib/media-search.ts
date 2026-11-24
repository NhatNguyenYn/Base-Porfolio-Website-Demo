import type { MediaView } from "@/server/queries/types";

/**
 * Fold accents + case so "thu ha" matches "Thu Hà" and "la chinh minh"
 * matches "Là Chính Mình". NFD splits most Vietnamese vowels into a base
 * letter + combining mark (stripped below); "đ" is a letter of its own, so
 * it is folded by hand.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d");
}

/**
 * Filter picker items by title or alt text. Pure function (tested in Node);
 * the picker dialog renders the result. An empty query returns everything,
 * in the same order.
 */
export function filterMediaItems(items: MediaView[], query: string): MediaView[] {
  const needle = normalizeSearchText(query).trim();
  if (!needle) return items;
  return items.filter((item) =>
    [item.title, item.alt].some((field) => normalizeSearchText(field ?? "").includes(needle)),
  );
}
