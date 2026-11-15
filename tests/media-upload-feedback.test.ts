/**
 * Media upload feedback tests (favicon picker fix, 15/11).
 *
 * Root cause: MediaPicker rendered its upload <form> inside the page's own
 * <form> (settings, artwork, article, … all use ActionForm). Browsers drop
 * a nested <form> tag while parsing SSR HTML, so the "Tải lên" button
 * belonged to the outer form and submitted the page instead of uploading —
 * no spinner, no message, no new image. The picker now dispatches the
 * upload imperatively, and every message the action returns is Vietnamese.
 *
 * next/headers, next/navigation and next/cache are mocked (the actions run
 * outside a real request here); Prisma runs against portfolio_test, so the
 * DB behaviour is real. Storage is the local test driver (UPLOAD_DIR).
 */
import { readdirSync, readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const state = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  headers: async () => state.headers,
  cookies: async () => ({
    get: (name: string) => {
      const value = state.cookies.get(name);
      return value === undefined ? undefined : { value };
    },
    set: (name: string, value: string) => {
      state.cookies.set(name, value);
    },
    delete: (name: string) => {
      state.cookies.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

import { prisma } from "@/server/db";
import { createSession, hashPassword } from "@/server/auth";
import { uploadMediaAction } from "@/server/actions/media";
import { resetDatabase } from "./helpers/db";

let counter = 0;
function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Date.now()}@test.local`;
}

async function makeUploader(email: string) {
  const user = await prisma.user.create({
    data: { email, name: "Uploader", passwordHash: await hashPassword("TestPassw0rd1"), role: "ADMIN" },
  });
  await createSession(user.id);
  return user;
}

function uploadForm(files: File[]): FormData {
  const fd = new FormData();
  for (const file of files) fd.append("files", file);
  return fd;
}

/** Small valid PNG generated with sharp (a hand-written 1x1 base64 PNG with
 *  grayscale+alpha trips libvips in the optimize pipeline, so fixtures are
 *  generated instead of pasted). */
async function tinyPng(): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

beforeEach(async () => {
  await resetDatabase();
  state.cookies.clear();
  state.headers = new Headers({ host: "localhost:3000" });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("uploadMediaAction messages are Vietnamese", () => {
  it("asks for at least one image when nothing is attached", async () => {
    await makeUploader(uniqueEmail("uploader"));
    const result = await uploadMediaAction({ ok: false, message: "" }, new FormData());
    expect(result).toEqual({ ok: false, message: "Hãy chọn ít nhất một ảnh." });
  });

  it("caps a batch at 10 images", async () => {
    await makeUploader(uniqueEmail("uploader"));
    const png = await tinyPng();
    const files = Array.from(
      { length: 11 },
      (_, i) => new File([png], `img-${i}.png`, { type: "image/png" }),
    );
    const result = await uploadMediaAction({ ok: false, message: "" }, uploadForm(files));
    expect(result).toEqual({ ok: false, message: "Mỗi lần tải lên tối đa 10 ảnh." });
  });

  it("rejects a non-image with a Vietnamese type error", async () => {
    await makeUploader(uniqueEmail("uploader"));
    const result = await uploadMediaAction(
      { ok: false, message: "" },
      uploadForm([new File(["hello"], "notes.txt", { type: "text/plain" })]),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("chỉ chấp nhận JPG, PNG, WebP, AVIF hoặc GIF");
  });

  it("rejects an oversized image with a Vietnamese size error", async () => {
    await makeUploader(uniqueEmail("uploader"));
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.png", { type: "image/png" });
    const result = await uploadMediaAction({ ok: false, message: "" }, uploadForm([big]));
    expect(result.ok).toBe(false);
    expect(result.message).toContain("lớn hơn 10 MB");
  });
});

describe("uploadMediaAction success path", () => {
  it("stores a PNG, reports 'Tải ảnh lên hoàn tất' and returns the media record", async () => {
    await makeUploader(uniqueEmail("uploader"));
    const png = await tinyPng();
    const result = await uploadMediaAction(
      { ok: false, message: "" },
      uploadForm([new File([png], "logo.png", { type: "image/png" })]),
    );
    expect(result.ok).toBe(true);
    expect(result.message).toBe("Tải ảnh lên hoàn tất");
    expect(result.files).toHaveLength(1);
    const saved = await prisma.media.findUniqueOrThrow({ where: { id: result.files![0].id } });
    expect(saved.filename).toBe("logo.png");
    expect(saved.mimeType).toBe("image/png");
    // The bytes really landed in the test upload dir.
    const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./storage/test-uploads");
    await expect(access(path.join(uploadRoot, saved.storageKey))).resolves.toBeUndefined();
  });

  it("stores a 500x500 JPEG (same shape as the Thu Hà logo) with its dimensions", async () => {
    await makeUploader(uniqueEmail("uploader"));
    const jpeg = new Uint8Array(
      await sharp({
        create: { width: 500, height: 500, channels: 3, background: { r: 180, g: 30, b: 40 } },
      })
        .jpeg()
        .toBuffer(),
    );
    const result = await uploadMediaAction(
      { ok: false, message: "" },
      uploadForm([new File([jpeg], "Logo_1.jpg", { type: "image/jpeg" })]),
    );
    expect(result.ok).toBe(true);
    expect(result.message).toBe("Tải ảnh lên hoàn tất");
    expect(result.files![0].width).toBe(500);
    expect(result.files![0].height).toBe(500);
  });
});

describe("media-picker has no nested <form> (regression guard)", () => {
  it("never renders a <form> element, so the upload button cannot be hijacked by the page form", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/admin/media-picker.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/<form\s/);
    // The upload is dispatched imperatively with a FormData instead, inside
    // a transition — without startTransition, useActionState's pending flag
    // never flips and the button shows no "uploading" state.
    expect(source).toContain("startTransition(() => {");
    expect(source).toContain("uploadAction(formData)");
  });
});

describe("public pages keep the uploaded favicon (regression guard)", () => {
  it("every buildPageMetadata call site passes faviconUrl", () => {
    // 15/11: the homepage forgot faviconUrl, so buildPageMetadata returned
    // icons: /icon.png and — child metadata wins the merge — overrode the
    // layout's uploaded-logo favicon on every visit. The layout alone is
    // not enough: any page calling buildPageMetadata without faviconUrl
    // silently restores the bundled icon.
    const root = path.resolve(process.cwd(), "src/app/(public)/[locale]");
    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name === "page.tsx") pages.push(full);
      }
    };
    walk(root);
    const offenders = pages.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("buildPageMetadata(") && !source.includes("faviconUrl:");
    });
    expect(offenders).toEqual([]);
  });

  it("buildPageMetadata uses the passed faviconUrl as the icon", async () => {
    const { buildPageMetadata } = await import("@/lib/seo");
    const meta = buildPageMetadata({
      locale: "vi",
      path: "/",
      title: "Test",
      description: "Test",
      siteName: "Test",
      faviconUrl: "/media/uploads/test-logo.jpg",
    });
    expect(meta.icons).toEqual({ icon: "/media/uploads/test-logo.jpg" });
  });
});

