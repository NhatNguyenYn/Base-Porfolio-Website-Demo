/** Presentation styles an article can use on the public site. */
export const ARTICLE_TEMPLATES = ["default", "editorial"] as const;

export type ArticleTemplate = (typeof ARTICLE_TEMPLATES)[number];

/**
 * Anything unknown (including rows created before the column existed) falls
 * back to the original layout. This keeps old articles untouched and makes the
 * stored value safe to edit from the CMS.
 */
export function normalizeArticleTemplate(value: unknown): ArticleTemplate {
  return value === "editorial" ? "editorial" : "default";
}

export function isArticleTemplate(value: unknown): value is ArticleTemplate {
  return value === "default" || value === "editorial";
}
