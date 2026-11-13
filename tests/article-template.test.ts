import { describe, expect, it } from "vitest";
import { isArticleTemplate, normalizeArticleTemplate } from "@/lib/article-template";
import { renderMarkdown } from "@/lib/markdown";

describe("article template selection", () => {
  it("defaults unknown or missing values to the original layout", () => {
    expect(normalizeArticleTemplate(undefined)).toBe("default");
    expect(normalizeArticleTemplate(null)).toBe("default");
    expect(normalizeArticleTemplate("")).toBe("default");
    expect(normalizeArticleTemplate("magazine")).toBe("default");
  });

  it("keeps the editorial choice", () => {
    expect(normalizeArticleTemplate("editorial")).toBe("editorial");
    expect(normalizeArticleTemplate("default")).toBe("default");
    expect(isArticleTemplate("editorial")).toBe(true);
    expect(isArticleTemplate("other")).toBe(false);
  });
});

describe("editorial Markdown", () => {
  const interview = `## Mở đầu

Một đoạn dẫn.

:::qa
Q: Anh bắt đầu thế nào?
A: Tôi bắt đầu từ một trang giấy trắng.

Và một buổi sáng mưa.
Q: Điều gì khó nhất?
A: Giữ được sự **tập trung**.
:::

> Trích dẫn nổi bật.

## Kết

Kết bài.`;

  it("renders interview blocks as question/answer pairs", async () => {
    const { html, toc } = await renderMarkdown(interview, { editorial: true });
    expect(html).toContain('class="qa-pair"');
    expect(html).toContain('class="qa-question"');
    expect(html).toContain('class="qa-answer"');
    expect(html).toContain('<dl class="qa-pair">');
    expect(html).not.toContain("qa-label");
    expect(html).toContain("Anh bắt đầu thế nào?");
    expect(html).toContain("Và một buổi sáng mưa.");
    expect(html).not.toContain(":::qa");
    // Headings outside the block still feed the table of contents.
    expect(toc.map((item) => item.text)).toEqual(["Mở đầu", "Kết"]);
  });

  it("escapes HTML inside an interview answer", async () => {
    const { html } = await renderMarkdown(`:::qa\nQ: Safe?\nA: <script>alert(1)</script>\n:::`, {
      editorial: true,
    });
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("turns a Markdown image into a figure with its alt text as caption", async () => {
    const { html } = await renderMarkdown("![Ảnh: studio buổi sáng](https://example.com/a.jpg)", {
      editorial: true,
    });
    expect(html).toContain("<figure>");
    expect(html).toContain("<figcaption>Ảnh: studio buổi sáng</figcaption>");
    expect(html).toContain('loading="lazy"');
  });

  it("keeps blockquotes for pull quotes", async () => {
    const { html } = await renderMarkdown("> Câu nói đáng nhớ.", { editorial: true });
    expect(html).toContain("<blockquote>");
  });

  it("does not interpret interview syntax in the default template", async () => {
    const { html } = await renderMarkdown(":::qa\nQ: Hỏi?\nA: Đáp.\n:::");
    expect(html).not.toContain('class="qa-pair"');
  });

  it("leaves a malformed interview block as readable text", async () => {
    const { html } = await renderMarkdown(":::qa\nkhông có cặp hỏi đáp\n:::", { editorial: true });
    expect(html).toContain("không có cặp hỏi đáp");
  });
});
