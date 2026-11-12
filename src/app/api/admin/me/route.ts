import { authorize } from "@/lib/api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await authorize();
  if ("error" in guard) return guard.error;

  return NextResponse.json(
    { success: true, data: guard.user },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
