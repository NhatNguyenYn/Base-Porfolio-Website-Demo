import { NextResponse } from "next/server";
import { authorize, fail, readPagination } from "@/lib/api";
import { listMediaLibrary } from "@/server/queries/media-library";
import { storeImage, UploadError } from "@/server/media/upload";
import { logActivity } from "@/server/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await authorize();
  if ("error" in guard) return guard.error;

  const params = new URL(request.url).searchParams;
  const { page, perPage } = readPagination(params, 24);
  const result = await listMediaLibrary(page, perPage);

  return NextResponse.json(
    { success: true, data: result.rows, meta: { page: result.page, perPage, total: result.total, pages: result.pages } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Multipart upload: field `files` (1–10 items) and optional `alt`. */
export async function POST(request: Request) {
  const guard = await authorize();
  if ("error" in guard) return guard.error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("INVALID_BODY", "Send multipart/form-data with a files field.", 400);
  }

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  const alt = typeof formData.get("alt") === "string" ? String(formData.get("alt")).slice(0, 240) : "";

  if (files.length === 0) return fail("NO_FILES", "Attach at least one image.", 400);
  if (files.length > 10) return fail("TOO_MANY_FILES", "Upload up to 10 images at a time.", 400);

  const created = [];
  for (const file of files) {
    try {
      created.push(await storeImage(file, alt));
    } catch (error) {
      if (error instanceof UploadError) {
        return fail(error.code, error.message, error.code === "SIZE" ? 413 : 415);
      }
      console.error("[media] upload failed", error);
      return fail("UPLOAD_FAILED", "Could not store the image.", 500);
    }
  }

  await logActivity({
    userId: guard.user.id,
    action: "create",
    entityType: "media",
    summary: `Uploaded ${created.length} image${created.length === 1 ? "" : "s"} via API`,
  });

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
