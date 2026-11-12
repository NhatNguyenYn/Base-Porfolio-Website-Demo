import { describe, expect, it } from "vitest";
import {
  adminUserCreateSchema,
  articleSchema,
  artworkSchema,
  contactSchema,
  loginSchema,
  projectSchema,
  settingsSchema,
} from "@/lib/validation";

const validContact = {
  name: "Nguyễn Văn A",
  email: "visitor@example.com",
  subject: "Hợp tác dự án",
  message: "Tôi muốn trao đổi về một dự án thiết kế trong quý tới.",
  website: "",
};

describe("contactSchema", () => {
  it("accepts a valid message", () => {
    expect(contactSchema.safeParse(validContact).success).toBe(true);
  });

  it("rejects invalid email and short messages", () => {
    expect(contactSchema.safeParse({ ...validContact, email: "not-an-email" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...validContact, message: "short" }).success).toBe(false);
  });

  it("rejects a filled honeypot", () => {
    expect(contactSchema.safeParse({ ...validContact, website: "http://spam.example" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires a syntactically valid email and a password", () => {
    expect(loginSchema.safeParse({ email: "admin@example.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "admin", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "admin@example.com", password: "" }).success).toBe(false);
  });
});

describe("content schemas", () => {
  it("requires an image for an artwork", () => {
    const result = artworkSchema.safeParse({ imageMediaId: "", vi: { title: "A" }, en: { title: "" } });
    expect(result.success).toBe(false);
  });

  it("rejects javascript: URLs in project links", () => {
    const result = projectSchema.safeParse({
      githubUrl: "javascript:alert(1)",
      vi: { name: "X" },
      en: {},
    });
    expect(result.success).toBe(false);
  });

  it("defaults an article to draft", () => {
    const result = articleSchema.safeParse({ vi: { title: "Nháp" }, en: {} });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("draft");
  });

  it("validates settings email", () => {
    const base = {
      siteName: "Portfolio",
      contactEmail: "hello@example.com",
    };
    expect(settingsSchema.safeParse(base).success).toBe(true);
    expect(settingsSchema.safeParse({ ...base, contactEmail: "nope" }).success).toBe(false);
  });
});

describe("adminUserCreateSchema", () => {
  it("enforces the password policy and role enum", () => {
    const valid = { name: "New Admin", email: "new@example.com", password: "Password123", role: "ADMIN" };
    expect(adminUserCreateSchema.safeParse(valid).success).toBe(true);
    expect(adminUserCreateSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(adminUserCreateSchema.safeParse({ ...valid, password: "onlyletters" }).success).toBe(false);
    expect(adminUserCreateSchema.safeParse({ ...valid, role: "OWNER" }).success).toBe(false);
  });
});
