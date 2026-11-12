import { NextResponse } from "next/server";
import { authorize } from "@/lib/api";
import { getDashboardData } from "@/server/queries/dashboard";
import { messageCounts } from "@/server/queries/messages";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await authorize();
  if ("error" in guard) return guard.error;

  const [dashboard, messages] = await Promise.all([getDashboardData(), messageCounts()]);

  return NextResponse.json(
    {
      success: true,
      data: {
        counts: { ...dashboard.counts, ...messages },
        views: dashboard.views,
        recentArticles: dashboard.recentArticles,
        recentMessages: dashboard.recentMessages,
        activity: dashboard.activity,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
