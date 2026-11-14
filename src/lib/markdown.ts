import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { slugify } from "./utils";

export type TocItem = { id: string; text: string; level: 2 | 3 };
export type MarkdownOptions = { editorial?: boolean };

type QaPair = { question: string; answer: string };
type Segment = { type: "markdown"; value: string } | { type: "qa"; pairs: QaPair[] };

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Interview blocks are opt-in Markdown, only interpreted by the editorial
 * template:
 *
 *   :::qa
 *   Q: Câu hỏi?
 *   A: Câu trả lời, có thể nhiều dòng.
 *   Q: Câu hỏi tiếp theo?
 *   A: ...
 *   :::
 *
 * Any other content is left to `marked`, so a normal article that happens to
 * contain "Q:" is never rewritten.
 */
function splitInterviewBlocks(markdown: string): Segment[] {
  const pattern = /^:::qa[ \t]*\r?\n([\s\S]*?)^:::[ \t]*$/gm;
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "markdown", value: markdown.slice(lastIndex, match.index) });
    }
    const pairs = parseQaPairs(match[1]);
    if (pairs.length > 0) {
      segments.push({ type: "qa", pairs });
    } else {
      // Malformed block: render it as ordinary text rather than dropping it.
      segments.push({ type: "markdown", value: match[0] });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < markdown.length) {
    segments.push({ type: "markdown", value: markdown.slice(lastIndex) });
  }
  return segments;
}

function parseQaPairs(body: string): QaPair[] {
  const pairs: QaPair[] = [];
  let question: string[] | null = null;
  let answer: string[] | null = null;

  const flush = () => {
    if (question && answer) {
      const q = question.join(" ").trim();
      const a = answer.join("\n").trim();
      if (q && a) pairs.push({ question: q, answer: a });
    }
    question = null;
    answer = null;
  };

  for (const line of body.split(/\r?\n/)) {
    const marker = /^\s*([QA]|Hỏi|Đáp|Câu hỏi|Trả lời)\s*[:：]\s*(.*)$/i.exec(line);
    if (marker) {
      const label = marker[1].toLowerCase();
      const isQuestion = label === "q" || label === "hỏi" || label === "câu hỏi";
      if (isQuestion) {
        flush();
        question = [marker[2]];
      } else if (question) {
        answer = [marker[2]];
      }
      continue;
    }
    if (answer) answer.push(line);
    else if (question) question.push(line);
  }
  flush();
  return pairs;
}

function renderParagraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function renderQaPairs(pairs: QaPair[]): string {
  return pairs
    .map(
      (pair) =>
        `<dl class="qa-pair">` +
        `<dt class="qa-question">${renderParagraphs(pair.question)}</dt>` +
        `<dd class="qa-answer">${renderParagraphs(pair.answer)}</dd>` +
        `</dl>`,
    )
    .join("\n");
}

/**
 * Renders trusted-but-user-submitted Markdown to sanitized HTML.
 * Headings get stable ids so the article table of contents can link to them.
 */
export async function renderMarkdown(
  markdown: string,
  options: MarkdownOptions = {},
): Promise<{ html: string; toc: TocItem[] }> {
  if (!markdown?.trim()) return { html: "", toc: [] };

  const toc: TocItem[] = [];
  const used = new Map<string, number>();

  async function renderSegment(segment: string): Promise<string> {
    if (!segment.trim()) return "";
    const raw = await marked.parse(segment, { gfm: true, breaks: false, async: true });

    // 8C-2: content must never create a second H1 — the page template already
    // renders the article/project title as the only H1. Demote any H1 the
    // author wrote in Markdown (or embedded as raw HTML) to H2 *before* ids
    // are assigned, so it still lands in the table of contents as an H2.
    // Done on the parsed HTML (not the source) so `#` lines inside fenced
    // code blocks are left untouched.
    const demoted = raw
      .replace(/<h1(\s[^>]*)?>/gi, "<h2>")
      .replace(/<\/h1>/gi, "</h2>");

    const withIds = demoted.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_match, level: string, inner: string) => {
      const text = stripTags(inner);
      const base = slugify(text) || `section-${toc.length + 1}`;
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      const id = seen === 0 ? base : `${base}-${seen + 1}`;
      toc.push({ id, text, level: Number(level) as 2 | 3 });
      return `<h${level} id="${id}">${inner}</h${level}>`;
    });

    return sanitizeHtml(withIds, {
      allowedTags: [
        ...sanitizeHtml.defaults.allowedTags,
        "img",
        "figure",
        "figcaption",
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
  }

  /** Turn a Markdown image (with alt as caption) into a semantic figure. */
  function toFigures(html: string): string {
    return html.replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/g, (_match, img: string) => {
      const alt = /alt="([^"]*)"/.exec(img)?.[1] ?? "";
      return `<figure>${img}${alt ? `<figcaption>${alt}</figcaption>` : ""}</figure>`;
    });
  }

  if (!options.editorial) {
    return { html: await renderSegment(markdown), toc };
  }

  const parts: string[] = [];
  for (const segment of splitInterviewBlocks(markdown)) {
    if (segment.type === "qa") {
      parts.push(renderQaPairs(segment.pairs));
    } else {
      parts.push(toFigures(await renderSegment(segment.value)));
    }
  }

  return { html: parts.filter(Boolean).join("\n"), toc };
}

/** Sanitized HTML for short rich-text fragments coming from the CMS. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "a", "ul", "ol", "li", "blockquote", "code", "h2", "h3"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
}
