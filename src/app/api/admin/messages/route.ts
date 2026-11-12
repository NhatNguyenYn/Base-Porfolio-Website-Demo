import { NextResponse } from "next/server";
import { authorize, fail } from "@/lib/api";
import { listMessages, type MessageStatus } from "@/server/queries/messages";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["unread", "read", "archived"]);

export async function GET(request: Request) {
  const guard = await authorize();
  if ("error" in guard) return guard.error;

  const params = new URL(request.url).searchParams;
  const statusParam = params.get("status");
  if (statusParam && !STATUSES.has(statusParam)) {
    return fail("INVALID_STATUS", "status must be unread, read or archived.", 400);
  }

  const messages = await listMessages(
    statusParam ? (statusParam as MessageStatus) : undefined,
    params.get("q") ?? undefined,
  );

  return NextResponse.json(
    { success: true, data: messages, meta: { total: messages.length } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
