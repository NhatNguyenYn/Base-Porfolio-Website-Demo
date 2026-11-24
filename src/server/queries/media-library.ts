import "server-only";
import { prisma } from "../db";
import { toMediaView } from "./media";
import type { MediaView } from "./types";

/** Recent media for pickers; the library page has its own paginated query. */
export async function getMediaLibrary(limit = 500): Promise<MediaView[]> {
  // The picker dialog has no pagination, so this limit is the only thing
  // standing between an admin and an older image: at 120, the library
  // passed that mark in Nov 2026 and "Logo 1" (position 139) could no
  // longer be picked as favicon, logo or cover. 500 leaves years of
  // headroom — the library grows by a few images a month. The query stays
  // lean because pickers never use the blur placeholder, so it is excluded
  // here (a ~200-byte data URI per row would otherwise ride along in the
  // RSC payload of every admin page that renders a picker).
  const rows = await prisma.media.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, url: true, width: true, height: true, alt: true, title: true, filename: true },
  });
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
