import { describe, expect, it } from "vitest";
import { checkRequestOrigin } from "@/lib/origin";

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("mutating request origin", () => {
  it("accepts a same-origin browser request", () => {
    expect(checkRequestOrigin(headers({ host: "localhost:3000", origin: "http://localhost:3000" }))).toEqual({ ok: true });
    expect(
      checkRequestOrigin(headers({ host: "portfolio.dev", origin: "https://portfolio.dev", "sec-fetch-site": "same-origin" })),
    ).toEqual({ ok: true });
  });

  it("accepts non-browser clients that send no Origin", () => {
    expect(checkRequestOrigin(headers({ host: "portfolio.dev" }))).toEqual({ ok: true });
  });

  it("rejects a browser-shaped request with no Origin", () => {
    expect(checkRequestOrigin(headers({ host: "portfolio.dev", "sec-fetch-mode": "cors" }))).toEqual({
      ok: false,
      reason: "missing-origin",
    });
    expect(checkRequestOrigin(headers({ host: "portfolio.dev", "sec-fetch-mode": "navigate" }))).toEqual({
      ok: false,
      reason: "missing-origin",
    });
  });

  it("rejects a foreign Origin", () => {
    const verdict = checkRequestOrigin(headers({ host: "portfolio.dev", origin: "https://evil.example" }));
    expect(verdict).toEqual({ ok: false, reason: "host-mismatch" });
  });

  it("rejects a null or malformed Origin", () => {
    expect(checkRequestOrigin(headers({ host: "portfolio.dev", origin: "null" }))).toEqual({
      ok: false,
      reason: "null-origin",
    });
    expect(checkRequestOrigin(headers({ host: "portfolio.dev", origin: "not a url" }))).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects cross-site and same-site browser fetches", () => {
    expect(
      checkRequestOrigin(headers({ host: "portfolio.dev", origin: "https://portfolio.dev", "sec-fetch-site": "cross-site" })),
    ).toEqual({ ok: false, reason: "cross-site" });
    expect(
      checkRequestOrigin(
        headers({ host: "portfolio.dev", origin: "https://admin.portfolio.dev", "sec-fetch-site": "same-site" }),
      ),
    ).toEqual({ ok: false, reason: "cross-site" });
  });

  it("accepts the proxy-forwarded host when it matches", () => {
    expect(
      checkRequestOrigin(headers({ host: "10.0.0.5:3000", "x-forwarded-host": "portfolio.dev", origin: "https://portfolio.dev" })),
    ).toEqual({ ok: true });
  });

  it("compares against the request URL host as well", () => {
    expect(checkRequestOrigin(headers({ origin: "http://localhost:3000" }), "http://localhost:3000/api/admin/media")).toEqual({
      ok: true,
    });
    expect(checkRequestOrigin(headers({}), "http://localhost:3000/api/admin/media")).toEqual({ ok: true });
    expect(checkRequestOrigin(headers({ origin: "https://other.example" }), "http://localhost:3000/api/x")).toEqual({
      ok: false,
      reason: "host-mismatch",
    });
  });
});
