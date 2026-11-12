import type { Media } from "@prisma/client";
import type { MediaView } from "./types";

export function toMediaView(media: Partial<Media> | null | undefined): MediaView | null {
  if (!media?.url) return null;
  return {
    id: media.id ?? "",
    url: media.url,
    width: media.width ?? null,
    height: media.height ?? null,
    alt: media.alt ?? "",
    title: media.title ?? media.filename ?? "",
  };
}

export function mediaList(media: (Media | null)[] | null | undefined): MediaView[] {
  return (media ?? []).map((item) => toMediaView(item)).filter((item): item is MediaView => Boolean(item));
}
