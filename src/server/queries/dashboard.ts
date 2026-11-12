import "server-only";
import { prisma } from "../db";
import { recentActivity } from "../audit";

export type DashboardData = {
  counts: {
    articles: number;
    publishedArticles: number;
    drafts: number;
    projects: number;
    artworks: number;
    collections: number;
    media: number;
    messages: number;
    unreadMessages: number;
  };
  views: { articles: number; artworks: number; total: number };
  recentArticles: { id: string; slug: string; title: string; status: string; updatedAt: Date }[];
  recentMessages: { id: string; name: string; subject: string; status: string; createdAt: Date }[];
  activity: Awaited<ReturnType<typeof recentActivity>>;
};

export async function getDashboardData(): Promise<DashboardData> {
  const [
    articles,
    publishedArticles,
    drafts,
    projects,
    artworks,
    collections,
    media,
    messages,
    unreadMessages,
    articleViews,
    artworkViews,
    recentArticles,
    recentMessages,
    activity,
  ] = await Promise.all([
    prisma.article.count({ where: { deletedAt: null } }),
    prisma.article.count({ where: { deletedAt: null, status: "published" } }),
    prisma.article.count({ where: { deletedAt: null, status: "draft" } }),
    prisma.project.count({ where: { deletedAt: null } }),
    prisma.artwork.count({ where: { deletedAt: null } }),
    prisma.artworkCollection.count({ where: { deletedAt: null } }),
    prisma.media.count(),
    prisma.contactMessage.count({ where: { deletedAt: null } }),
    prisma.contactMessage.count({ where: { deletedAt: null, status: "unread" } }),
    prisma.article.aggregate({ _sum: { viewCount: true } }),
    prisma.artwork.aggregate({ _sum: { viewCount: true } }),
    prisma.article.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { translations: true },
    }),
    prisma.contactMessage.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, name: true, subject: true, status: true, createdAt: true },
    }),
    recentActivity(6),
  ]);

  const vi = (rows: { locale: string; title: string }[]) => rows.find((row) => row.locale === "vi")?.title ?? rows[0]?.title ?? "(untitled)";

  return {
    counts: {
      articles,
      publishedArticles,
      drafts,
      projects,
      artworks,
      collections,
      media,
      messages,
      unreadMessages,
    },
    views: {
      articles: articleViews._sum.viewCount ?? 0,
      artworks: artworkViews._sum.viewCount ?? 0,
      total: (articleViews._sum.viewCount ?? 0) + (artworkViews._sum.viewCount ?? 0),
    },
    recentArticles: recentArticles.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: vi(row.translations),
      status: row.status,
      updatedAt: row.updatedAt,
    })),
    recentMessages,
    activity,
  };
}
