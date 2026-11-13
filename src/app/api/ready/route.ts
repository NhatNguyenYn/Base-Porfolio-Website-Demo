import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { storageHealth } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Readiness: the app can actually serve content. Reports only a coarse status
 * per dependency — never hosts, credentials, paths or error text.
 */
export async function GET() {
  const checks = { database: "ok", storage: "ok" };
  let ready = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.database = "unavailable";
    ready = false;
  }

  try {
    await storageHealth();
  } catch {
    checks.storage = "unavailable";
    ready = false;
  }

  return NextResponse.json(
    { status: ready ? "ready" : "not_ready", checks },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
