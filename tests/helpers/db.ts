import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";

/** Empties every application table; safe because tests only run on portfolio_test. */
export async function resetDatabase(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%'
  `;
  if (rows.length === 0) return;
  const list = rows.map((row) => `"${row.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

const PAST = new Date(Date.now() - 86_400_000);
const FUTURE = new Date(Date.now() + 86_400_000);

export type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;

export async function seedFixtures() {
  const passwordHash = await bcrypt.hash("TestPassw0rd!", 4);

  const superAdmin = await prisma.user.create({
    data: { email: "super@test.local", name: "Super", passwordHash, role: "SUPER_ADMIN" },
  });
  const admin = await prisma.user.create({
    data: { email: "admin@test.local", name: "Admin", passwordHash, role: "ADMIN" },
  });

  const media = await prisma.media.create({
    data: {
      storageKey: "test/fixture.png",
      url: "/media/test/fixture.png",
      filename: "fixture.png",
      mimeType: "image/png",
      size: 2048,
      width: 800,
      height: 1200,
      alt: "Fixture image",
    },
  });

  await prisma.profile.create({
    data: {
      email: "hello@test.local",
      location: "Test City",
      avatarMediaId: media.id,
      translations: {
        create: [
          { locale: "vi", fullName: "Người Kiểm Thử", title: "Kỹ sư", shortBio: "Mô tả ngắn", longBio: "Tiểu sử dài" },
          { locale: "en", fullName: "Test Person", title: "Engineer", shortBio: "Short bio", longBio: "Long bio" },
        ],
      },
    },
  });

  const publicCollection = await prisma.artworkCollection.create({
    data: {
      slug: "public-collection",
      visibility: "public",
      order: 1,
      translations: {
        create: [
          { locale: "vi", name: "Bộ sưu tập công khai" },
          { locale: "en", name: "Public collection" },
        ],
      },
    },
  });
  const privateCollection = await prisma.artworkCollection.create({
    data: {
      slug: "private-collection",
      visibility: "private",
      translations: { create: [{ locale: "vi", name: "Bộ sưu tập riêng tư" }] },
    },
  });

  await prisma.artwork.create({
    data: {
      slug: "art-public",
      imageMediaId: media.id,
      collectionId: publicCollection.id,
      visibility: "public",
      featured: true,
      order: 1,
      translations: {
        create: [
          { locale: "vi", title: "Tác phẩm công khai", description: "Mô tả" },
          { locale: "en", title: "Public artwork", description: "Description" },
        ],
      },
    },
  });
  await prisma.artwork.create({
    data: {
      slug: "art-private",
      imageMediaId: media.id,
      visibility: "private",
      order: 2,
      translations: { create: [{ locale: "vi", title: "Tác phẩm riêng tư" }] },
    },
  });
  await prisma.artwork.create({
    data: {
      slug: "art-vi-only",
      imageMediaId: media.id,
      collectionId: privateCollection.id,
      visibility: "public",
      order: 3,
      translations: { create: [{ locale: "vi", title: "Chỉ tiếng Việt" }] },
    },
  });

  await prisma.project.create({
    data: {
      slug: "project-public",
      visibility: "public",
      publishedAt: PAST,
      featured: true,
      category: "product",
      translations: {
        create: [
          { locale: "vi", name: "Dự án công khai", shortDescription: "Mô tả" },
          { locale: "en", name: "Public project", shortDescription: "Description" },
        ],
      },
      technologies: { create: [{ name: "Next.js" }, { name: "Prisma" }] },
    },
  });
  await prisma.project.create({
    data: {
      slug: "project-private",
      visibility: "private",
      publishedAt: PAST,
      translations: { create: [{ locale: "vi", name: "Dự án riêng tư", shortDescription: "Mô tả" }] },
    },
  });
  await prisma.project.create({
    data: {
      slug: "project-unpublished",
      visibility: "public",
      publishedAt: null,
      translations: { create: [{ locale: "vi", name: "Chưa xuất bản", shortDescription: "Mô tả" }] },
    },
  });

  const articleBase = {
    authorId: superAdmin.id,
    visibility: "public",
  };

  await prisma.article.create({
    data: {
      ...articleBase,
      slug: "article-published",
      status: "published",
      publishedAt: PAST,
      featured: true,
      readingMinutes: 3,
      translations: {
        create: [
          { locale: "vi", title: "Bài viết công khai", excerpt: "Tóm tắt", content: "# Nội dung" },
          { locale: "en", title: "Public article", excerpt: "Excerpt", content: "# Content" },
        ],
      },
    },
  });
  await prisma.article.create({
    data: {
      ...articleBase,
      slug: "article-draft",
      status: "draft",
      publishedAt: null,
      translations: { create: [{ locale: "vi", title: "Bản nháp", excerpt: "", content: "Nháp" }] },
    },
  });
  await prisma.article.create({
    data: {
      ...articleBase,
      slug: "article-scheduled",
      status: "published",
      publishedAt: FUTURE,
      translations: { create: [{ locale: "vi", title: "Hẹn giờ", excerpt: "", content: "Sau này" }] },
    },
  });
  await prisma.article.create({
    data: {
      ...articleBase,
      slug: "article-archived",
      status: "archived",
      publishedAt: PAST,
      translations: { create: [{ locale: "vi", title: "Đã lưu trữ", excerpt: "", content: "" }] },
    },
  });
  await prisma.article.create({
    data: {
      ...articleBase,
      slug: "article-private",
      status: "published",
      publishedAt: PAST,
      visibility: "private",
      translations: { create: [{ locale: "vi", title: "Riêng tư", excerpt: "", content: "" }] },
    },
  });
  await prisma.article.create({
    data: {
      ...articleBase,
      slug: "article-vi-only",
      status: "published",
      publishedAt: PAST,
      translations: { create: [{ locale: "vi", title: "Chỉ tiếng Việt", excerpt: "", content: "" }] },
    },
  });

  const message = await prisma.contactMessage.create({
    data: { name: "Visitor", email: "visitor@test.local", subject: "Hello", message: "A message body long enough." },
  });

  return { superAdmin, admin, media, publicCollection, privateCollection, message };
}
