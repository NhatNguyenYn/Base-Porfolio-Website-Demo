export type Interest = { title: string; description: string };

/**
 * Interests are stored as plain lines in the CMS: "Title | Description".
 * Lines starting with # are treated as comments.
 */
export function parseInterests(raw: string | null | undefined): Interest[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const clean = line.replace(/^[-*•]\s*/, "");
      const [title, ...rest] = clean.split("|");
      return { title: (title ?? "").trim(), description: rest.join("|").trim() };
    })
    .filter((item) => item.title.length > 0);
}
