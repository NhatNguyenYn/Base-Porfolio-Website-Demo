import { NextResponse } from "next/server";
import { authorize, fail, readJson } from "@/lib/api";
import { prisma } from "@/server/db";
import { logActivity } from "@/server/audit";
import { getMessage } from "@/server/queries/messages";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["unread", "read", "archived"]);
const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authorize();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const message = await getMessage(id);
  if (!message) return fail("NOT_FOUND", "Message not found.", 404);

  return NextResponse.json({ success: true, data: message }, NO_STORE);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authorize();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const body = await readJson(request);
  const status = typeof body?.status === "string" ? body.status : "";
  if (!STATUSES.has(status)) {
    return fail("INVALID_STATUS", "status must be unread, read or archived.", 400);
  }

  const message = await getMessage(id);
  if (!message) return fail("NOT_FOUND", "Message not found.", 404);

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: {
      status,
      readAt: status === "read" ? new Date() : status === "unread" ? null : message.readAt,
    },
  });

  await logActivity({
    userId: guard.user.id,
    action: "update",
    entityType: "message",
    entityId: id,
    summary: `Message from ${updated.name} marked ${status}`,
  });

  return NextResponse.json({ success: true, data: updated }, NO_STORE);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authorize();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const message = await getMessage(id);
  if (!message) return fail("NOT_FOUND", "Message not found.", 404);

  await prisma.contactMessage.update({ where: { id }, data: { deletedAt: new Date() } });
  await logActivity({
    userId: guard.user.id,
    action: "delete",
    entityType: "message",
    entityId: id,
    summary: `Deleted message from ${message.name} (soft delete)`,
  });

  return NextResponse.json({ success: true, data: { id } }, NO_STORE);
}
