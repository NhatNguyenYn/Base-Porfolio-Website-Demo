import "server-only";
import { prisma } from "../db";

export type MessageStatus = "unread" | "read" | "archived";

export async function listMessages(status?: MessageStatus, q?: string) {
  const rows = await prisma.contactMessage.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  if (!q?.trim()) return rows;
  const needle = q.trim().toLowerCase();
  return rows.filter(
    (row) =>
      row.name.toLowerCase().includes(needle) ||
      row.email.toLowerCase().includes(needle) ||
      row.subject.toLowerCase().includes(needle),
  );
}

export async function getMessage(id: string) {
  return prisma.contactMessage.findFirst({ where: { id, deletedAt: null } });
}

export async function messageCounts() {
  const [unread, read, archived, total] = await Promise.all([
    prisma.contactMessage.count({ where: { deletedAt: null, status: "unread" } }),
    prisma.contactMessage.count({ where: { deletedAt: null, status: "read" } }),
    prisma.contactMessage.count({ where: { deletedAt: null, status: "archived" } }),
    prisma.contactMessage.count({ where: { deletedAt: null } }),
  ]);
  return { unread, read, archived, total };
}
