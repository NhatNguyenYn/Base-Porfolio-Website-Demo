"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireUser } from "../auth";
import { logActivity } from "../audit";
import { getString } from "./helpers";

export async function setMessageStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  const status = getString(formData, "status");
  if (!id || !["unread", "read", "archived"].includes(status)) return;

  await prisma.contactMessage.update({
    where: { id },
    data: { status, readAt: status === "read" ? new Date() : null },
  });
  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "message",
    entityId: id,
    summary: `Set message status to ${status}`,
  });
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

export async function deleteMessageAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  await prisma.contactMessage.update({ where: { id }, data: { deletedAt: new Date() } });
  await logActivity({
    userId: user.id,
    action: "delete",
    entityType: "message",
    entityId: id,
    summary: "Deleted contact message (soft delete)",
  });
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}
