import { prisma } from "@/server/db";
import { ok, publicCache } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { articles: true, artworks: true } } },
    orderBy: { name: "asc" },
  });

  return ok(
    tags.map((tag) => ({
      id: tag.id,
      slug: tag.slug,
      name: tag.name,
      articleCount: tag._count.articles,
      artworkCount: tag._count.artworks,
    })),
    { total: tags.length },
    publicCache,
  );
}
