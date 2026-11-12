import "server-only";
import { prisma } from "./db";

/**
 * Records an administrative change. Never throws: losing an audit entry must
 * not break the user's action.
 */
export async function logActivity(input: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary.slice(0, 400),
      },
    });
  } catch (error) {
    console.error("[audit] failed to write activity log", error);
  }
}

export async function recentActivity(limit = 8) {
  return prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });
}
