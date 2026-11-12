import "server-only";
import { prisma } from "../db";
import { toMediaView } from "./media";
import type { MediaView } from "./types";

/** Recent media for pickers; the library page has its own paginated query. */
export async function getMediaLibrary(limit = 120): Promise<MediaView[]> {
  const rows = await prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.map((row) => toMediaView(row)).filter((row): row is MediaView => Boolean(row));
}

export async function listMediaLibrary(page = 1, perPage = 24) {
  const [rows, total] = await Promise.all([
    prisma.media.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.media.count(),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / perPage)), page };
}
