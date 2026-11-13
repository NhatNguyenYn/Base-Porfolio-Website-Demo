import { describe, expect, it } from "vitest";
import { isDatabaseUnavailable, withApi } from "@/lib/api";

function prismaLikeError(code: string, name = "PrismaClientKnownRequestError"): Error {
  return Object.assign(new Error("Can't reach database server at internal-host:5432"), { code, name });
}

describe("database unavailability detection", () => {
  it("recognises Prisma connection codes", () => {
    expect(isDatabaseUnavailable(prismaLikeError("P1001"))).toBe(true);
    expect(isDatabaseUnavailable(prismaLikeError("P1002"))).toBe(true);
    expect(isDatabaseUnavailable(prismaLikeError("P1017"))).toBe(true);
    expect(isDatabaseUnavailable(prismaLikeError("P2024"))).toBe(true);
  });

  it("recognises an initialization failure", () => {
    expect(isDatabaseUnavailable(Object.assign(new Error("init"), { name: "PrismaClientInitializationError" }))).toBe(
      true,
    );
  });

  it("does not treat application bugs as outages", () => {
    expect(isDatabaseUnavailable(new Error("boom"))).toBe(false);
    expect(isDatabaseUnavailable(prismaLikeError("P2002"))).toBe(false);
    expect(isDatabaseUnavailable(null)).toBe(false);
    expect(isDatabaseUnavailable("oops")).toBe(false);
  });
});

describe("API error envelope", () => {
  it("returns a JSON 503 for an unreachable database", async () => {
    const response = await withApi(undefined, async () => {
      throw prismaLikeError("P1001");
    });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE" },
    });
    expect(JSON.stringify(body)).not.toContain("internal-host");
    expect(JSON.stringify(body)).not.toContain("P1001");
  });

  it("returns a generic JSON 500 for unexpected errors", async () => {
    const response = await withApi(undefined, async () => {
      throw new Error("secret path /srv/app/.env");
    });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain(".env");
  });

  it("passes successful responses through untouched", async () => {
    const response = await withApi(undefined, async () => new Response("ok", { status: 201 }));
    expect(response.status).toBe(201);
    expect(await response.text()).toBe("ok");
  });
});
