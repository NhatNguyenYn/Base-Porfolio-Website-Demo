import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { slugify } from "./utils";

export type TocItem = { id: string; text: string; level: 2 | 3 };

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Renders trusted-but-user-submitted Markdown to sanitized HTML.
 * Headings get stable ids so the article table of contents can link to them.
 */
export async function renderMarkdown(markdown: string): Promise<{ html: string; toc: TocItem[] }> {
  if (!markdown?.trim()) return { html: "", toc: [] };

  const raw = await marked.parse(markdown, { gfm: true, breaks: false, async: true });

  const toc: TocItem[] = [];
  const used = new Map<string, number>();

  const withIds = raw.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_match, level: string, inner: string) => {
    const text = stripTags(inner);
    const base = slugify(text) || `section-${toc.length + 1}`;
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen + 1}`;
    toc.push({ id, text, level: Number(level) as 2 | 3 });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });

  const html = sanitizeHtml(withIds, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "figure",
      "figcaption",
      "h1",
      "h2",
      "h3",
      "h4",
      "del",
      "ins",
      "mark",
      "abbr",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      code: ["class"],
      pre: ["class"],
      th: ["align"],
      td: ["align"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
        },
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: attribs.loading || "lazy" },
      }),
    },
  });

  return { html, toc };
}

/** Sanitized HTML for short rich-text fragments coming from the CMS. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "a", "ul", "ol", "li", "blockquote", "code", "h2", "h3"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
}
