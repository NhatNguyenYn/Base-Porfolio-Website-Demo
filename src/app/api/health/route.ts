import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness: the process is up and can answer HTTP. No database, no storage and
 * no configuration details are touched, so a slow dependency cannot make an
 * orchestrator restart a healthy process.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
