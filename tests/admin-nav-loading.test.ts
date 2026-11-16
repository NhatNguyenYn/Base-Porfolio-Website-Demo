import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/server/db";
import { countArtworksForAdmin, listArtworksForAdmin } from "@/server/queries/artworks";
import { countBookingsForAdmin, listBookingsForAdmin } from "@/server/queries/bookings";
import { resetDatabase, seedFixtures } from "./helpers/db";

/**
 * Admin navigation speed: the sidebar tabs took 1.5–5.6s on first click
 * (measured live 16/11), and no skeleton appeared at all — the old page
 * just sat frozen until the new one arrived. Two causes, both fixed here:
 *
 * 1. No loading boundary in the protected admin segment (PR #7 added one
 *    for the public site only), so <Link> could not prefetch admin routes
 *    and navigation showed nothing until the server answered.
 * 2. The list pages fetched everything to show one page: bookings pulled
 *    up to 500 rows to render 20, and the artworks table pulled all 117
 *    artworks with their full translations and blur data.
 *
 * These tests pin the new behaviour: bookings and artworks paginate at
 * the database, the admin artwork rows are slim (no blur data), and the
 * admin loading skeleton exists.
 */

beforeAll(async () => {
  await resetDatabase();
  const fixtures = await seedFixtures();
  // 24 more public artworks so the admin table has pages.
  for (let i = 1; i <= 24; i++) {
    const n = String(i).padStart(2, "0");
    await prisma.artwork.create({
      data: {
        slug: `admin-artwork-${n}`,
        imageMediaId: fixtures.media.id,
        collectionId: fixtures.publicCollection.id,
        visibility: "public",
        featured: false,
        order: 10 + i,
        translations: {
          create: [
            { locale: "vi", title: `Tác phẩm quản trị ${n}`, description: `Mô tả ${n}` },
            { locale: "en", title: `Admin artwork ${n}`, description: `Description ${n}` },
          ],
        },
      },
    });
  }
  // One service + 25 slots + 25 bookings for the bookings list.
  const service = await prisma.bookingService.create({
    data: {
      slug: "tu-van-test",
      durationMinutes: 30,
      active: true,
      translations: { create: [{ locale: "vi", name: "Tư vấn test", description: "" }] },
    },
  });
  for (let i = 1; i <= 25; i++) {
    const n = String(i).padStart(2, "0");
    const startsAt = new Date(Date.UTC(2026, 10, 20 + Math.floor((i - 1) / 5), 9 + ((i - 1) % 5), 0));
    const slot = await prisma.bookingSlot.create({
      data: {
        serviceId: service.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
        status: "booked",
      },
    });
    await prisma.booking.create({
      data: {
        referenceCode: `BK-T${n}XYZ`,
        serviceId: service.id,
        slotId: slot.id,
        name: `Khách test ${n}`,
        email: `test${n}@example.com`,
        flowerCode: `test-hoa-${n}`,
        status: "pending",
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("admin bookings pagination at the database", () => {
  it("pages of 10 cover all 25 bookings with no overlap", async () => {
    expect(await countBookingsForAdmin()).toBe(25);
    const page1 = await listBookingsForAdmin({ limit: 10, offset: 0 });
    const page2 = await listBookingsForAdmin({ limit: 10, offset: 10 });
    const page3 = await listBookingsForAdmin({ limit: 10, offset: 20 });
    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page3).toHaveLength(5);
    const ids = [...page1, ...page2, ...page3].map((row) => row.id);
    expect(new Set(ids).size).toBe(25);
  });

  it("the count honours the same filters as the list", async () => {
    expect(await countBookingsForAdmin({ status: "pending" })).toBe(25);
    expect(await countBookingsForAdmin({ status: "cancelled" })).toBe(0);
    expect(await listBookingsForAdmin({ status: "cancelled" })).toHaveLength(0);
    expect(await listBookingsForAdmin({ status: "pending", limit: 5 })).toHaveLength(5);
  });
});

describe("admin artworks slim list at the database", () => {
  it("pages of 10 cover all 27 artworks with no overlap", async () => {
    // seedFixtures creates 3 artworks (public, private, vi-only) + 24 here.
    expect(await countArtworksForAdmin()).toBe(27);
    const page1 = await listArtworksForAdmin({ limit: 10, offset: 0 });
    const page2 = await listArtworksForAdmin({ limit: 10, offset: 10 });
    const page3 = await listArtworksForAdmin({ limit: 10, offset: 20 });
    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page3).toHaveLength(7);
    const ids = [...page1, ...page2, ...page3].map((row) => row.id);
    expect(new Set(ids).size).toBe(27);
  });

  it("rows carry only what the table renders — no blur data, no full translations", async () => {
    const [row] = await listArtworksForAdmin({ limit: 1 });
    expect(row).toBeDefined();
    expect(row!.imageUrl).toBeTruthy();
    expect(row!.viTitle).toBeTruthy();
    expect(row).not.toHaveProperty("blurDataUrl");
    expect(row).not.toHaveProperty("translations");
    expect(row).not.toHaveProperty("description");
    expect(JSON.stringify(row)).not.toContain("blurDataUrl");
  });
});

describe("admin loading skeleton", () => {
  const root = process.cwd();
  const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

  it("the protected admin segment has a loading boundary with a shimmer skeleton", () => {
    const source = read("src/app/(admin)/admin/(protected)/loading.tsx");
    expect(source).toContain("export default function");
    expect(source).toContain("skeleton-shimmer");
    expect(source).toContain('aria-hidden="true"');
    // Mirrors the admin list pages: header shape + table shape.
    expect(source).toContain("<table");
  });

  it("the bookings and artworks pages paginate at the database, not in memory", () => {
    for (const [rel, counter] of [
      ["src/app/(admin)/admin/(protected)/bookings/page.tsx", "countBookingsForAdmin"],
      ["src/app/(admin)/admin/(protected)/art/page.tsx", "countArtworksForAdmin"],
    ] as const) {
      const source = read(rel);
      expect(source).toContain(counter);
      expect(source).toContain("limit: perPage");
      expect(source).not.toContain("paginate(");
    }
  });
});
