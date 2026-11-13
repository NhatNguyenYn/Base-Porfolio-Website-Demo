import { describe, expect, it } from "vitest";
import { evaluateSetupAccess, isSetupLocked, tokensMatch } from "@/lib/setup-guard";

const base = { isProduction: false, host: "localhost:3000", configuredToken: "", providedToken: null };

describe("first-run setup access", () => {
  it("allows local development without a token", () => {
    expect(evaluateSetupAccess(base)).toEqual({ allowed: true });
    expect(evaluateSetupAccess({ ...base, host: "127.0.0.1:3000" })).toEqual({ allowed: true });
    expect(evaluateSetupAccess({ ...base, host: "[::1]:3000" })).toEqual({ allowed: true });
  });

  it("refuses remote development hosts", () => {
    expect(evaluateSetupAccess({ ...base, host: "portfolio.dev" })).toEqual({ allowed: false, reason: "local-only" });
  });

  it("never allows production setup without SETUP_TOKEN, even from localhost", () => {
    expect(evaluateSetupAccess({ ...base, isProduction: true })).toEqual({ allowed: false, reason: "disabled" });
  });

  it("requires the configured token in every environment", () => {
    expect(evaluateSetupAccess({ ...base, configuredToken: "s3cret-token", providedToken: "s3cret-token" })).toEqual({
      allowed: true,
    });
    expect(evaluateSetupAccess({ ...base, configuredToken: "s3cret-token", providedToken: "guess" })).toEqual({
      allowed: false,
      reason: "token",
    });
    expect(evaluateSetupAccess({ ...base, configuredToken: "s3cret-token" })).toEqual({
      allowed: false,
      reason: "token",
    });
    expect(
      evaluateSetupAccess({
        isProduction: true,
        host: "portfolio.dev",
        configuredToken: "s3cret-token",
        providedToken: "s3cret-token",
      }),
    ).toEqual({ allowed: true });
  });

  it("comparisons are constant-time and length-safe", () => {
    expect(tokensMatch("abc", "abc")).toBe(true);
    expect(tokensMatch("abc", "abd")).toBe(false);
    expect(tokensMatch("abc", "abcd")).toBe(false);
    expect(tokensMatch("", "abc")).toBe(false);
  });
});

describe("setup page lock state", () => {
  it("shows the form when a token is configured", () => {
    expect(isSetupLocked({ isProduction: true, host: "portfolio.dev", configuredToken: "token" })).toBe(false);
  });

  it("locks production without a token", () => {
    expect(isSetupLocked({ isProduction: true, host: "localhost:3000", configuredToken: "" })).toBe(true);
  });

  it("locks remote development hosts only", () => {
    expect(isSetupLocked({ isProduction: false, host: "localhost:3000", configuredToken: "" })).toBe(false);
    expect(isSetupLocked({ isProduction: false, host: "portfolio.dev", configuredToken: "" })).toBe(true);
  });
});
