import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreviewData, isPreviewKind, type PreviewData } from "@/lib/services/preview";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/utils";
import { resolveLocale, type Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Xem trước nội dung",
  robots: { index: false, follow: false },
};

const TYPE_LABEL: Record<string, string> = {
  article: "Bài viết",
  project: "Dự án",
  artwork: "Tác phẩm",
};

type ArticlePreview = Extract<PreviewData, { kind: "article" }>;
type ProjectPreview = Extract<PreviewData, { kind: "project" }>;
type ArtworkPreview = Extract<PreviewData, { kind: "artwork" }>;

async function ArticleBody({ data, locale }: { data: ArticlePreview; locale: Locale }) {
  const translation = data.translation;
  if (!translation) return null;
  const { html } = await renderMarkdown(translation.content);
  const minutes = Math.max(1, Math.round((translation.content.split(/\s+/).length || 0) / 200));

  return (
    <article>
      {data.category && <p className="text-[10px] uppercase tracking-[0.16em] text-accent">{data.category}</p>}
      <h1 className="display mt-4 text-[clamp(2rem,5vw,3.4rem)] leading-[1.05]">{translation.title}</h1>
      {translation.subtitle && (
        <p className="serif-accent mt-4 text-[clamp(1.2rem,2.4vw,1.7rem)] text-slateblue">{translation.subtitle}</p>
      )}
      <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-muted">
        {data.author} · {data.publishedAt ? formatDate(data.publishedAt, locale) : "chưa xuất bản"} · {minutes} phút đọc
      </p>
      {data.cover && (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden border border-line">
          <Image src={data.cover} alt="" fill sizes="(min-width: 768px) 720px, 100vw" className="object-cover" />
        </div>
      )}
      <div className="prose-editorial mt-10" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

async function ProjectBody({ data }: { data: ProjectPreview }) {
  const translation = data.translation;
  if (!translation) return null;
  const { html } = await renderMarkdown(translation.fullDescription);

  return (
    <article>
      <p className="text-[10px] uppercase tracking-[0.16em] text-accent">Dự án</p>
      <h1 className="display mt-4 text-[clamp(2rem,5vw,3.4rem)] leading-[1.05]">{translation.name}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{translation.shortDescription}</p>
      {data.technologies.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {data.technologies.map((tech) => (
            <li key={tech} className="border border-line px-2.5 py-1 text-[11px] tracking-[0.02em] text-muted">
              {tech}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap gap-4 text-[12px]">
        {data.githubUrl && (
          <a href={data.githubUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
            GitHub
          </a>
        )}
        {data.demoUrl && (
          <a href={data.demoUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
            Live demo
          </a>
        )}
      </div>
      {data.cover && (
        <div className="relative mt-8 aspect-[16/10] overflow-hidden border border-line">
          <Image src={data.cover} alt="" fill sizes="(min-width: 768px) 720px, 100vw" className="object-cover" />
        </div>
      )}
      {translation.role && <p className="mt-6 text-[13px] text-muted">Vai trò: {translation.role}</p>}
      <div className="prose-editorial mt-8" dangerouslySetInnerHTML={{ __html: html }} />
      {data.gallery.length > 0 && (
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {data.gallery.map((url) => (
            <div key={url} className="relative aspect-[4/3] overflow-hidden border border-line">
              <Image src={url} alt="" fill sizes="360px" className="object-cover" />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function ArtworkBody({ data, locale }: { data: ArtworkPreview; locale: Locale }) {
  const translation = data.translation;
  if (!translation) return null;

  return (
    <article>
      <p className="text-[10px] uppercase tracking-[0.16em] text-accent">Tác phẩm</p>
      <h1 className="display mt-4 text-[clamp(2rem,5vw,3.2rem)] leading-[1.05]">{translation.title}</h1>
      {data.image && (
        <div className="mt-7 border border-line bg-surface-muted">
          {data.dimensions.width && data.dimensions.height ? (
            <Image
              src={data.image}
              alt={translation.title}
              width={data.dimensions.width}
              height={data.dimensions.height}
              sizes="(min-width: 768px) 720px, 100vw"
              className="h-auto w-full"
              priority
            />
          ) : (
            <div className="relative aspect-[4/5]">
              <Image src={data.image} alt={translation.title} fill sizes="720px" className="object-contain" />
            </div>
          )}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted">
        {data.collection && <span>{data.collection}</span>}
        {data.medium && <span>{data.medium}</span>}
        {data.createdDate && <span>{formatDate(data.createdDate, locale)}</span>}
        {data.dimensions.width && data.dimensions.height && (
          <span>
            {data.dimensions.width} × {data.dimensions.height}px
          </span>
        )}
      </div>
      {translation.description && (
        <p className="mt-5 whitespace-pre-line text-[15px] leading-[1.8] text-muted">{translation.description}</p>
      )}
    </article>
  );
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const [{ type, id }, query] = await Promise.all([params, searchParams]);
  if (!isPreviewKind(type)) notFound();

  const locale = resolveLocale(query.locale);
  const data = await getPreviewData(type, id, locale);
  if (!data) notFound();

  const editorHref = {
    article: `/admin/blog/${id}`,
    project: `/admin/projects/${id}`,
    artwork: `/admin/art/${id}`,
  }[type];

  const otherLocale = data.locales.find((item) => item !== locale);

  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="sticky top-0 z-50 border-b border-line bg-primary text-primary-fg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-[11px]">
          <span className="flex items-center gap-2 font-medium">
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[9px]">PS</span>
            Bản xem trước
          </span>
          <span className="opacity-60">·</span>
          <span className="opacity-80">{TYPE_LABEL[type]}</span>
          <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] opacity-90">
            {data.status}
          </span>
          <span className="ml-auto flex items-center gap-3">
            <Link href={editorHref} className="underline underline-offset-2 opacity-80 hover:opacity-100">
              Quay lại chỉnh sửa
            </Link>
            {otherLocale && (
              <Link
                href={`/preview/${type}/${id}?locale=${otherLocale}`}
                className="underline underline-offset-2 opacity-80 hover:opacity-100"
              >
                Xem bản {otherLocale.toUpperCase()}
              </Link>
            )}
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
        {!data.translation ? (
          <div className="border border-dashed border-line p-8 text-center">
            <p className="text-lg tracking-tight">Nội dung này chưa có bản dịch {locale.toUpperCase()}.</p>
            <p className="mt-2 text-sm text-muted">
              Bản xem trước không tự lấy nội dung ngôn ngữ khác. Hãy thêm bản dịch trong trình soạn thảo.
            </p>
            {otherLocale && (
              <Link href={`/preview/${type}/${id}?locale=${otherLocale}`} className="btn btn-outline btn-sm mt-5">
                Xem bản {otherLocale.toUpperCase()}
              </Link>
            )}
          </div>
        ) : data.kind === "article" ? (
          <ArticleBody data={data} locale={locale} />
        ) : data.kind === "project" ? (
          <ProjectBody data={data} />
        ) : (
          <ArtworkBody data={data} locale={locale} />
        )}

        <p className="mt-14 border-t border-line pt-4 text-[11px] text-muted">
          Trang xem trước yêu cầu đăng nhập quản trị. Nội dung chưa xuất bản không được lập chỉ mục và không có URL công khai
          cố định.
        </p>
      </main>
    </div>
  );
}
