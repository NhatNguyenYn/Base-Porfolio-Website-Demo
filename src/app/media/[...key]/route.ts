import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Serves locally stored media with immutable caching. With the S3 driver the
 * URLs point at the bucket and this route is not used.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const joined = key.join("/");

  try {
    const object = await getStorage().get(joined);
    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(new Uint8Array(object.body), {
      headers: {
        "Content-Type": object.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
